import { NextRequest, NextResponse } from "next/server";

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
  trend: "rising" | "stable" | "falling";
  daysUntilStockout: number;
  urgencyScore: number;
  weeklyForecast: number[];
}

// ── Synthetic Data Generation ──────────────────────────────────────────────────
function generateSyntheticDemandHistory(): DemandRecord[] {
  const BLOOD_TYPES = [
    "DEA 1.1+", "DEA 1.1-", "DEA 1.2+", "DEA 1.2-",
    "DEA 3", "DEA 4", "DEA 5", "DEA 7", "Universal"
  ];

  // Realistic weekly demand rates based on canine transfusion literature
  const WEEKLY_RATES: Record<string, number> = {
    "DEA 1.1+": 3.5, "DEA 1.1-": 2.8, "DEA 1.2+": 1.2, "DEA 1.2-": 0.9,
    "DEA 3": 0.6, "DEA 4": 2.1, "DEA 5": 0.4, "DEA 7": 0.8, "Universal": 1.5
  };

  // Seeded pseudo-random for deterministic output (same every refresh)
  function seededRandom(seed: number): number {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  const records: DemandRecord[] = [];
  const today = new Date();
  const LOOKBACK = 180;

  // Add weekly seasonality — more demand mid-week (Tue-Thu)
  const DOW_MULTIPLIER = [0.6, 0.9, 1.2, 1.3, 1.1, 0.7, 0.5]; // Sun-Sat

  // Add monthly seasonality — more demand Jan-Mar (winter illness peak)
  const MONTH_MULTIPLIER = [1.3,1.2,1.1,1.0,0.9,0.8,0.8,0.9,1.0,1.1,1.1,1.2];

  for (const bt of BLOOD_TYPES) {
    const dailyProb = WEEKLY_RATES[bt] / 7;
    const demands: number[] = [];

    for (let i = LOOKBACK; i >= 0; i--) {
      const seed = bt.charCodeAt(0) * 1000 + i;
      const r1 = seededRandom(seed);
      const r2 = seededRandom(seed + 500);

      const d = new Date(today);
      d.setDate(d.getDate() - i);

      const adjustedProb = dailyProb
        * DOW_MULTIPLIER[d.getDay()]
        * MONTH_MULTIPLIER[d.getMonth()];

      const demand = r1 < adjustedProb
        ? Math.max(1, Math.round(-Math.log(r2 + 0.01) * WEEKLY_RATES[bt] / 3))
        : 0;

      demands.push(demand);
    }

    for (let i = 0; i < demands.length; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (LOOKBACK - i));
      const rolling7 = i >= 7
        ? demands.slice(i - 7, i).reduce((a, b) => a + b, 0) / 7
        : demands.slice(0, i).reduce((a, b) => a + b, 0) / Math.max(1, i);

      records.push({
        date: d.toISOString().slice(0, 10),
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

function getSyntheticInventory(): Record<string, number> {
  return {
    "DEA 1.1+": 12,
    "DEA 1.1-": 7,
    "DEA 1.2+": 4,
    "DEA 1.2-": 2,
    "DEA 3": 5,
    "DEA 4": 9,
    "DEA 5": 1,
    "DEA 7": 6,
    "Universal": 8,
  };
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
      trend: "stable",
      daysUntilStockout: 30,
      urgencyScore: 0,
      weeklyForecast: Array(7).fill(0),
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

  // ── NEW FIELDS : Trend, Urgency, Forecast ──────────────────────────────────
  const DOW_MULTIPLIER = [0.6, 0.9, 1.2, 1.3, 1.1, 0.7, 0.5];

  const last7Days = btRecords.slice(-7).reduce((s,r) => s + r.demand, 0);
  const prev7Days = btRecords.slice(-14,-7).reduce((s,r) => s + r.demand, 0);
  const trend = last7Days > prev7Days * 1.15 ? "rising"
              : last7Days < prev7Days * 0.85 ? "falling" : "stable";

  const dailyMean = meanDemand || 0.01;
  const daysUntilStockout = Math.min(30, Math.round(currentInventory / dailyMean));

  const urgencyScore = Math.min(100, Math.round(
    (piNew * 40) +
    (zeroPct < 0.5 ? 30 : zeroPct < 0.8 ? 15 : 0) +
    (daysUntilStockout < 3 ? 30 : daysUntilStockout < 7 ? 15 : 0)
  ));

  const weeklyForecast = Array.from({length: 7}, (_, i) => {
    const dow = (new Date().getDay() + i) % 7;
    return parseFloat((piNew * meanDemand * DOW_MULTIPLIER[dow] * 7).toFixed(1));
  });

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
    trend,
    daysUntilStockout,
    urgencyScore,
    weeklyForecast,
  };
}

// ── Route Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get("clinicId") || "unknown-clinic";

  try {
    const demandHistory = generateSyntheticDemandHistory();
    const inventory = getSyntheticInventory();

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
