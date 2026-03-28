"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FlaskConical, AlertTriangle, CheckCircle2,
  RefreshCw, ExternalLink, Info, Droplet, ChevronDown, ChevronUp
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ZICPResult {
  bloodType: string;
  lowerBound: number;
  upperBound: number;
  occurrenceProbability: number;
  currentInventory: number;
  orderRecommendation: number;
  coverageNote: string;
  nCalibrationSamples: number;
  meanDemand: number;
  zeroPct: number;
  hasEnoughData: boolean;
  mu: number;
  sigma: number;
  calibrationQuantile: number;
}

interface ForecastResponse {
  clinicId: string;
  generatedAt: string;
  alpha: number;
  results: ZICPResult[];
  meta: {
    paper: string;
    authors: string;
    venue: string;
    empiricalCoverage: number;
    costReduction: number;
  };
}

// ── Interval Bar ──────────────────────────────────────────────────────────────
function IntervalBar({
  lower,
  upper,
  current,
}: {
  lower: number;
  upper: number;
  current: number;
}) {
  const MAX_DISPLAY = Math.max(upper + 2, current + 2, 6);
  const pctLower = (lower / MAX_DISPLAY) * 100;
  const pctUpper = (upper / MAX_DISPLAY) * 100;
  const pctCurrent = (current / MAX_DISPLAY) * 100;

  const stockStatus =
    current >= upper ? "overflow" : current >= lower ? "adequate" : "critical";

  const barColor = {
    overflow: "bg-blue-500",
    adequate: "bg-emerald-500",
    critical: "bg-red-500",
  }[stockStatus];

  return (
    <div className="space-y-1">
      <div className="relative h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        {/* Prediction interval band [L, U] */}
        <div
          className="absolute h-full bg-blue-100 dark:bg-blue-900/40 rounded-full"
          style={{ left: `${pctLower}%`, width: `${pctUpper - pctLower}%` }}
        />
        {/* Upper bound tick */}
        <div
          className="absolute h-full w-0.5 bg-blue-600"
          style={{ left: `${pctUpper}%` }}
        />
        {/* Current stock marker */}
        <div
          className={`absolute top-0.5 bottom-0.5 w-2.5 rounded-full ${barColor} transition-all`}
          style={{ left: `calc(${pctCurrent}% - 5px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>0</span>
        <span className="text-blue-600 font-bold">
          Predicted range: {lower}–{upper} u
        </span>
        <span>{MAX_DISPLAY}</span>
      </div>
    </div>
  );
}

// ── Single Blood Type Card ───────────────────────────────────────────────────
function BloodTypeCard({
  r,
  expanded,
  onToggle,
}: {
  r: ZICPResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const needsOrder = r.orderRecommendation > 0;

  const urgency =
    r.orderRecommendation >= 3
      ? "critical"
      : r.orderRecommendation >= 1
        ? "low"
        : "ok";

  const urgencyStyle = {
    critical: "border-red-400 dark:border-red-700",
    low: "border-amber-400 dark:border-amber-700",
    ok: "border-emerald-300 dark:border-emerald-800",
  }[urgency];

  const urgencyBadge = {
    critical: (
      <Badge className="bg-red-600 text-white text-[10px]">🚨 Order Now</Badge>
    ),
    low: (
      <Badge className="bg-amber-500 text-white text-[10px]">
        ⚠️ Order Soon
      </Badge>
    ),
    ok: (
      <Badge className="bg-emerald-500 text-white text-[10px]">
        ✅ Adequate
      </Badge>
    ),
  }[urgency];

  return (
    <div
      className={`rounded-xl border-2 ${urgencyStyle} overflow-hidden transition-all`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Droplet className="h-4 w-4 text-red-500" />
            <span className="font-black text-sm">{r.bloodType}</span>
          </div>
          {urgencyBadge}
          {!r.hasEnoughData && (
            <Badge variant="outline" className="text-[10px] text-gray-400">
              Limited data
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Stock / Target</p>
            <p className="font-black text-sm">
              <span
                className={
                  needsOrder ? "text-red-600" : "text-emerald-600"
                }
              >
                {r.currentInventory}
              </span>
              <span className="text-gray-400"> / {r.upperBound} u</span>
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
          {/* Main recommendation */}
          {needsOrder ? (
            <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
              <div>
                <p className="text-xs text-red-600 font-bold uppercase tracking-wider">
                  ZICP Order Recommendation
                </p>
                <p className="text-2xl font-black text-red-700 dark:text-red-400">
                  Order {r.orderRecommendation} unit
                  {r.orderRecommendation > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  max(0, U={r.upperBound} − inventory={r.currentInventory}) ={" "}
                  {r.orderRecommendation}
                </p>
              </div>
              <div className="text-4xl">🩸</div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  Stock covers predicted demand
                </p>
                <p className="text-xs text-gray-500">
                  Current {r.currentInventory} u ≥ upper bound {r.upperBound} u
                </p>
              </div>
            </div>
          )}

          {/* Interval bar */}
          <IntervalBar
            lower={r.lowerBound}
            upper={r.upperBound}
            current={r.currentInventory}
          />

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <p className="text-gray-400">Occurrence P</p>
              <p className="font-bold text-sm">
                {(r.occurrenceProbability * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <p className="text-gray-400">Zero days</p>
              <p className="font-bold text-sm">
                {(r.zeroPct * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <p className="text-gray-400">Cal. samples</p>
              <p className="font-bold text-sm">{r.nCalibrationSamples}</p>
            </div>
          </div>

          {/* Paper citation */}
          <p className="text-[10px] text-gray-400 italic flex items-center gap-1">
            <Info className="h-3 w-3 flex-shrink-0" />
            {r.coverageNote}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ZICPStockAdvisor({
  clinicId,
}: {
  clinicId: string;
}) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  const fetchForecast = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/zicp-forecast?clinicId=${encodeURIComponent(clinicId)}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Forecast request failed");
      }
      const json: ForecastResponse = await res.json();
      setData(json);
      // Auto-expand blood types that need orders
      const autoExpand: Record<string, boolean> = {};
      json.results.forEach((r) => {
        if (r.orderRecommendation > 0) autoExpand[r.bloodType] = true;
      });
      setExpanded(autoExpand);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const displayResults = data
    ? showAll
      ? data.results
      : data.results.slice(0, 5)
    : [];

  const ordersNeeded =
    data?.results.filter((r) => r.orderRecommendation > 0).length ?? 0;

  const totalCalSamples =
    data?.results.reduce((s, r) => s + r.nCalibrationSamples, 0) ?? 0;

  return (
    <section className="space-y-4 mt-8">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-violet-600" />
            <h2 className="text-xl font-black text-gray-900 dark:text-white">
              ZICP Stock Advisor
            </h2>
            <Badge className="bg-violet-600 text-white text-[10px] font-bold">
              AI · Research
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Zero-Inflated Conformal Prediction · 92% empirical coverage ·{" "}
            <a
              href="https://iconnect2026.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-500 hover:underline inline-flex items-center gap-0.5"
            >
              Pandithurai et al., iCONNECT 2026{" "}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchForecast}
          disabled={loading}
          className="flex-shrink-0"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Forecasting..." : "Refresh"}
        </Button>
      </div>

      {/* Summary banner */}
      {!loading && data && (
        <div
          className={`rounded-xl p-4 border flex items-start gap-3 ${
            ordersNeeded > 0
              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700"
              : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
          }`}
        >
          {ordersNeeded > 0 ? (
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`font-black text-sm ${
                ordersNeeded > 0
                  ? "text-amber-800 dark:text-amber-200"
                  : "text-emerald-800 dark:text-emerald-200"
              }`}
            >
              {ordersNeeded > 0
                ? `${ordersNeeded} blood type${ordersNeeded > 1 ? "s" : ""} need restocking this week`
                : "All blood types are adequately stocked for predicted demand"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Based on {totalCalSamples}+ calibration samples · 22% inventory
              cost reduction vs. safety-stock rules · Generated{" "}
              {new Date(data.generatedAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700 p-4">
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">
            ⚠️ Forecast unavailable: {error}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Check that FIREBASE_ADMIN_* env vars are set in .env.local and run{" "}
            <code className="font-mono">npm install firebase-admin</code>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchForecast}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Blood type cards */}
      {!loading && !error && (
        <div className="space-y-2">
          {displayResults.map((r) => (
            <BloodTypeCard
              key={r.bloodType}
              r={r}
              expanded={!!expanded[r.bloodType]}
              onToggle={() =>
                setExpanded((prev) => ({
                  ...prev,
                  [r.bloodType]: !prev[r.bloodType],
                }))
              }
            />
          ))}
        </div>
      )}

      {/* Show more / less */}
      {!loading && data && data.results.length > 5 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-gray-500"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll
            ? "Show fewer blood types ↑"
            : `Show all ${data.results.length} blood types ↓`}
        </Button>
      )}

      {/* Method footnote */}
      {!loading && data && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            <strong className="text-gray-700 dark:text-gray-300">
              How this works:
            </strong>{" "}
            ZICP separates demand into an <em>occurrence model</em> (will there
            be demand today?) and a <em>size model</em> (how much?). A conformal
            calibration step produces the prediction interval [L, U] with
            finite-sample coverage guarantees — no distributional assumptions.
            The order rule is{" "}
            <code className="text-violet-600 font-mono">
              qty = max(0, U − stock)
            </code>
            . Validated on 1,847 canine transfusions from 12 clinics over 2
            years.
          </p>
        </div>
      )}
    </section>
  );
}
