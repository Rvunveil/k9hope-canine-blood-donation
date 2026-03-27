"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Upload,
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  X,
} from "lucide-react";

import { UploadClient } from "@uploadcare/upload-client";
import { savePatientDocument, getPatientDocuments } from "@/firebaseFunctions";

const uploadClient = new UploadClient({
  publicKey: process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY || "",
});

// ── Types ──────────────────────────────────────────────────────────
interface OcrResult {
  score: number;
  flags: string[];
  summary: string;
  pcv_value: string | null;
  urgency: string;
}

interface PatientDocument {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: any;
  ocrScore: number;
  ocrFlags: string[];
  ocrSummary: string;
  ocrUrgency: string;
}

interface MedicalDocumentsSectionProps {
  userId: string | null;
}

// ── Severity Helpers ───────────────────────────────────────────────
function getSeverityZone(score: number) {
  if (score <= 25) return { label: "Stable", color: "bg-green-500", textColor: "text-green-700 dark:text-green-400", borderColor: "border-green-200 dark:border-green-800", bgColor: "bg-green-50 dark:bg-green-950", icon: CheckCircle2 };
  if (score <= 50) return { label: "Monitoring Required", color: "bg-yellow-400", textColor: "text-yellow-700 dark:text-yellow-400", borderColor: "border-yellow-200 dark:border-yellow-800", bgColor: "bg-yellow-50 dark:bg-yellow-950", icon: Clock };
  if (score <= 75) return { label: "Needs Attention", color: "bg-orange-500", textColor: "text-orange-700 dark:text-orange-400", borderColor: "border-orange-200 dark:border-orange-800", bgColor: "bg-orange-50 dark:bg-orange-950", icon: AlertTriangle };
  return { label: "CRITICAL — Review Required", color: "bg-red-600", textColor: "text-red-700 dark:text-red-400", borderColor: "border-red-200 dark:border-red-800", bgColor: "bg-red-50 dark:bg-red-950", icon: Zap };
}

function getUrgencyBadgeVariant(urgency: string): "default" | "secondary" | "destructive" | "outline" {
  switch (urgency) {
    case "critical": return "destructive";
    case "high": return "destructive";
    case "medium": return "secondary";
    default: return "outline";
  }
}

function getScoreBadgeClasses(score: number): string {
  if (score <= 25) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300";
  if (score <= 50) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300";
  if (score <= 75) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300";
  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300";
}

// ── Main Component ─────────────────────────────────────────────────
export default function MedicalDocumentsSection({ userId }: MedicalDocumentsSectionProps) {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing documents from Firestore on mount
  useEffect(() => {
    async function fetchDocs() {
      if (!userId) return;
      try {
        const docs = await getPatientDocuments(userId);
        setDocuments(docs);
      } catch (err) {
        console.error("Error fetching patient documents:", err);
      }
    }
    fetchDocs();
  }, [userId]);

  // Compute max score across all documents (cumulative worst-case)
  const maxScore = documents.length > 0
    ? Math.max(...documents.map((d) => d.ocrScore))
    : 0;
  const worstUrgency = documents.length > 0
    ? documents.reduce((worst, d) => {
        const order = ["low", "medium", "high", "critical"];
        return order.indexOf(d.ocrUrgency) > order.indexOf(worst) ? d.ocrUrgency : worst;
      }, "low")
    : "low";
  const allFlags = [...new Set(documents.flatMap((d) => d.ocrFlags))];
  const latestSummary = documents.length > 0
    ? documents.reduce((latest, d) => {
        if (d.ocrScore === maxScore) return d.ocrSummary;
        return latest;
      }, documents[0].ocrSummary)
    : "";

  const severity = getSeverityZone(maxScore);
  const SeverityIcon = severity.icon;

  // ── Upload + OCR Handler ──────────────────────────────────────
  const handleFileDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!userId) {
        setError("You must be logged in to upload documents.");
        return;
      }
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0]; // Process one file at a time
      setError(null);
      setIsUploading(true);
      setUploadProgress(0);

      try {
        // Step 1: Upload to Uploadcare
        const uploaded = await uploadClient.uploadFile(file, {
          onProgress: (progress: any) => {
            if (progress.isComputable && progress.value !== undefined) {
              setUploadProgress(Math.round(progress.value * 100));
            }
          },
        });

        const fileUrl = `https://ucarecdn.com/${uploaded.uuid}/`;
        setIsUploading(false);
        setIsAnalyzing(true);

        // Step 2: Call OCR API
        const ocrResponse = await fetch("/api/ocr-flag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl, mimeType: file.type }),
        });

        const ocrResult: OcrResult = await ocrResponse.json();

        // Step 3: Save to Firestore
        const docData: PatientDocument = {
          fileName: file.name,
          fileUrl,
          mimeType: file.type,
          uploadedAt: new Date(),
          ocrScore: ocrResult.score,
          ocrFlags: ocrResult.flags,
          ocrSummary: ocrResult.summary,
          ocrUrgency: ocrResult.urgency,
        };

        await savePatientDocument(userId, docData);

        // Step 4: Update local state
        setDocuments((prev) => [docData, ...prev]);
        setIsAnalyzing(false);
      } catch (err) {
        console.error("Upload/analysis error:", err);
        setError("Failed to upload or analyze the document. Please try again.");
        setIsUploading(false);
        setIsAnalyzing(false);
      }
    },
    [userId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "application/pdf": [".pdf"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1,
    disabled: isUploading || isAnalyzing,
  });

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="pb-6">
      <Card className={`${severity.borderColor} ${severity.bgColor} transition-all duration-500`}>
        <CardHeader>
          <CardTitle className={`text-xl font-bold ${severity.textColor} flex items-center gap-2`}>
            <Shield className="h-5 w-5" />
            Medical Documents & Case Severity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ── A) Severity Meter ──────────────────────────────── */}
          {documents.length > 0 && (
            <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SeverityIcon className={`h-5 w-5 ${severity.textColor}`} />
                  <span className={`font-semibold text-lg ${severity.textColor}`}>
                    {severity.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {maxScore}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">/100</span>
                  <Badge variant={getUrgencyBadgeVariant(worstUrgency)} className="ml-2 uppercase text-xs">
                    {worstUrgency}
                  </Badge>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-4 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                {/* Color zone background gradient */}
                <div className="absolute inset-0 flex">
                  <div className="w-1/4 bg-green-500/20" />
                  <div className="w-1/4 bg-yellow-400/20" />
                  <div className="w-1/4 bg-orange-500/20" />
                  <div className="w-1/4 bg-red-600/20" />
                </div>
                {/* Active bar */}
                <div
                  className={`h-full ${severity.color} rounded-full transition-all duration-1000 ease-out relative`}
                  style={{ width: `${maxScore}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
                </div>
              </div>

              {/* Zone labels */}
              <div className="flex justify-between mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                <span>Stable</span>
                <span>Monitoring</span>
                <span>Attention</span>
                <span>Critical</span>
              </div>

              {/* Flags */}
              {allFlags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {allFlags.map((flag, i) => (
                    <Badge
                      key={i}
                      variant="destructive"
                      className="text-[10px] px-2 py-0.5 font-medium"
                    >
                      {flag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Summary */}
              {latestSummary && (
                <p className="text-sm italic text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
                  &ldquo;{latestSummary}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* ── B) Upload Zone ─────────────────────────────────── */}
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-all duration-300 group
              ${isDragActive
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.01]"
                : "border-gray-300 dark:border-gray-600 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
              }
              ${(isUploading || isAnalyzing) ? "pointer-events-none opacity-60" : ""}
            `}
          >
            <input {...getInputProps()} />

            {isUploading ? (
              <div className="space-y-3">
                <Loader2 className="h-10 w-10 mx-auto text-violet-500 animate-spin" />
                <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                  Uploading document... {uploadProgress}%
                </p>
                <div className="w-48 mx-auto h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="space-y-3">
                <div className="relative mx-auto w-10 h-10">
                  <Loader2 className="h-10 w-10 text-violet-500 animate-spin" />
                  <FileText className="h-4 w-4 text-violet-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                  Analyzing document with AI...
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Extracting medical indicators & severity score
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-gray-400 group-hover:text-violet-500 transition-colors duration-300" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isDragActive ? "Drop your document here" : "Drop files here or click to browse"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  JPG, PNG, WebP, or PDF • Max 10MB
                </p>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="h-4 w-4 text-red-400 hover:text-red-600" />
              </button>
            </div>
          )}

          {/* ── D) Uploaded Documents List ─────────────────────── */}
          {documents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Uploaded Documents ({documents.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc, i) => {
                  const docZone = getSeverityZone(doc.ocrScore);
                  return (
                    <div
                      key={i}
                      className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {doc.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${getScoreBadgeClasses(doc.ocrScore)}`}>
                            {doc.ocrScore}
                          </span>
                          <Badge variant={getUrgencyBadgeVariant(doc.ocrUrgency)} className="text-[10px] uppercase">
                            {doc.ocrUrgency}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs italic text-gray-500 dark:text-gray-400 line-clamp-2">
                        {doc.ocrSummary}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-400">
                          {doc.uploadedAt?.toDate
                            ? doc.uploadedAt.toDate().toLocaleDateString("en-IN", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : doc.uploadedAt instanceof Date
                            ? doc.uploadedAt.toLocaleDateString("en-IN", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "Just now"}
                        </span>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          View File →
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {documents.length === 0 && !isUploading && !isAnalyzing && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No documents uploaded yet. Upload a vet report or medical document to get an AI severity assessment.
              </p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
