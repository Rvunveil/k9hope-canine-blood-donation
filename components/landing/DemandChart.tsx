"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";

/**
 * Teaching chart for the research section. Simulates sparse daily demand for
 * one clinic and compares two ways of deciding how many units to hold:
 *  - a point forecast (average demand, rounded), and
 *  - a split-conformal upper bound at a chosen coverage level.
 * This is a simplified illustration computed in the browser. It is not the
 * published method or its results.
 */

const DAYS = 120;
const HISTORY = 60;

function simulate(): number[] {
  let s = 20260;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: DAYS }, () => {
    if (rand() > 0.21) return 0;
    return 1 + Math.floor(-Math.log(1 - rand() * 0.999) * 1.1);
  });
}

function conformalUpper(history: number[], coverage: number) {
  const sorted = [...history].sort((a, b) => a - b);
  const n = sorted.length;
  const k = Math.ceil((n + 1) * coverage);
  return k > n ? sorted[n - 1] + 1 : sorted[k - 1];
}

const LEVELS = [0.8, 0.9, 0.95];

export function DemandChart() {
  const reduce = useReducedMotion();
  const demand = useMemo(simulate, []);
  const [coverage, setCoverage] = useState(0.9);
  const [view, setView] = useState<"point" | "conformal">("conformal");

  const history = demand.slice(0, HISTORY);
  const test = demand.slice(HISTORY);
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const zeroShare = history.filter((d) => d === 0).length / history.length;
  const pointLevel = Math.round(mean);
  const upper = conformalUpper(history, coverage);
  const level = view === "point" ? pointLevel : upper;
  const shortPoint = test.filter((d) => d > pointLevel).length;
  const shortConf = test.filter((d) => d > upper).length;
  const shortDays = view === "point" ? shortPoint : shortConf;

  const W = 720;
  const H = 260;
  const pad = { l: 36, r: 12, t: 16, b: 34 };
  const maxY = Math.max(5, ...demand) + 1;
  const bw = (W - pad.l - pad.r) / DAYS;
  const y = (v: number) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);
  const splitX = pad.l + HISTORY * bw;

  return (
    <div className="on-light">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div role="radiogroup" aria-label="Stocking approach" className="inline-flex self-start rounded-full bg-white p-1 ring-1 ring-k9-mist/60">
          {(
            [
              ["point", "Hold the average"],
              ["conformal", "Hold the conformal bound"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              role="radio"
              aria-checked={view === k}
              onClick={() => setView(k)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${view === k ? "bg-k9-night font-bold text-k9-bone" : "text-k9-slate hover:text-k9-night"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Target coverage" className={`flex items-center gap-2 text-sm transition-opacity ${view === "conformal" ? "" : "pointer-events-none opacity-40"}`}>
          <span className="text-k9-slate">Target coverage</span>
          {LEVELS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={coverage === c}
              disabled={view !== "conformal"}
              onClick={() => setCoverage(c)}
              className={`tabular rounded-full px-3 py-1 ring-1 transition-colors ${coverage === c ? "bg-k9-teal-ink text-white ring-k9-teal-ink" : "text-k9-night ring-k9-mist hover:ring-k9-slate"}`}
            >
              {Math.round(c * 100)}%
            </button>
          ))}
        </div>
      </div>

      <figure className="mt-6">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="demand-chart-desc">
          <desc id="demand-chart-desc">
            {`Simulated daily blood demand for 120 days. ${Math.round(zeroShare * 100)}% of the first 60 days have zero demand. Holding ${level} ${level === 1 ? "unit" : "units"} leaves the clinic short on ${shortDays} of the next 60 days.`}
          </desc>
          {/* gridlines */}
          {Array.from({ length: maxY + 1 }, (_, v) => v)
            .filter((v) => v % 2 === 0)
            .map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#A7BDB4" strokeOpacity={v === 0 ? 0.9 : 0.35} />
                <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="#4A5F58" className="tabular">
                  {v}
                </text>
              </g>
            ))}
          {/* history shading */}
          <rect x={pad.l} y={pad.t} width={splitX - pad.l} height={H - pad.t - pad.b} fill="#0B201C" fillOpacity={0.035} />
          <text x={pad.l + 6} y={pad.t + 14} fontSize={12} fill="#4A5F58">
            Past 60 days, used to set the level
          </text>
          <text x={splitX + 6} y={pad.t + 14} fontSize={12} fill="#4A5F58">
            Next 60 days
          </text>

          {/* bars */}
          {demand.map((d, i) => {
            if (d === 0) return null;
            const short = i >= HISTORY && d > level;
            return (
              <rect
                key={i}
                x={pad.l + i * bw + bw * 0.15}
                width={bw * 0.7}
                y={y(d)}
                height={y(0) - y(d)}
                rx={1.5}
                fill={short ? "#B8392A" : i < HISTORY ? "#4A5F58" : "#14362F"}
                style={{ transition: "fill 0.3s ease" }}
              />
            );
          })}

          {/* stock level */}
          <motion.g initial={false} animate={{ y: y(level) - y(0) }} transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <line x1={splitX} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#0F6E66" strokeWidth={2.5} />
            <text x={W - pad.r} y={y(0) - 8} textAnchor="end" fontSize={13} fontWeight={700} fill="#0F6E66">
              {`Hold ${level} ${level === 1 ? "unit" : "units"}`}
            </text>
          </motion.g>
          <line x1={splitX} x2={splitX} y1={pad.t} y2={y(0)} stroke="#4A5F58" strokeDasharray="2 4" />
          <text x={pad.l} y={H - 10} fontSize={12} fill="#4A5F58">
            Day 1
          </text>
          <text x={W - pad.r} y={H - 10} fontSize={12} fill="#4A5F58" textAnchor="end">
            Day 120
          </text>
        </svg>
        <figcaption className="mt-5 grid gap-6 sm:grid-cols-3" aria-live="polite">
          <div>
            <p className="font-display tabular text-4xl font-semibold text-k9-night">{Math.round(zeroShare * 100)}%</p>
            <p className="text-[15px] text-k9-slate">of past days had no demand at all</p>
          </div>
          <div>
            <p className="font-display tabular text-4xl font-semibold text-k9-night">{level}</p>
            <p className="text-[15px] text-k9-slate">{view === "point" ? "units held using the rounded average" : `units held for ${Math.round(coverage * 100)}% target coverage`}</p>
          </div>
          <div>
            <p className={`font-display tabular text-4xl font-semibold ${shortDays > 0 ? "text-k9-coral-ink" : "text-k9-teal-ink"}`}>{shortDays}</p>
            <p className="text-[15px] text-k9-slate">of the next 60 days the clinic would run short</p>
          </div>
        </figcaption>
      </figure>
      <p className="mt-5 max-w-[68ch] text-sm leading-relaxed text-k9-slate">
        Simulated data and a simplified one-sided conformal bound, computed in your browser to show the idea. The
        published method models whether demand occurs and how large it is separately. See the paper for its design and
        results.
      </p>
    </div>
  );
}
