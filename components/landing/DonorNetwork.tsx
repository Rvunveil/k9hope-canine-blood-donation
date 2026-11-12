"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

/**
 * Hero visual: a fictional donor network around one emergency request.
 * Loop: request appears -> 10 km search radius -> blood type and eligibility
 * screening -> compatible donors connect. Purely illustrative data.
 */

const W = 600;
const H = 560;
const CX = 300;
const CY = 280;
const PX_PER_KM = 15;
const RADIUS_KM = 10;
const R = RADIUS_KM * PX_PER_KM;

type Node = { id: number; x: number; y: number; km: number; compatible: boolean; eligible: boolean };

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildNetwork(): { nodes: Node[]; edges: [Node, Node][] } {
  const rand = seeded(9);
  const nodes: Node[] = [];
  let tries = 0;
  while (nodes.length < 38 && tries < 2000) {
    tries++;
    const angle = rand() * Math.PI * 2;
    const dist = 40 + Math.sqrt(rand()) * 250;
    // Round so server and client render identical attribute strings.
    const x = Math.round((CX + Math.cos(angle) * dist * 1.08) * 10) / 10;
    const y = Math.round((CY + Math.sin(angle) * dist * 0.92) * 10) / 10;
    if (x < 24 || x > W - 24 || y < 24 || y > H - 24) continue;
    if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 34)) continue;
    const km = Math.hypot(x - CX, y - CY) / PX_PER_KM;
    nodes.push({ id: nodes.length, x, y, km, compatible: rand() < 0.3, eligible: rand() < 0.8 });
  }
  // Guarantee a readable outcome: exactly three ready donors inside the radius.
  // Pick them well apart in angle so their labels never collide.
  const inside = nodes.filter((n) => n.km <= RADIUS_KM).sort((a, b) => a.km - b.km);
  const angleOf = (n: Node) => Math.atan2(n.y - CY, n.x - CX);
  const ready: Node[] = [];
  for (const n of [...inside].sort((a, b) => b.km - a.km)) {
    if (ready.length === 3 || n.km < 4) continue;
    const apart = ready.every((r) => {
      const d = Math.abs(angleOf(r) - angleOf(n));
      return Math.min(d, Math.PI * 2 - d) > 1.4;
    });
    if (apart) ready.push(n);
  }
  inside.forEach((n, i) => {
    const isReady = ready.includes(n);
    n.compatible = isReady || i % 3 === 0; // some compatible dogs are not currently eligible
    n.eligible = isReady;
  });
  const edges: [Node, Node][] = [];
  nodes.forEach((a) => {
    nodes
      .filter((b) => b.id !== a.id)
      .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))
      .slice(0, 2)
      .forEach((b) => {
        if (!edges.some(([p, q]) => (p.id === b.id && q.id === a.id) || (p.id === a.id && q.id === b.id))) edges.push([a, b]);
      });
  });
  return { nodes, edges };
}

const STEPS = [
  "Request received",
  "Searching within 10 km",
  "Screening blood type and eligibility",
  "Donors ready for vet review",
];
// phase 0 idle, 1 request, 2 radius, 3 screening, 4 matched
const DURATIONS = [1100, 1500, 1600, 1600, 4200];

export function DonorNetwork() {
  const reduce = useReducedMotion();
  const { nodes, edges } = useMemo(buildNetwork, []);
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const shownPhase = reduce ? 4 : phase;

  useEffect(() => {
    if (reduce || paused) return;
    const t = setTimeout(() => setPhase((p) => (p + 1) % DURATIONS.length), DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phase, reduce, paused]);

  const matches = nodes.filter((n) => n.km <= RADIUS_KM && n.compatible && n.eligible);
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <figure className="relative" aria-labelledby="network-caption">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-hidden="true" focusable="false">
        {/* network fabric */}
        <g stroke="#A7BDB4" strokeOpacity={0.16} strokeWidth={1}>
          {edges.map(([a, b]) => (
            <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          ))}
        </g>

        {/* search radius */}
        <motion.circle
          cx={CX}
          cy={CY}
          fill="#43C2B1"
          fillOpacity={0.05}
          stroke="#43C2B1"
          strokeOpacity={0.55}
          strokeDasharray="3 6"
          initial={false}
          animate={{ r: shownPhase >= 2 ? R : 0, opacity: shownPhase >= 2 ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 1.2, ease }}
        />
        <motion.text
          x={CX + R * 0.71 + 8}
          y={CY - R * 0.71 - 6}
          fill="#A7BDB4"
          fontSize={13}
          className="tabular"
          initial={false}
          animate={{ opacity: shownPhase >= 2 ? 1 : 0 }}
          transition={{ duration: 0.4, delay: shownPhase >= 2 && !reduce ? 0.8 : 0 }}
        >
          10 km
        </motion.text>

        {/* connections to matched donors */}
        {matches.map((n, i) => (
          <motion.line
            key={`m-${n.id}`}
            x1={CX}
            y1={CY}
            x2={n.x}
            y2={n.y}
            stroke="#43C2B1"
            strokeWidth={2}
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: shownPhase >= 4 ? 1 : 0, opacity: shownPhase >= 4 ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.7, delay: shownPhase >= 4 && !reduce ? i * 0.25 : 0, ease }}
          />
        ))}

        {/* donor nodes */}
        {nodes.map((n, i) => {
          const isMatch = matches.includes(n);
          const dim = shownPhase >= 3 && !isMatch;
          return (
            <motion.circle
              key={n.id}
              cx={n.x}
              cy={n.y}
              initial={false}
              animate={{
                r: shownPhase >= 3 && isMatch ? 7 : 4,
                fill: shownPhase >= 3 && isMatch ? "#43C2B1" : "#A7BDB4",
                opacity: dim ? (n.km <= RADIUS_KM ? 0.3 : 0.14) : 0.75,
              }}
              transition={{ duration: reduce ? 0 : 0.5, delay: shownPhase === 3 && !reduce ? (i % 9) * 0.04 : 0 }}
            />
          );
        })}

        {/* match labels */}
        {matches.map((n, i) => (
          <motion.g
            key={`l-${n.id}`}
            initial={false}
            animate={{ opacity: shownPhase >= 4 ? 1 : 0 }}
            transition={{ duration: 0.35, delay: shownPhase >= 4 && !reduce ? 0.5 + i * 0.25 : 0 }}
          >
            <text x={n.x + 12} y={n.y - 8} fill="#EEF1EA" fontSize={13} fontWeight={700} stroke="#0B201C" strokeWidth={4} paintOrder="stroke">
              DEA 1.1 neg
            </text>
            <text x={n.x + 12} y={n.y + 8} fill="#A7BDB4" fontSize={12} className="tabular" stroke="#0B201C" strokeWidth={4} paintOrder="stroke">
              {n.km.toFixed(1)} km away
            </text>
          </motion.g>
        ))}

        {/* request */}
        <motion.g initial={false} animate={{ opacity: shownPhase >= 1 ? 1 : 0, scale: shownPhase >= 1 ? 1 : 0.6 }} style={{ originX: `${CX}px`, originY: `${CY}px` }} transition={{ duration: reduce ? 0 : 0.5, ease }}>
          {!reduce && <circle cx={CX} cy={CY} r={10} fill="#FF806C" className="pulse-ring" />}
          <circle cx={CX} cy={CY} r={10} fill="#FF806C" />
          <circle cx={CX} cy={CY} r={4} fill="#0B201C" />
          <text x={CX} y={CY - 24} textAnchor="middle" fill="#FF806C" fontSize={13} fontWeight={700} stroke="#0B201C" strokeWidth={5} paintOrder="stroke">
            Needs DEA 1.1 negative
          </text>
        </motion.g>
      </svg>

      <figcaption id="network-caption" className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <ol className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-k9-mist" aria-label="Matching sequence">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 transition-colors duration-300 ${shownPhase >= i + 1 ? "text-k9-bone" : ""}`}>
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                  shownPhase === i + 1 ? (i === 0 ? "bg-k9-coral" : "bg-k9-teal") : shownPhase > i + 1 ? "bg-k9-mist" : "bg-k9-moss"
                }`}
              />
              {s}
            </li>
          ))}
        </ol>
        {!reduce && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="shrink-0 self-start rounded-full border border-k9-moss px-3 py-1 text-xs text-k9-mist hover:border-k9-mist hover:text-k9-bone"
            aria-pressed={paused}
          >
            {paused ? "Play animation" : "Pause animation"}
          </button>
        )}
      </figcaption>
      <p className="mt-2 text-xs text-k9-mist/80">Fictional donors and distances, for illustration.</p>
    </figure>
  );
}
