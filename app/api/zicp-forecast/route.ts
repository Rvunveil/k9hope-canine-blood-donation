import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ── Constants ────────────────────────────────────────────────────────────────
const ALPHA = 0.05; // significance level → 95% nominal coverage
const CANINE_BLOOD_TYPES = [
  "DEA 1.1+", "DEA 1.1-", "DEA 1.2+", "DEA 1.2-",
  "DEA 3", "DEA 4", "DEA 5", "DEA 7", "Universal"
];
const LOOKBACK_DAYS = 180; // 6 months of history per paper's dataset range

// ── Types ────────────────────────────────────────────────────────────────────
interface DemandRecord {
  date: string;        // "YYYY-MM-DD"
  bloodType: string;
  demand: number;
  dayOfWeek: number;   // 0=Sun … 6=Sat (JS convention)
  month: number;       // 1–12
  rolling7: number;    // 7-day average demand prior to this day
}

interface ZICPResult {
  bloodType: string;
  lowerBound: number;
  upperBound: number;
  occurrenceProbability: number;
  mu: number;
  sigma: number;
  calibrationQuantile: number;
  currentInventory: number;
  orderRecommendation: number;
  coverageNote: string;
  nCalibrationSamples: number;
  meanDemand: number;
  zeroPct: number;
  hasEnoughData: boolean;
}

// ── Firestore Data Fetching ──────────────────────────────────────────────────
async function fetchDemandHistory(clinicId: string): Promise<DemandRecord[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  // Source 1: completed donor-appointments (actual transfusions)
  const apptSnap = await adminDb
    .collection("donor-appointments")
    .where("clinicId", "==", clinicId)
    .where("status", "==", "completed")
    .get();

  // Source 2: completed patient requests (alternative transfusion events)
  const patSnap = await adminDb
    .collection("patients")
    .where("clinicId", "==", clinicId)
    .where("request_status", "==", "completed")
    .get();

  // Aggregate daily demand per blood type
  const dailyMap: Record<string, number> = {};

  function addEvent(
    dateTs: FirebaseFirestore.Timestamp | undefined,
    bloodType: string | undefined
  ) {
    if (!dateTs || !bloodType) return;
    const date = dateTs.toDate();
    if (date < cutoff) return;
    const key = `${date.toISOString().slice(0, 10)}|${bloodType}`;
    dailyMap[key] = (dailyMap[key] || 0) + 1;
  }

  apptSnap.docs.forEach((d) => {
    const data = d.data();
    addEvent(
      data.completedAt || data.matchedAt,
      data.patientBloodGroup || data.bloodType
    );
  });

  patSnap.docs.forEach((d) => {
    const data = d.data();
    addEvent(data.completedAt || data.updatedAt, data.p_bloodgroup);
  });

  // Expand to full daily grid (fill zeros for missing days)
  const records: DemandRecord[] = [];
  const today = new Date();

  for (const bt of CANINE_BLOOD_TYPES) {
    const demands: number[] = [];
    for (let i = LOOKBACK_DAYS; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const key = `${dateStr}|${bt}`;
      demands.push(dailyMap[key] || 0);
    }

    for (let i = 0; i < demands.length; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (LOOKBACK_DAYS - i));
      const dateStr = d.toISOString().slice(0, 10);
      const rolling7 =
        i >= 7
          ? demands.slice(i - 7, i).reduce((a, b) => a + b, 0) / 7
          : demands.slice(0, i).reduce((a, b) => a + b, 0) / Math.max(1, i);

      records.push({
        date: dateStr,
        bloodType: bt,
        demand: demands[i],
        dayOfWeek: d.getDay(),
        month: d.getMonth() + 1,
        rolling7,
      });
    }
  }

  return records;
}

async function fetchInventory(
  clinicId: string
): Promise<Record<string, number>> {
  const snap = await adminDb.collection("blood-inventory").doc(clinicId).get();
  if (!snap.exists) return {};
  const data = snap.data() || {};

  // Normalize keys — inventory may store "DEA1.1+" or "DEA 1.1+" etc.
  const normalized: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    const clean = k
      .replace(/_/g, " ")
      .replace(/([A-Z]+)(\d)/g, "$1 $2")
      .trim();
    normalized[clean] = Number(v) || 0;
  }
  return normalized;
}

// ── ZICP Core Algorithm (TypeScript port of Algorithm 1) ─────────────────────
function runZICP(
  records: DemandRecord[],
  bloodType: string,
  currentInventory: number
): ZICPResult {
  const btRecords = records.filter((r) => r.bloodType === bloodType);

  // Need at least 20 samples for conformal calibration to be meaningful
  const hasEnoughData = btRecords.length >= 20;

  // Zero-inflation stats
  const zeroPct =
    btRecords.filter((r) => r.demand === 0).length /
    Math.max(1, btRecords.length);
  const meanDemand =
    btRecords.reduce((s, r) => s + r.demand, 0) /
    Math.max(1, btRecords.length);

  if (!hasEnoughData || btRecords.length === 0) {
    // Fallback: simple safety-stock heuristic (paper baseline)
    const safetyStock = Math.ceil(
      meanDemand * 7 + 1.65 * Math.sqrt(meanDemand * 7)
    );
    const orderQty = Math.max(0, safetyStock - currentInventory);
    return {
      bloodType,
      lowerBound: 0,
      upperBound: safetyStock,
      occurrenceProbability: 1 - zeroPct,
      mu: meanDemand > 0 ? Math.log(meanDemand) : 0,
      sigma: 0.5,
      calibrationQuantile: 0,
      currentInventory,
      orderRecommendation: orderQty,
      coverageNote:
        "Safety-stock heuristic (insufficient data for ZICP)",
      nCalibrationSamples: 0,
      meanDemand,
      zeroPct,
      hasEnoughData: false,
    };
  }

  // ── Chronological split: 50% train, 25% calibrate, 25% test (per §V.C)
  const n = btRecords.length;
  const trainEnd = Math.floor(n * 0.5);
  const calEnd = Math.floor(n * 0.75);

  const trainSet = btRecords.slice(0, trainEnd);
  const calSet = btRecords.slice(trainEnd, calEnd);

  // ── OCCURRENCE MODEL (weighted empirical by DOW + month + rolling signal)
  // Valid base model for conformal calibration (Vovk 2005).
  function estimateOccurrenceProbability(
    train: DemandRecord[],
    dow: number,
    month: number,
    rolling7: number
  ): number {
    const similar = train.filter(
      (r) => r.dayOfWeek === dow || r.month === month
    );
    if (similar.length === 0) {
      return (
        train.filter((r) => r.demand > 0).length / Math.max(1, train.length)
      );
    }
    const base = similar.filter((r) => r.demand > 0).length / similar.length;
    const rollingSignal = Math.min(1, rolling7 / 3);
    return Math.min(0.99, Math.max(0.01, base * 0.7 + rollingSignal * 0.3));
  }

  // ── SIZE MODEL (log-normal parameters from positive demand in training set)
  const positiveDemand = trainSet
    .filter((r) => r.demand > 0)
    .map((r) => r.demand);

  let mu = 0;
  let sigma = 0.5;
  if (positiveDemand.length > 0) {
    const logDemands = positiveDemand.map((d) => Math.log(d));
    mu = logDemands.reduce((a, b) => a + b, 0) / logDemands.length;
    if (logDemands.length > 1) {
      const variance =
        logDemands.reduce((s, x) => s + (x - mu) ** 2, 0) /
        (logDemands.length - 1);
      sigma = Math.sqrt(variance);
    }
  }

  // ── NON-CONFORMITY SCORE (Equation 7 from paper)
  function nonConformityScore(
    pi: number,
    muHat: number,
    sigmaHat: number,
    d: number
  ): number {
    if (d === 0) {
      return -Math.log(Math.max(1e-9, 1 - pi));
    } else {
      return (
        Math.log(Math.max(1e-9, 1 - pi)) +
        Math.log(d) -
        (Math.log(d) - muHat) ** 2 / (2 * sigmaHat ** 2)
      );
    }
  }

  // ── CONFORMAL CALIBRATION (Algorithm 1, lines 7–10)
  const calScores: number[] = calSet.map((r) => {
    const pi = estimateOccurrenceProbability(
      trainSet,
      r.dayOfWeek,
      r.month,
      r.rolling7
    );
    return nonConformityScore(pi, mu, sigma, r.demand);
  });

  calScores.sort((a, b) => a - b);

  // q = ⌈(n_cal + 1)(1 − α)⌉ / n_cal -th order statistic (Equation 8)
  const nCal = calScores.length;
  const qIndex = Math.min(
    nCal - 1,
    Math.ceil((nCal + 1) * (1 - ALPHA)) - 1
  );
  const q = calScores[qIndex] ?? calScores[nCal - 1] ?? 0;

  // ── TODAY'S FEATURES for prediction
  const today = new Date();
  const todayDow = today.getDay();
  const todayMonth = today.getMonth() + 1;
  const last7 = btRecords.slice(-7);
  const todayRolling7 =
    last7.reduce((s, r) => s + r.demand, 0) / Math.max(1, last7.length);

  const piNew = estimateOccurrenceProbability(
    trainSet,
    todayDow,
    todayMonth,
    todayRolling7
  );

  // ── PREDICTION INTERVAL CONSTRUCTION (Equation 9)
  // Find max d such that S(X_new, d) ≤ q
  const MAX_SEARCH = 25;
  let upperBound = 0;
  for (let d = 0; d <= MAX_SEARCH; d++) {
    const score = nonConformityScore(piNew, mu, sigma, d);
    if (score <= q) {
      upperBound = d;
    }
  }
  // Ensure U ≥ 1 if occurrence probability > 50%
  if (piNew > 0.5 && upperBound === 0) upperBound = 1;

  const lowerBound = 0; // Zero-inflated lower bound always 0 at α=0.05

  // ── ORDER RULE (Equation 3)
  const orderRecommendation = Math.max(0, upperBound - currentInventory);

  return {
    bloodType,
    lowerBound,
    upperBound,
    occurrenceProbability: piNew,
    mu,
    sigma,
    calibrationQuantile: q,
    currentInventory,
    orderRecommendation,
    coverageNote:
      "92% empirical coverage · ZICP (Pandithurai et al., iCONNECT 2026)",
    nCalibrationSamples: nCal,
    meanDemand,
    zeroPct,
    hasEnoughData: true,
  };
}

// ── Route Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get("clinicId");
  if (!clinicId) {
    return NextResponse.json(
      { error: "clinicId required" },
      { status: 400 }
    );
  }

  try {
    const [demandHistory, inventory] = await Promise.all([
      fetchDemandHistory(clinicId),
      fetchInventory(clinicId),
    ]);

    const results: ZICPResult[] = CANINE_BLOOD_TYPES.map((bt) => {
      // Find inventory match for this blood type (normalize for comparison)
      const invEntry = Object.entries(inventory).find(
        ([k]) =>
          k.toLowerCase().replace(/\s/g, "") ===
          bt.toLowerCase().replace(/\s/g, "")
      );
      const currentInventory = invEntry ? invEntry[1] : 0;
      return runZICP(demandHistory, bt, currentInventory);
    });

    // Sort: blood types needing orders first, then by urgency
    results.sort((a, b) => b.orderRecommendation - a.orderRecommendation);

    return NextResponse.json({
      clinicId,
      generatedAt: new Date().toISOString(),
      alpha: ALPHA,
      results,
      meta: {
        paper:
          "ZICP: Uncertainty-Aware Forecasting in Sparse Veterinary Networks",
        authors: "Pandithurai, Vikram, Prem Kumar, Ram Kishore",
        venue: "iCONNECT 2026",
        empiricalCoverage: 0.92,
        costReduction: 0.22,
      },
    });
  } catch (err: any) {
    console.error("[ZICP] Forecast error:", err);
    return NextResponse.json(
      { error: err.message || "Forecast failed" },
      { status: 500 }
    );
  }
}
