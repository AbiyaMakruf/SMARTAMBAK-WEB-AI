"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UploadCloud,
  FileText,
  Loader2,
  Sparkles,
  Layers,
  HelpCircle,
} from "lucide-react";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { SingleModelInferenceResult, ShrimpPredictionRecord } from "@/types/prediction";

interface HumanDecisionBoxProps {
  imageFile: File | null;
  imagePreviewUrl: string | null;
  results: Record<string, SingleModelInferenceResult | null>;
  selectedModels: string[];
  onToggleModel: (modelId: string) => void;
  onSetSelectedModels: (modelIds: string[]) => void;
  onSuccessSubmit: () => void;
}

export function HumanDecisionBox({
  imageFile,
  imagePreviewUrl,
  results,
  selectedModels,
  onToggleModel,
  onSetSelectedModels,
  onSuccessSubmit,
}: HumanDecisionBoxProps) {
  // Ground truth: Is the real object a shrimp or non-shrimp (null image)?
  const [isShrimpGroundTruth, setIsShrimpGroundTruth] = useState<boolean>(true);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Model definitions
  const models = [
    { id: "model_1", label: "Model 1: Multiclass (Spesifik)", result: results["model_1"] },
    { id: "model_2", label: "Model 2: Binaryclass (Sehat/Sakit)", result: results["model_2"] },
    { id: "model_3", label: "Model 3: Baseline (Old Model)", result: results["model_3"] },
  ];

  // Helper to count detected boxes for a model
  const getBoxCount = (res: SingleModelInferenceResult | null) => {
    return res?.data?.images?.[0]?.results?.length || 0;
  };

  // Automatically compute smart suggestions whenever isShrimpGroundTruth changes
  useEffect(() => {
    const suggested: string[] = [];
    models.forEach((m) => {
      const boxCount = getBoxCount(m.result);
      if (isShrimpGroundTruth) {
        // Human says it's shrimp -> Model is accurate if it found at least 1 box
        if (boxCount > 0) suggested.push(m.id);
      } else {
        // Human says NOT shrimp (null image) -> Model is accurate if it produced 0 boxes!
        if (boxCount === 0) suggested.push(m.id);
      }
    });
    onSetSelectedModels(suggested);
  }, [isShrimpGroundTruth, results]);

  // Submit and save to Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      setSubmitStatus({
        type: "error",
        message: "Silakan pilih atau ambil foto sampel terlebih dahulu.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 9);
      const cleanFileName = imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `uploads/${timestamp}_${randomStr}_${cleanFileName}`;

      // 1. Upload to Supabase Storage
      let uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, imageFile, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadResult.error && STORAGE_BUCKET !== "shrimp-images") {
        const fallbackUpload = await supabase.storage.from("shrimp-images").upload(filePath, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });
        if (!fallbackUpload.error) {
          uploadResult = fallbackUpload;
        }
      }

      let publicImageUrl = "";
      if (!uploadResult.error) {
        const { data: publicUrlData } = supabase.storage
          .from(uploadResult.data?.fullPath ? STORAGE_BUCKET : "shrimp-images")
          .getPublicUrl(filePath);
        publicImageUrl = publicUrlData.publicUrl;
      } else {
        publicImageUrl = imagePreviewUrl || `https://storage.placeholder/smartambak_${timestamp}.jpg`;
      }

      // 2. Prepare payload
      const recordPayload: ShrimpPredictionRecord = {
        image_url: publicImageUrl,
        model_1_output: results["model_1"]?.data || null,
        model_2_output: results["model_2"]?.data || null,
        model_3_output: results["model_3"]?.data || null,
        human_is_shrimp: isShrimpGroundTruth,
        selected_models: selectedModels,
        notes: notes.trim() || undefined,
      };

      // 3. Insert record to Supabase DB 'shrimp_predictions'
      const { error: dbError } = await supabase.from("shrimp_predictions").insert([recordPayload]);

      if (dbError) {
        throw new Error(`Gagal menyimpan ke database Supabase: ${dbError.message}`);
      }

      setSubmitStatus({
        type: "success",
        message: "Data verifikasi dan foto berhasil disimpan ke server Supabase!",
      });

      setNotes("");

      setTimeout(() => {
        onSuccessSubmit();
      }, 1500);
    } catch (err: any) {
      console.error("Submission error:", err);
      setSubmitStatus({
        type: "error",
        message: err.message || "Terjadi kesalahan saat menyimpan data.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-cyan-800/80 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-4 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 leading-tight">
              Verifikasi Output Model (Human Validation)
            </h3>
            <span className="text-[10px] text-slate-400">
              Evaluasi kebenaran deteksi udang vs null images (bukan udang)
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Ground Truth Object Selection */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-cyan-400" />
            1. Apa objek sebenarnya pada gambar ini?
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsShrimpGroundTruth(true)}
              className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-semibold border transition-all ${
                isShrimpGroundTruth
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-sm"
                  : "bg-slate-900/40 text-slate-400 border-slate-800 hover:bg-slate-800/40"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Udang Asli (Objek Target)
            </button>

            <button
              type="button"
              onClick={() => setIsShrimpGroundTruth(false)}
              className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-semibold border transition-all ${
                !isShrimpGroundTruth
                  ? "bg-rose-500/20 text-rose-300 border-rose-500 shadow-sm"
                  : "bg-slate-900/40 text-slate-400 border-slate-800 hover:bg-slate-800/40"
              }`}
            >
              <XCircle className="h-4 w-4 text-rose-400" />
              Bukan Udang (Null Image)
            </button>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-950/60 rounded-lg p-2 border border-slate-800/60">
            {isShrimpGroundTruth ? (
              <span>
                💡 <strong className="text-emerald-300">Ekspektasi:</strong> Model harus mendeteksi udang dan memunculkan bounding box (True Positive).
              </span>
            ) : (
              <span>
                💡 <strong className="text-rose-300">Ekspektasi:</strong> Model harus bersih (0 bounding box). Jika model memunculkan box pada non-udang, itu adalah <em className="underline text-amber-300">False Positive</em> yang dapat dijadikan dataset training YOLO Null Images.
              </span>
            )}
          </div>
        </div>

        {/* Step 2: Per-Model Accuracy Checkboxes with Dynamic Diagnosis */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              2. Evaluasi Akurasi Masing-Masing Model:
            </span>
            <span className="text-[10px] text-slate-500 font-normal">Centang jika hasil sesuai</span>
          </label>

          <div className="space-y-2">
            {models.map((m) => {
              const boxCount = getBoxCount(m.result);
              const isChecked = selectedModels.includes(m.id);

              // Determine evaluation status
              let evalBadge = {
                title: "",
                desc: "",
                badgeClass: "",
                isPositive: false,
              };

              if (isShrimpGroundTruth) {
                if (boxCount > 0) {
                  evalBadge = {
                    title: "Akurat (True Positive)",
                    desc: `Berhasil mendeteksi ${boxCount} box udang`,
                    badgeClass: "bg-emerald-950/70 text-emerald-300 border-emerald-700/60",
                    isPositive: true,
                  };
                } else {
                  evalBadge = {
                    title: "Salah / Luput (False Negative)",
                    desc: "Gagal mendeteksi udang asli (0 box)",
                    badgeClass: "bg-rose-950/70 text-rose-300 border-rose-700/60",
                    isPositive: false,
                  };
                }
              } else {
                // Non-shrimp sample
                if (boxCount === 0) {
                  evalBadge = {
                    title: "Akurat (True Negative)",
                    desc: "Output bersih tanpa bounding box (Null Berhasil)",
                    badgeClass: "bg-emerald-950/70 text-emerald-300 border-emerald-700/60",
                    isPositive: true,
                  };
                } else {
                  evalBadge = {
                    title: "Salah Deteksi (False Positive)",
                    desc: `Salah sasaran! Mendeteksi ${boxCount} box pada objek bukan udang`,
                    badgeClass: "bg-amber-950/70 text-amber-300 border-amber-700/60",
                    isPositive: false,
                  };
                }
              }

              return (
                <div
                  key={m.id}
                  onClick={() => onToggleModel(m.id)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${
                    isChecked
                      ? "border-cyan-500/80 bg-cyan-950/20 ring-1 ring-cyan-500/40"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">{m.label}</span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${evalBadge.badgeClass}`}
                        >
                          {evalBadge.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Layers className="h-3 w-3 text-cyan-400" />
                        Hasil Model: <span className="font-semibold text-slate-300">{boxCount} Box</span> — {evalBadge.desc}
                      </p>
                    </div>

                    <label className="relative flex items-center pt-0.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleModel(m.id)}
                        className="h-4 w-4 rounded border-slate-700 text-cyan-600 focus:ring-0"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Optional Notes */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-400" /> Catatan Sampel / Pengujian (Opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: Pengujian null image dengan foto lumut tambak, model 1 sempat mendeteksi wssv..."
            rows={2}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          ></textarea>
        </div>

        {/* Submit Status Banner */}
        {submitStatus && (
          <div
            className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
              submitStatus.type === "success"
                ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                : "border-rose-700 bg-rose-950/40 text-rose-300"
            }`}
          >
            {submitStatus.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{submitStatus.message}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !imageFile}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Menyimpan ke Server Supabase...
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" />
              Submit & Simpan Rekam Verifikasi
            </>
          )}
        </button>
      </form>
    </div>
  );
}
