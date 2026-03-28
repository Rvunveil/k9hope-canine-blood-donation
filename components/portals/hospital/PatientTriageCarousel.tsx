"use client";

import { useEffect, useRef, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, FileText, AlertTriangle, Shield, Zap } from "lucide-react";

// ── Canine SOFA Score Engine ─────────────────────────────────────────────────
// Adapted from human Sequential Organ Failure Assessment for veterinary use.
// Inputs: PCV%, weight (kg), urgency string, OCR flags array
// Output: 0–100 risk score + survival band
function computeCanineSOFA(patient: any): { score: number; band: string; color: string; label: string } {
  let points = 0;

  // 1. PCV (Packed Cell Volume) — Hematologic organ failure proxy
  // Normal canine PCV: 37–55%. Critical below 20%.
  const pcv = typeof patient.initialDocument?.ocrScore === "number"
    ? null  // not PCV — handled below via pcv_value
    : null;
  const pcvRaw = patient.initialDocument?.pcv_value 
    ?? patient.pcv_value 
    ?? null;
  const pcvNum = pcvRaw !== null ? parseFloat(String(pcvRaw)) : null;
  
  if (pcvNum !== null) {
    if (pcvNum < 15)       points += 30;  // Severe anemia — critical
    else if (pcvNum < 20)  points += 22;  // Critical threshold
    else if (pcvNum < 25)  points += 14;  // Moderate anemia
    else if (pcvNum < 32)  points += 6;   // Mild anemia
    // >= 32 = normal, 0 points
  } else {
    points += 8; // Unknown PCV — assume moderate risk
  }

  // 2. Urgency level — clinical severity assessment
  const urgency = (patient.p_urgencyRequirment || patient.initialDocument?.ocrUrgency || "").toLowerCase();
  if (urgency === "immediate" || urgency === "critical") points += 25;
  else if (urgency === "within_24_hours" || urgency === "high") points += 16;
  else if (urgency === "within_3_days" || urgency === "medium") points += 8;
  // no_rush or low = 0

  // 3. OCR AI flags — clinical condition indicators
  const flags: string[] = patient.initialDocument?.ocrFlags ?? [];
  const criticalFlags = ["DIC Risk","Sepsis","Multi-organ","Organ Failure","Coagulopathy","Toxemia"];
  const highFlags = ["Trauma","Post-op","Emergency","Transfusion","Severe Anemia","Internal Bleeding","Shock"];
  const mediumFlags = ["Anemia","Low PCV","Tick Fever","Parvovirus","Surgery","Pyometra"];

  criticalFlags.forEach(f => { if (flags.some(fl => fl.toLowerCase().includes(f.toLowerCase()))) points += 8; });
  highFlags.forEach(f => { if (flags.some(fl => fl.toLowerCase().includes(f.toLowerCase()))) points += 4; });
  mediumFlags.forEach(f => { if (flags.some(fl => fl.toLowerCase().includes(f.toLowerCase()))) points += 2; });

  // 4. Weight — very low weight compounds risk
  const weight = parseFloat(patient.p_weight_kg) || 0;
  if (weight > 0 && weight < 10) points += 8;
  else if (weight >= 10 && weight < 18) points += 4;

  // 5. OCR severity score boost
  const ocrScore = patient.initialDocument?.ocrScore ?? 0;
  if (ocrScore >= 80)      points += 12;
  else if (ocrScore >= 60) points += 7;
  else if (ocrScore >= 40) points += 3;

  // Clamp to 0–100
  const finalScore = Math.min(100, Math.max(0, points));

  // Survival band classification
  let band: string, color: string, label: string;
  if (finalScore >= 75) {
    band = "critical"; color = "text-red-600"; label = "Critical Risk";
  } else if (finalScore >= 50) {
    band = "high"; color = "text-orange-600"; label = "High Risk";
  } else if (finalScore >= 25) {
    band = "moderate"; color = "text-yellow-600"; label = "Moderate Risk";
  } else {
    band = "low"; color = "text-green-600"; label = "Low Risk";
  }

  return { score: finalScore, band, color, label };
}

// ── Urgency sort weight ──────────────────────────────────────────────────────
function urgencyWeight(patient: any): number {
  const sofa = computeCanineSOFA(patient).score;
  const ocrScore = patient.initialDocument?.ocrScore ?? 0;
  return sofa * 0.6 + ocrScore * 0.4;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PatientTriageCarousel() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchPatients() {
      try {
        const snap = await getDocs(collection(db, "patients"));
        const raw = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((p: any) => p.onboarded === "yes");

        // Sort by combined urgency weight — highest first (critical → low)
        const sorted = raw.sort((a: any, b: any) => urgencyWeight(b) - urgencyWeight(a));
        setPatients(sorted);
      } catch (e) {
        console.error("PatientTriageCarousel fetch error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchPatients();
  }, []);

  // Improvement 2 — keyboard ← → navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") scrollTo(activeIdx + 1);
      if (e.key === "ArrowLeft")  scrollTo(activeIdx - 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIdx, patients.length]);

  function scrollTo(idx: number) {
    const newIdx = Math.max(0, Math.min(idx, patients.length - 1));
    setActiveIdx(newIdx);
    const card = scrollRef.current?.children[newIdx] as HTMLElement;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full" />
          <p className="text-xs text-gray-500">Loading triage data...</p>
        </div>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-400">No patients registered yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-bold">Canine Triage Queue</h2>
          {/* Improvement 4 — total + critical count badges */}
          {(() => {
            const criticalCount = patients.filter(p => computeCanineSOFA(p).band === "critical").length;
            return (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
                  {patients.length} patients · sorted by severity
                </Badge>
                {criticalCount > 0 && (
                  <Badge className="text-xs bg-red-600 text-white animate-pulse">
                    {criticalCount} CRITICAL
                  </Badge>
                )}
              </div>
            );
          })()}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scrollTo(activeIdx - 1)}
            disabled={activeIdx === 0}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-500 px-2">{activeIdx + 1} / {patients.length}</span>
          <button
            onClick={() => scrollTo(activeIdx + 1)}
            disabled={activeIdx === patients.length - 1}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Carousel track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {patients.map((patient: any, idx: number) => {
          const sofa = computeCanineSOFA(patient);
          const ocrScore = patient.initialDocument?.ocrScore ?? null;
          const hasDoc = !!patient.initialDocument?.fileUrl;
          const flags: string[] = patient.initialDocument?.ocrFlags ?? [];
          const isActive = idx === activeIdx;

          // Ring color based on SOFA band
          const ringClass =
            sofa.band === "critical" ? "ring-2 ring-red-500 shadow-red-200 dark:shadow-red-900/30" :
            sofa.band === "high"     ? "ring-2 ring-orange-400 shadow-orange-200 dark:shadow-orange-900/30" :
            sofa.band === "moderate" ? "ring-2 ring-yellow-400 shadow-yellow-200 dark:shadow-yellow-900/30" :
                                       "ring-1 ring-gray-200 dark:ring-gray-700";

          const bgClass =
            sofa.band === "critical" ? "bg-red-50 dark:bg-red-950/20" :
            sofa.band === "high"     ? "bg-orange-50 dark:bg-orange-950/20" :
            sofa.band === "moderate" ? "bg-yellow-50 dark:bg-yellow-950/20" :
                                       "bg-white dark:bg-gray-900";

          return (
            <div
              key={patient.id}
              onClick={() => setActiveIdx(idx)}
              className={`
                flex-none w-72 snap-start rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-md
                ${bgClass} ${ringClass}
                ${isActive ? "scale-[1.02]" : "opacity-80 hover:opacity-100"}
              `}
            >
              {/* Top row: name + SOFA score */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{patient.p_name || "Unknown Dog"}</p>
                  <p className="text-xs text-gray-500 truncate">{patient.p_bloodgroup?.toUpperCase() || "Blood type unknown"}</p>
                  <p className="text-xs text-gray-400 truncate">{patient.p_city || ""}</p>
                </div>
                {/* Canine SOFA Score Badge */}
                <div className="flex flex-col items-center ml-2">
                  <div className={`
                    flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg
                    ${sofa.band === "critical" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                      sofa.band === "high"     ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" :
                      sofa.band === "moderate" ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300" :
                                                 "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"}
                  `}>
                    {sofa.score}
                  </div>
                  <p className="text-[9px] text-gray-500 mt-0.5 text-center leading-tight">SOFA</p>
                </div>
              </div>

              {/* Risk label */}
              <div className={`text-xs font-semibold mb-2 flex items-center gap-1 ${sofa.color}`}>
                {sofa.band === "critical" && <Zap className="h-3 w-3" />}
                {sofa.band === "high" && <AlertTriangle className="h-3 w-3" />}
                {sofa.band === "moderate" && <Shield className="h-3 w-3" />}
                {sofa.label}
              </div>

              {/* OCR score + urgency */}
              <div className="flex gap-2 mb-3">
                {ocrScore !== null && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    ocrScore >= 76 ? "bg-red-100 text-red-700" :
                    ocrScore >= 51 ? "bg-orange-100 text-orange-700" :
                    ocrScore >= 26 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                  }`}>
                    AI Score: {ocrScore}
                  </span>
                )}
                {patient.p_urgencyRequirment && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    {patient.p_urgencyRequirment.replace("_", " ")}
                  </span>
                )}
              </div>

              {/* Flags */}
              {flags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {flags.slice(0, 4).map((flag, i) => (
                    <span key={i} className="text-[9px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                      {flag}
                    </span>
                  ))}
                  {flags.length > 4 && (
                    <span className="text-[9px] text-gray-400">+{flags.length - 4} more</span>
                  )}
                </div>
              )}

              {/* Diagnosis */}
              {patient.p_reasonRequirment && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  📋 {patient.p_reasonRequirment}
                </p>
              )}

              {/* Document section */}
              {hasDoc ? (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-[10px] font-medium text-violet-600 truncate max-w-[140px]">
                        {patient.initialDocument?.fileName || "Medical Report"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDoc(expandedDoc === patient.id ? null : patient.id);
                        }}
                        className="text-[9px] px-2 py-1 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 transition-colors"
                      >
                        {expandedDoc === patient.id ? "Hide" : "Preview"}
                      </button>
                      <a
                        href={patient.initialDocument?.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[9px] px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors"
                      >
                        Open ↗
                      </a>
                    </div>
                  </div>

                  {/* Inline image preview */}
                  {expandedDoc === patient.id && patient.initialDocument?.fileUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      <img
                        src={patient.initialDocument.fileUrl}
                        alt="Medical document"
                        className="w-full object-cover max-h-40"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      {patient.initialDocument?.ocrSummary && (
                        <p className="text-[9px] text-gray-500 italic p-2 bg-gray-50 dark:bg-gray-900">
                          &quot;{patient.initialDocument.ocrSummary}&quot;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                  <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                    <FileText className="h-3 w-3 flex-shrink-0" />
                    No document uploaded
                    <span className="ml-auto text-[9px] italic text-gray-300 dark:text-gray-600">
                      Patient can upload from dashboard
                    </span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dot indicator */}
      <div className="flex justify-center gap-1.5 pt-1">
        {patients.slice(0, Math.min(patients.length, 12)).map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className={`rounded-full transition-all duration-200 ${
              i === activeIdx
                ? "w-4 h-2 bg-red-500"
                : "w-2 h-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400"
            }`}
          />
        ))}
        {patients.length > 12 && (
          <span className="text-[10px] text-gray-400 self-center">+{patients.length - 12}</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical (75–100)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> High (50–74)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Moderate (25–49)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Low (0–24)</span>
        <span className="flex items-center gap-1 ml-auto italic">Canine SOFA — adapted from human ICU scoring</span>
      </div>
    </div>
  );
}
