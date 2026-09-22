"use client";

import React, { useState, useEffect, useRef } from "react";
import { ShrimpPredictionRecord, DetectionResult } from "@/types/prediction";
import { drawAnnotations, loadImage } from "@/lib/annotator";
import {
  X,
  Download,
  Trash2,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Hash,
  Clock,
  Eye,
  Cpu,
} from "lucide-react";

interface SampleDetailModalProps {
  record: ShrimpPredictionRecord | null;
  onClose: () => void;
  isAdmin: boolean;
  onDelete: (record: ShrimpPredictionRecord) => void;
  formatDate: (dateStr?: string) => string;
}

export function SampleDetailModal({
  record,
  onClose,
  isAdmin,
  onDelete,
  formatDate,
}: SampleDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"original" | "model_1" | "model_2" | "model_3">("original");
  const [isRendering, setIsRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper counts
  const m1Detections: DetectionResult[] = record?.model_1_output?.images?.[0]?.results || [];
  const m2Detections: DetectionResult[] = record?.model_2_output?.images?.[0]?.results || [];
  const m3Detections: DetectionResult[] = record?.model_3_output?.images?.[0]?.results || [];

  // Parse real shrimp count from notes or metadata
  let realCount: number | null = null;
  if (record?.model_1_output?.real_shrimp_count) {
    realCount = record.model_1_output.real_shrimp_count;
  } else if (record?.notes) {
    const match = record.notes.match(/\[(?:Jumlah Udang Riil|Riil):\s*(\d+)/i);
    if (match && match[1]) {
      realCount = parseInt(match[1]);
    }
  }

  // Draw on canvas when tab changes
  useEffect(() => {
    if (!record || !record.image_url) return;

    let isMounted = true;
    setIsRendering(true);

    const render = async () => {
      try {
        const img = await loadImage(record.image_url);
        if (!isMounted) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        if (activeTab === "original") {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, w, h);
        } else if (activeTab === "model_1") {
          drawAnnotations(canvas, img, m1Detections, "Model 1: Multiclass");
        } else if (activeTab === "model_2") {
          drawAnnotations(canvas, img, m2Detections, "Model 2: Binaryclass");
        } else if (activeTab === "model_3") {
          drawAnnotations(canvas, img, m3Detections, "Model 3: Baseline");
        }
      } catch (err) {
        console.warn("Canvas render error:", err);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    };

    render();

    return () => {
      isMounted = false;
    };
  }, [record, activeTab]);

  if (!record) return null;

  const currentDetections =
    activeTab === "model_1"
      ? m1Detections
      : activeTab === "model_2"
      ? m2Detections
      : activeTab === "model_3"
      ? m3Detections
      : [];

  const handleDownloadActiveView = () => {
    const canvas = canvasRef.current;
    if (activeTab === "original") {
      const a = document.createElement("a");
      a.href = record.image_url;
      a.target = "_blank";
      a.download = `shrimp_raw_${record.id?.substring(0, 8) || "sample"}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (canvas) {
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `shrimp_${activeTab}_${record.id?.substring(0, 8) || "sample"}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        "image/jpeg",
        0.9
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4">
      <div className="flex flex-col w-full max-w-lg max-h-[92vh] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-400" />
              Detail & Visualisasi Hasil 3 Model AI
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {formatDate(record.created_at)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* View Selector Tabs (Original vs AI 1, 2, 3) */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("original")}
              className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                activeTab === "original"
                  ? "bg-slate-800 text-cyan-300 shadow-sm border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Foto Asli
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("model_1")}
              className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                activeTab === "model_1"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-700/80 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Model 1 <span className="text-[9px] opacity-75">({m1Detections.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("model_2")}
              className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                activeTab === "model_2"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-700/80 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Model 2 <span className="text-[9px] opacity-75">({m2Detections.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("model_3")}
              className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                activeTab === "model_3"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-700/80 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Model 3 <span className="text-[9px] opacity-75">({m3Detections.length})</span>
            </button>
          </div>

          {/* Interactive Canvas Container */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-700 bg-black flex items-center justify-center">
            {isRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                <Cpu className="h-6 w-6 text-cyan-400 animate-spin" />
              </div>
            )}
            <canvas ref={canvasRef} className="h-full w-full object-contain" />

            <div className="absolute bottom-2 left-2 rounded-md bg-slate-950/80 backdrop-blur border border-slate-700/60 px-2 py-0.5 text-[10px] text-slate-300 flex items-center gap-1.5">
              <span className="font-semibold text-cyan-300">
                {activeTab === "original"
                  ? "Foto Asli Lapangan"
                  : activeTab === "model_1"
                  ? "Hasil Model 1 (Multiclass)"
                  : activeTab === "model_2"
                  ? "Hasil Model 2 (Binaryclass)"
                  : "Hasil Model 3 (Baseline)"}
              </span>
              {activeTab !== "original" && (
                <span>• {currentDetections.length} Box</span>
              )}
            </div>
          </div>

          {/* Active Model Detection Breakdown */}
          {activeTab !== "original" && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                Daftar Deteksi Bounding Box:
              </span>
              {currentDetections.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Model tidak mendeteksi objek udang (0 bounding box / Null).
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {currentDetections.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-slate-900 border border-slate-700/70 px-2.5 py-1 text-xs flex items-center gap-1.5"
                    >
                      <span className="font-bold text-slate-200">{d.name}</span>
                      <span className="font-mono text-cyan-400 text-[11px]">
                        {Math.round(d.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ground Truth & Count Information */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ground Truth Objek:</span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  record.human_is_shrimp ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {record.human_is_shrimp ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Objek Udang Asli
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" /> Bukan Udang (Null Image)
                  </>
                )}
              </span>
            </div>

            {realCount !== null && (
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
                <span className="text-slate-400 flex items-center gap-1">
                  <Hash className="h-3 w-3 text-cyan-400" /> Jumlah Udang Riil:
                </span>
                <span className="font-bold font-mono text-cyan-300">
                  {realCount} Ekor Udang
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
              <span className="text-slate-400">Model Disetujui:</span>
              <div className="flex flex-wrap gap-1">
                {(record.selected_models || []).length > 0 ? (
                  (record.selected_models || []).map((m) => (
                    <span
                      key={m}
                      className="rounded bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 text-emerald-300 text-[10px] font-semibold"
                    >
                      {m.replace("model_", "M")}
                    </span>
                  ))
                ) : (
                  <span className="text-rose-400 italic text-[11px]">Semua model salah</span>
                )}
              </div>
            </div>

            {/* Field Notes */}
            {record.notes && (
              <div className="border-t border-slate-800/80 pt-2 space-y-1">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <FileText className="h-3 w-3 text-slate-400" /> Catatan Lapangan / Evaluasi:
                </span>
                <p className="rounded-lg bg-slate-900/90 border border-slate-800 p-2 text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                  {record.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/95 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadActiveView}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              {activeTab === "original" ? "Unduh Foto Asli" : `Unduh AI ${activeTab.replace("model_", "M")}`}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Tutup
            </button>
          </div>

          {/* Admin Delete Action */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => onDelete(record)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/70 py-2 text-xs font-bold text-rose-300 transition-all active:scale-[0.98]"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              Hapus Sampel Ini Dari Database (Admin)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
