"use client";

import React, { useState } from "react";
import {
  SingleModelInferenceResult,
  DetectionResult,
} from "@/types/prediction";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
  Layers,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface ModelResultCardProps {
  modelId: "model_1" | "model_2" | "model_3";
  title: string;
  badge: string;
  description: string;
  isLoading: boolean;
  result?: SingleModelInferenceResult | null;
  imagePreviewUrl?: string | null;
}

export function ModelResultCard({
  modelId,
  title,
  badge,
  description,
  isLoading,
  result,
  imagePreviewUrl,
}: ModelResultCardProps) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);

  // Helper to choose badge color according to detection class
  const getClassColor = (className: string) => {
    const lower = className.toLowerCase();
    if (lower.includes("healthy") || lower.includes("sehat")) {
      return {
        border: "border-emerald-500",
        bg: "bg-emerald-500/20",
        text: "text-emerald-300",
        boxBorder: "border-emerald-400",
        boxBg: "bg-emerald-500/15",
      };
    }
    if (lower.includes("wssv") || lower.includes("sakit") || lower.includes("disease")) {
      return {
        border: "border-rose-500",
        bg: "bg-rose-500/20",
        text: "text-rose-300",
        boxBorder: "border-rose-500",
        boxBg: "bg-rose-500/15",
      };
    }
    if (lower.includes("black-gill") || lower.includes("insang")) {
      return {
        border: "border-amber-500",
        bg: "bg-amber-500/20",
        text: "text-amber-300",
        boxBorder: "border-amber-400",
        boxBg: "bg-amber-500/15",
      };
    }
    if (lower.includes("yellowhead") || lower.includes("kuning")) {
      return {
        border: "border-yellow-400",
        bg: "bg-yellow-400/20",
        text: "text-yellow-200",
        boxBorder: "border-yellow-400",
        boxBg: "bg-yellow-400/15",
      };
    }
    return {
      border: "border-cyan-500",
      bg: "bg-cyan-500/20",
      text: "text-cyan-300",
      boxBorder: "border-cyan-400",
      boxBg: "bg-cyan-500/15",
    };
  };

  const imageData = result?.data?.images?.[0];
  const detections: DetectionResult[] = imageData?.results || [];
  const speed = imageData?.speed;
  const imageShape = imageData?.shape || [512, 512]; // [height, width]

  // Coordinate normalization helper
  const getNormalizedBox = (box: DetectionResult["box"]) => {
    let { x1, y1, x2, y2 } = box;
    if (x1 > 1 || x2 > 1 || y1 > 1 || y2 > 1) {
      const imgH = imageShape[0] || 512;
      const imgW = imageShape[1] || 512;
      x1 = x1 / imgW;
      x2 = x2 / imgW;
      y1 = y1 / imgH;
      y2 = y2 / imgH;
    }
    return {
      left: Math.max(0, Math.min(100, x1 * 100)),
      top: Math.max(0, Math.min(100, y1 * 100)),
      width: Math.max(0, Math.min(100, (x2 - x1) * 100)),
      height: Math.max(0, Math.min(100, (y2 - y1) * 100)),
    };
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur transition-all duration-200 overflow-hidden hover:border-slate-700">
      {/* Header */}
      <div className="flex items-start justify-between p-3.5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-100 text-sm leading-snug">{title}</h3>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 border border-slate-700">
              {badge}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
        </div>

        {/* Status Indicator */}
        {result?.status === "success" && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
              detections.length > 0
                ? "bg-cyan-950/60 text-cyan-300 border-cyan-800/60"
                : "bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            {detections.length > 0 ? (
              <>
                <Layers className="h-3 w-3 text-cyan-400" /> {detections.length} Box
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span> 0 Box (Null)
              </>
            )}
          </span>
        )}
      </div>

      {/* Body Content */}
      <div className="p-3.5 space-y-3">
        {isLoading ? (
          /* Skeleton Loading Indicator */
          <div className="space-y-3 animate-pulse">
            <div className="aspect-[4/3] w-full rounded-xl bg-slate-800/70 flex flex-col items-center justify-center gap-2">
              <Cpu className="h-7 w-7 text-cyan-400 animate-spin" />
              <span className="text-xs text-slate-400">Menjalankan inferensi model...</span>
            </div>
            <div className="h-4 w-3/4 rounded bg-slate-800"></div>
          </div>
        ) : result?.status === "error" ? (
          /* Error State */
          <div className="rounded-xl border border-rose-800/60 bg-rose-950/20 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-medium text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Model Gagal Menjawab / Offline
            </div>
            <p className="text-[11px] text-rose-300/80 font-mono break-words leading-relaxed">
              {result.error || "Gagal menghubungi endpoint Google Cloud Run."}
            </p>
            {result.durationMs && (
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Latensi: {result.durationMs} ms
              </div>
            )}
          </div>
        ) : result?.status === "success" && imagePreviewUrl ? (
          /* Success Detection Output */
          <div className="space-y-2.5">
            {/* Visual preview with Bounding Box Overlay */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-700 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreviewUrl}
                alt="Hasil Deteksi"
                className="h-full w-full object-contain pointer-events-none"
              />

              {/* Bounding Box Overlays */}
              {showBoxes &&
                detections.map((det, index) => {
                  const styleColors = getClassColor(det.name);
                  const { left, top, width, height } = getNormalizedBox(det.box);

                  return (
                    <div
                      key={index}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                      }}
                      className={`absolute border-2 ${styleColors.boxBorder} ${styleColors.boxBg} transition-all pointer-events-none`}
                    >
                      {/* Floating detection label */}
                      <div
                        className={`absolute -top-5 left-0 rounded px-1 py-0.2 text-[10px] font-bold uppercase tracking-wider backdrop-blur ${styleColors.bg} ${styleColors.text} border ${styleColors.border} shadow-sm whitespace-nowrap`}
                      >
                        {det.name} {(det.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  );
                })}

              {/* Toggle Box overlay button */}
              {detections.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBoxes(!showBoxes)}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-slate-950/80 backdrop-blur px-2 py-1 text-[10px] font-medium text-slate-300 border border-slate-700 hover:text-white"
                >
                  {showBoxes ? (
                    <>
                      <EyeOff className="h-3 w-3" /> Sembunyikan Box
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" /> Tampilkan Box
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Detections List & Confidence Badges */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Layers className="h-3.5 w-3.5 text-cyan-400" />
                  {detections.length > 0
                    ? `Objek Terdeteksi (${detections.length})`
                    : "0 Bounding Box (Tidak Ada Objek Dideteksi)"}
                </span>
                {speed?.inference && (
                  <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                    <Clock className="h-3 w-3 text-emerald-400" />
                    {speed.inference.toFixed(1)} ms
                  </span>
                )}
              </div>

              {detections.length === 0 ? (
                <div className="rounded-lg bg-slate-800/40 border border-slate-800 p-2.5 text-center text-xs text-slate-400">
                  <span className="text-slate-300 font-medium">Output Bersih (Null Bounding Box)</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Model tidak memunculkan bounding box pada gambar ini.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detections.map((det, i) => {
                    const color = getClassColor(det.name);
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-1.5 rounded-lg border ${color.border} ${color.bg} px-2.5 py-1 text-xs`}
                      >
                        <span className={`font-semibold capitalize ${color.text}`}>
                          {det.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-300 bg-slate-900/60 px-1.5 py-0.5 rounded">
                          {(det.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Raw JSON inspection toggle */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="flex items-center justify-between w-full text-[11px] text-slate-500 hover:text-slate-300 py-1"
              >
                <span>Lihat Raw JSON Response</span>
                {showRawJson ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showRawJson && (
                <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-slate-950 p-2 font-mono text-[10px] text-slate-400 border border-slate-800">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ) : (
          /* Empty / Initial State */
          <div className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-xs text-slate-500">
            Ambil atau pilih foto udang untuk melihat hasil deteksi model.
          </div>
        )}
      </div>
    </div>
  );
}
