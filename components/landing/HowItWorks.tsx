"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { checkDAHD2025Eligibility } from "@/lib/veterinary/dahdCompliance";
import { calculateHaversineDistance } from "@/lib/veterinary/geospatialMatching";

const STEPS = [
  { key: "request", title: "A clinic raises a request", short: "Request" },
  { key: "screen", title: "Documents and eligibility are checked", short: "Screening" },
  { key: "match", title: "Nearby compatible donors are found", short: "Matching" },
  { key: "vet", title: "Veterinarians confirm the donation", short: "Vet review" },
  { key: "stock", title: "Blood and components are tracked", short: "Inventory" },
] as const;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = useReducedMotion();

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % STEPS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + STEPS.length) % STEPS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = STEPS.length - 1;
    else return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div role="tablist" aria-label="How K9HOPE works" aria-orientation="vertical" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 lg:col-span-4 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0">
        {STEPS.map((s, i) => {
          const selected = i === active;
          return (
            <button
              key={s.key}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`hiw-tab-${s.key}`}
              aria-selected={selected}
              aria-controls={`hiw-panel-${s.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={`group relative flex shrink-0 items-baseline gap-4 rounded-lg px-4 py-3 text-left transition-colors lg:rounded-none lg:border-l-2 lg:px-6 lg:py-5 ${
                selected
                  ? "bg-k9-forest text-k9-bone lg:border-k9-teal lg:bg-transparent"
                  : "text-k9-mist hover:text-k9-bone lg:border-k9-moss"
              }`}
            >
              <span className={`tabular text-sm ${selected ? "text-k9-teal" : ""}`}>{i + 1}</span>
              <span>
                <span className="font-display text-base font-semibold lg:hidden">{s.short}</span>
                <span className="hidden font-display text-xl font-medium leading-snug lg:inline">{s.title}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={STEPS[active].key}
            role="tabpanel"
            id={`hiw-panel-${STEPS[active].key}`}
            aria-labelledby={`hiw-tab-${STEPS[active].key}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-k9-moss bg-k9-forest/60 p-5 sm:p-8"
          >
            <h3 className="font-display text-2xl font-semibold tracking-[-0.01em] text-k9-bone lg:sr-only">{STEPS[active].title}</h3>
            {active === 0 && <RequestPanel />}
            {active === 1 && <ScreenPanel />}
            {active === 2 && <MatchPanel />}
            {active === 3 && <VetPanel />}
            {active === 4 && <StockPanel />}
          </motion.div>
        </AnimatePresence>
        <p className="mt-4 text-sm text-k9-mist">
          All names, dogs and figures in these previews are fictional. Clinical eligibility and every transfusion
          decision rest with qualified veterinarians.
        </p>
      </div>
    </div>
  );
}

/* ── shared bits ───────────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-k9-mist">{label}</dt>
      <dd className="mt-0.5 text-k9-bone">{value}</dd>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-k9-mist">{children}</p>;
}

/* ── 1. Request ────────────────────────────────────────────────────────── */

function RequestPanel() {
  return (
    <div className="lg:mt-0 mt-4">
      <div className="rounded-xl bg-k9-night p-5 ring-1 ring-k9-moss sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-xl font-semibold text-k9-bone">Blood request for Bruno</p>
          <span className="rounded-full bg-k9-coral/15 px-3 py-1 text-sm font-bold text-k9-coral">Critical</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Field label="Patient" value="Labrador, 6 years" />
          <Field label="Blood type" value="DEA 1.1 negative" />
          <Field label="Needed" value="2 units whole blood" />
          <Field label="Request closes" value="In 12 hours" />
        </dl>
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed border-k9-moss px-4 py-3 text-sm text-k9-mist">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          Referral letter attached
        </div>
      </div>
      <Note>
        Clinics post a request with the patient&apos;s blood type, how much is needed and when the request closes. Donor
        owners in the same city who match the blood type see it in their dashboard.
      </Note>
    </div>
  );
}

/* ── 2. Screening (uses the real eligibility rules) ────────────────────── */

function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm text-k9-mist">
          {label}
        </label>
        <output htmlFor={id} className="tabular text-k9-bone">
          {value} {unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--fill" as string]: `${fill}%` }}
      />
    </div>
  );
}

function ScreenPanel() {
  const [weight, setWeight] = useState(28);
  const [age, setAge] = useState(4);
  const [pcv, setPcv] = useState(42);
  const [daysSince, setDaysSince] = useState(45);
  const [condition, setCondition] = useState(false);

  const result = useMemo(
    () =>
      checkDAHD2025Eligibility({
        weight_kg: weight,
        age_years: age,
        pcv_percentage: pcv,
        last_donation_date: new Date(Date.now() - daysSince * 86_400_000),
        has_medical_conditions: condition,
        species: "canine",
      }),
    [weight, age, pcv, daysSince, condition],
  );

  return (
    <div className="mt-4 grid gap-8 lg:mt-0 md:grid-cols-2">
      <fieldset>
        <legend className="mb-4 font-display text-lg font-semibold text-k9-bone">Try a donor profile</legend>
        <div className="flex flex-col gap-4">
          <Slider id="el-weight" label="Body weight" value={weight} min={10} max={50} unit="kg" onChange={setWeight} />
          <Slider id="el-age" label="Age" value={age} min={0} max={12} unit={age === 1 ? "year" : "years"} onChange={setAge} />
          <Slider id="el-pcv" label="Packed cell volume" value={pcv} min={20} max={60} unit="%" onChange={setPcv} />
          <Slider id="el-days" label="Days since last donation" value={daysSince} min={0} max={120} unit="days" onChange={setDaysSince} />
          <label className="mt-1 flex cursor-pointer items-center gap-3 text-sm text-k9-mist">
            <input
              type="checkbox"
              checked={condition}
              onChange={(e) => setCondition(e.target.checked)}
              className="h-5 w-5 accent-[#43C2B1]"
            />
            Has an active medical condition
          </label>
        </div>
      </fieldset>

      <div aria-live="polite" className="flex flex-col">
        <div
          className={`rounded-xl p-5 ring-1 transition-colors duration-300 ${
            result.eligible ? "bg-k9-teal/10 ring-k9-teal/50" : "bg-k9-coral/10 ring-k9-coral/40"
          }`}
        >
          <p className={`font-display text-2xl font-semibold ${result.eligible ? "text-k9-teal" : "text-k9-coral"}`}>
            {result.eligible ? "Can join the donor registry" : "Not eligible right now"}
          </p>
          {result.reasons.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5 text-[15px] text-k9-bone">
              {result.reasons.map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-k9-coral" />
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[15px] text-k9-bone">All screening rules pass. A veterinarian still examines the dog before any donation.</p>
          )}
        </div>
        <Note>
          These are the same eligibility rules the platform uses, running in your browser. Referral letters can also be
          read by an AI assistant that suggests an urgency level. It is a prototype, and its suggestion is only ever a
          prompt for a clinician to review.
        </Note>
      </div>
    </div>
  );
}

/* ── 3. Matching (uses the real Haversine module) ──────────────────────── */

const CLINIC = { name: "Requesting clinic, central Chennai", lat: 13.0827, lon: 80.2707 };
const DONORS = [
  { name: "Max", area: "Mylapore", lat: 13.0368, lon: 80.2676, type: "DEA 1.1 neg", rest: false },
  { name: "Kaala", area: "Royapuram", lat: 13.1137, lon: 80.2954, type: "DEA 1.1 neg", rest: true },
  { name: "Simba", area: "T. Nagar", lat: 13.0418, lon: 80.2341, type: "DEA 1.1 pos", rest: false },
  { name: "Rani", area: "Anna Nagar", lat: 13.085, lon: 80.2101, type: "DEA 1.1 neg", rest: false },
  { name: "Tiger", area: "Perambur", lat: 13.121, lon: 80.233, type: "DEA 1.1 pos", rest: false },
  { name: "Leo", area: "Adyar", lat: 13.0012, lon: 80.2565, type: "DEA 1.1 neg", rest: false },
  { name: "Bella", area: "Porur", lat: 13.0382, lon: 80.1565, type: "DEA 1.1 neg", rest: false },
  { name: "Rocky", area: "Velachery", lat: 12.9815, lon: 80.218, type: "DEA 1.1 pos", rest: false },
  { name: "Chinna", area: "Tambaram", lat: 12.9249, lon: 80.1, type: "DEA 1.1 neg", rest: false },
];

function MatchPanel() {
  const [radius, setRadius] = useState(10);
  const rows = useMemo(
    () =>
      DONORS.map((d) => {
        const km = calculateHaversineDistance(CLINIC.lat, CLINIC.lon, d.lat, d.lon);
        const reason =
          d.type !== "DEA 1.1 neg" ? "Blood type not compatible" : d.rest ? "Resting after a recent donation" : km > radius ? "Outside search radius" : null;
        return { ...d, km, reason };
      }).sort((a, b) => Number(!!a.reason) - Number(!!b.reason) || a.km - b.km),
    [radius],
  );
  const ready = rows.filter((r) => !r.reason).length;

  return (
    <div className="mt-4 lg:mt-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:w-72">
          <Slider id="match-radius" label="Search radius" value={radius} min={3} max={30} unit="km" onChange={setRadius} />
        </div>
        <p aria-live="polite" className="font-display text-xl text-k9-bone">
          <span className="tabular text-k9-teal">{ready}</span> {ready === 1 ? "donor" : "donors"} ready for this request
        </p>
      </div>
      <ul className="mt-5 divide-y divide-k9-moss/70 border-y border-k9-moss/70">
        {rows.map((r) => (
          <motion.li layout="position" key={r.name} className="flex items-center justify-between gap-4 py-3" transition={{ duration: 0.25 }}>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${r.reason ? "bg-k9-moss" : "bg-k9-teal"}`} />
              <div>
                <p className={r.reason ? "text-k9-mist" : "font-bold text-k9-bone"}>
                  {r.name} <span className="font-normal text-k9-mist">in {r.area}</span>
                </p>
                <p className="text-sm text-k9-mist">{r.reason ?? r.type}</p>
              </div>
            </div>
            <span className={`tabular shrink-0 text-sm ${r.reason ? "text-k9-mist" : "text-k9-bone"}`}>{r.km.toFixed(1)} km</span>
          </motion.li>
        ))}
      </ul>
      <Note>
        Distances come from the platform&apos;s Haversine matching module. Today the live app filters requests by blood type
        and city. Connecting this radius search to live requests is next on the roadmap.
      </Note>
    </div>
  );
}

/* ── 4. Vet review ─────────────────────────────────────────────────────── */

function VetPanel() {
  const checks = [
    { t: "Physical examination of the donor", d: "Done at the clinic on the day of donation." },
    { t: "Cross-match with the patient", d: "Confirms compatibility beyond blood type." },
    { t: "Owner consent recorded", d: "Consent can be withdrawn at any time." },
    { t: "Collection and transfusion", d: "Performed and monitored by the veterinary team." },
  ];
  return (
    <div className="mt-4 lg:mt-0">
      <ol className="relative flex flex-col gap-6 border-l border-k9-moss pl-6">
        {checks.map((c) => (
          <li key={c.t} className="relative">
            <span aria-hidden="true" className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-k9-teal bg-k9-night" />
            <p className="font-display text-lg font-semibold text-k9-bone">{c.t}</p>
            <p className="text-[15px] text-k9-mist">{c.d}</p>
          </li>
        ))}
      </ol>
      <Note>
        K9HOPE coordinates people and information. It does not make clinical decisions. Eligibility, cross-matching and
        transfusion are always decided by qualified veterinary professionals.
      </Note>
    </div>
  );
}

/* ── 5. Inventory (expiry-first ordering) ─────────────────────────────── */

const UNITS = [
  { id: "WB-0412", kind: "Whole blood", type: "DEA 1.1 neg", received: 1, expires: 27 },
  { id: "PRBC-0398", kind: "Packed red cells", type: "DEA 1.1 pos", received: 2, expires: 9 },
  { id: "FFP-0377", kind: "Fresh frozen plasma", type: "Any", received: 3, expires: 160 },
  { id: "PRP-0405", kind: "Platelet-rich plasma", type: "DEA 1.1 pos", received: 4, expires: 2 },
  { id: "WB-0401", kind: "Whole blood", type: "DEA 1.1 neg", received: 5, expires: 6 },
];

function StockPanel() {
  const [order, setOrder] = useState<"received" | "expiry">("expiry");
  const rows = [...UNITS].sort((a, b) => (order === "expiry" ? a.expires - b.expires : a.received - b.received));
  return (
    <div className="mt-4 lg:mt-0">
      <div role="radiogroup" aria-label="Sort units" className="inline-flex rounded-full bg-k9-night p-1 ring-1 ring-k9-moss">
        {(
          [
            ["expiry", "Use first"],
            ["received", "Newest first"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="radio"
            aria-checked={order === k}
            onClick={() => setOrder(k)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${order === k ? "bg-k9-bone font-bold text-k9-night" : "text-k9-mist hover:text-k9-bone"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-[15px]">
          <caption className="sr-only">Blood units in stock</caption>
          <thead className="text-sm text-k9-mist">
            <tr className="border-b border-k9-moss">
              <th scope="col" className="py-2 font-normal">Unit</th>
              <th scope="col" className="py-2 font-normal">Component</th>
              <th scope="col" className="py-2 font-normal">Type</th>
              <th scope="col" className="py-2 text-right font-normal">Expires in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <motion.tr layout="position" key={u.id} transition={{ duration: 0.25 }} className="border-b border-k9-moss/60 text-k9-bone">
                <td className="tabular py-3 text-k9-mist">{u.id}</td>
                <td className="py-3">{u.kind}</td>
                <td className="py-3">{u.type}</td>
                <td className={`tabular py-3 text-right ${u.expires <= 7 ? "font-bold text-k9-coral" : ""}`}>
                  {u.expires} {u.expires === 1 ? "day" : "days"}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>
        Units close to expiry are flagged so they are used first, which reduces waste. Expiry flags exist in the current
        app as a prototype. Full first-expiry, first-out rotation across clinics is planned.
      </Note>
    </div>
  );
}
