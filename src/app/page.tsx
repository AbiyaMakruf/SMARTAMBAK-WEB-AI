"use client";

import React, { useState, useCallback } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { ModelResultCard } from "@/components/ModelResultCard";
import { HumanDecisionBox } from "@/components/HumanDecisionBox";
import { SingleModelInferenceResult } from "@/types/prediction";
import { Sparkles, Activity, Layers, RotateCcw, ShieldCheck, Cpu } from "lucide-react";

export default function Home() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Model states
  const [results, setResults] = useState<Record<string, SingleModelInferenceResult | null>>({
    model_1: null,
    model_2: null,
    model_3: null,
  });

  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({
    model_1: false,
    model_2: false,
    model_3: false,
  });

  // Human decision selected models
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  // Function to run parallel inference on 3 models
  const runInference = useCallback(async (file: File) => {
    setResults({
      model_1: null,
      model_2: null,
      model_3: null,
    });

    setLoadingStates({
      model_1: true,
      model_2: true,
      model_3: true,
    });

    setSelectedModels([]);

    const modelsToRun = [
      { id: "model_1", key: "multiclass", name: "Model 1: Multiclass" },
      { id: "model_2", key: "binaryclass", name: "Model 2: Binaryclass" },
      { id: "model_3", key: "oldmodel", name: "Model 3: Baseline (Old Model)" },
    ];

    await Promise.allSettled(
      modelsToRun.map(async (m) => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("conf", "0.25");
          formData.append("iou", "0.7");
          formData.append("imgsz", "640");

          const res = await fetch(`/api/predict?model=${m.id}`, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (!res.ok) {
            setResults((prev) => ({
              ...prev,
              [m.id]: {
                modelId: m.id as any,
                modelName: m.name,
                modelKey: m.key as any,
                status: "error",
                error: data.error || `HTTP error ${res.status}`,
              },
            }));
          } else {
            setResults((prev) => ({
              ...prev,
              [m.id]: data,
            }));
          }
        } catch (err: any) {
          setResults((prev) => ({
            ...prev,
            [m.id]: {
              modelId: m.id as any,
              modelName: m.name,
              modelKey: m.key as any,
              status: "error",
              error: err.message || "Network request failed",
            },
          }));
        } finally {
          setLoadingStates((prev) => ({
            ...prev,
            [m.id]: false,
          }));
        }
      })
    );
  }, []);

  // When a new image is selected/captured
  const handleImageSelected = (file: File, previewUrl: string) => {
    setImageFile(file);
    setImagePreviewUrl(previewUrl);
    runInference(file);
  };

  // Toggle model selection in verification
  const handleToggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  // Full reset for next sample
  const handleResetAll = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setResults({
      model_1: null,
      model_2: null,
      model_3: null,
    });
    setLoadingStates({
      model_1: false,
      model_2: false,
      model_3: false,
    });
    setSelectedModels([]);
  };

  const isAnyLoading = Object.values(loadingStates).some((v) => v);
  const hasAnyResult = Object.values(results).some((r) => r !== null);
  const isAllDone = !isAnyLoading && hasAnyResult && imageFile !== null;

  return (
    <div className="space-y-4 pb-20 pt-2">
      {/* Title & Status Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-emerald-950/30 border border-slate-800/80 p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              Sistem Deteksi & Komparasi 3 Model
            </h1>
            <p className="text-xs text-slate-400">
              Uji foto udang vs null image (bukan udang) untuk evaluasi akurasi 3 model AI.
            </p>
          </div>
          {imageFile && (
            <button
              onClick={handleResetAll}
              disabled={isAnyLoading}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/60 rounded-lg px-2.5 py-1.5 border border-slate-700/60 disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Step 1: Image Capture / Upload */}
      <CameraCapture onImageSelected={handleImageSelected} isProcessing={isAnyLoading} />

      {/* Step 2: 3 Model Output Visualization */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            Hasil Deteksi 3 Model Ultralytics
          </h2>
          {isAnyLoading ? (
            <span className="text-[11px] text-cyan-400 animate-pulse flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5 animate-spin text-cyan-400" /> Memproses 3 Model...
            </span>
          ) : isAllDone ? (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Deteksi Selesai
            </span>
          ) : null}
        </div>

        {/* Vertical cards stack */}
        <div className="space-y-3">
          {/* Model 1: Multiclass */}
          <ModelResultCard
            modelId="model_1"
            title="Model 1: Multiclass Detection"
            badge="5 Kelas Penyakit"
            description="Deteksi WSSV, Black Gill, Yellowhead, Healthy, dll."
            isLoading={loadingStates["model_1"]}
            result={results["model_1"]}
            imagePreviewUrl={imagePreviewUrl}
          />

          {/* Model 2: Binaryclass */}
          <ModelResultCard
            modelId="model_2"
            title="Model 2: Binary Detection"
            badge="Sehat vs Sakit"
            description="Klasifikasi cepat kondisi umum udang (Healthy / Diseased)."
            isLoading={loadingStates["model_2"]}
            result={results["model_2"]}
            imagePreviewUrl={imagePreviewUrl}
          />

          {/* Model 3: Baseline Old Model */}
          <ModelResultCard
            modelId="model_3"
            title="Model 3: Baseline Model"
            badge="Model Lama"
            description="Versi model sebelumnya sebagai acuan benchmarking."
            isLoading={loadingStates["model_3"]}
            result={results["model_3"]}
            imagePreviewUrl={imagePreviewUrl}
          />
        </div>
      </div>

      {/* Step 3: Human Verification Decision Box - ONLY APPEARS AFTER INFERENCE COMPLETES */}
      {isAllDone ? (
        <HumanDecisionBox
          imageFile={imageFile}
          imagePreviewUrl={imagePreviewUrl}
          results={results}
          selectedModels={selectedModels}
          onToggleModel={handleToggleModel}
          onSetSelectedModels={setSelectedModels}
          onSuccessSubmit={handleResetAll}
        />
      ) : isAnyLoading ? (
        <div className="rounded-2xl border border-dashed border-cyan-800/50 bg-cyan-950/20 p-5 text-center space-y-2">
          <Cpu className="mx-auto h-6 w-6 text-cyan-400 animate-spin" />
          <p className="text-xs text-cyan-300 font-semibold">
            Sedang menunggu hasil inferensi ketiga model...
          </p>
          <p className="text-[11px] text-slate-400">
            Form verifikasi akurasi akan otomatis muncul setelah deteksi ketiga model selesai.
          </p>
        </div>
      ) : null}
    </div>
  );
}
