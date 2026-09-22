"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ShrimpPredictionRecord,
  DetailedReportStats,
  ModelMetricDetail,
} from "@/types/prediction";
import JSZip from "jszip";
import { SampleDetailModal } from "@/components/SampleDetailModal";
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  Layers,
  ChevronRight,
  X,
  FileQuestion,
  Sparkles,
  AlertTriangle,
  FileArchive,
  Filter,
  Eye,
  Activity,
  Zap,
  Trash2,
  Lock,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  Hash,
} from "lucide-react";

export default function ReportPage() {
  const [records, setRecords] = useState<ShrimpPredictionRecord[]>([]);
  const [filterType, setFilterType] = useState<"all" | "errors" | "null_images" | "shrimp">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isZipping, setIsZipping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ShrimpPredictionRecord | null>(null);

  // Admin authentication state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminLoginPasswordInput, setAdminLoginPasswordInput] = useState("");
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);

  // Single sample delete state
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<ShrimpPredictionRecord | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Password-protected reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Computed detailed analytics
  const [stats, setStats] = useState<DetailedReportStats>({
    totalSamples: 0,
    totalShrimp: 0,
    totalNotShrimp: 0,
    totalErroneousSamples: 0,
    models: {
      model_1: {
        modelId: "model_1",
        name: "Model 1 (Multiclass)",
        accuracy: 0,
        totalEvaluated: 0,
        agreedCount: 0,
        errorCount: 0,
        falsePositiveCount: 0,
        falseNegativeCount: 0,
        avgLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
      },
      model_2: {
        modelId: "model_2",
        name: "Model 2 (Binaryclass)",
        accuracy: 0,
        totalEvaluated: 0,
        agreedCount: 0,
        errorCount: 0,
        falsePositiveCount: 0,
        falseNegativeCount: 0,
        avgLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
      },
      model_3: {
        modelId: "model_3",
        name: "Model 3 (Baseline)",
        accuracy: 0,
        totalEvaluated: 0,
        agreedCount: 0,
        errorCount: 0,
        falsePositiveCount: 0,
        falseNegativeCount: 0,
        avgLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
      },
    },
    diseaseBreakdown: {},
  });

  // Calculate stats from rows
  const computeStats = (rows: ShrimpPredictionRecord[]): DetailedReportStats => {
    let totalShrimp = 0;
    let totalNotShrimp = 0;
    let totalErroneousSamples = 0;

    const modelKeys = ["model_1", "model_2", "model_3"] as const;
    const modelStats: Record<string, {
      agreed: number;
      errors: number;
      fp: number; // false positive: box > 0 when not shrimp
      fn: number; // false negative: box == 0 when shrimp
      latencies: number[];
    }> = {
      model_1: { agreed: 0, errors: 0, fp: 0, fn: 0, latencies: [] },
      model_2: { agreed: 0, errors: 0, fp: 0, fn: 0, latencies: [] },
      model_3: { agreed: 0, errors: 0, fp: 0, fn: 0, latencies: [] },
    };

    const diseaseBreakdown: Record<string, number> = {};

    rows.forEach((rec) => {
      const isShrimp = rec.human_is_shrimp;
      if (isShrimp) totalShrimp++;
      else totalNotShrimp++;

      let hasAnyErrorOnThisSample = false;
      const agreedModels = rec.selected_models || [];

      modelKeys.forEach((mId) => {
        const output = rec[`${mId}_output` as keyof ShrimpPredictionRecord] as any;
        const boxes = output?.images?.[0]?.results || [];
        const boxCount = boxes.length;
        const latency = output?.images?.[0]?.speed?.inference || output?.networkTime ? (output.networkTime * 1000) : null;
        if (typeof latency === "number" && latency > 0) {
          modelStats[mId].latencies.push(latency);
        }

        // Count disease classes from Model 1 (or any model)
        boxes.forEach((det: any) => {
          if (det.name) {
            const cls = det.name.toLowerCase();
            diseaseBreakdown[cls] = (diseaseBreakdown[cls] || 0) + 1;
          }
        });

        // Evaluation
        const isAgreed = agreedModels.includes(mId);
        if (isAgreed) {
          modelStats[mId].agreed++;
        } else {
          modelStats[mId].errors++;
          hasAnyErrorOnThisSample = true;
        }

        if (!isShrimp && boxCount > 0) {
          modelStats[mId].fp++;
        }
        if (isShrimp && boxCount === 0) {
          modelStats[mId].fn++;
        }
      });

      if (hasAnyErrorOnThisSample || !isShrimp) {
        totalErroneousSamples++;
      }
    });

    const total = rows.length;

    const buildMetric = (id: "model_1" | "model_2" | "model_3", name: string): ModelMetricDetail => {
      const data = modelStats[id];
      const acc = total > 0 ? Math.round((data.agreed / total) * 100) : 0;
      const lats = data.latencies;
      const avgLat = lats.length > 0 ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
      const minLat = lats.length > 0 ? Math.round(Math.min(...lats)) : 0;
      const maxLat = lats.length > 0 ? Math.round(Math.max(...lats)) : 0;

      return {
        modelId: id,
        name,
        accuracy: acc,
        totalEvaluated: total,
        agreedCount: data.agreed,
        errorCount: data.errors,
        falsePositiveCount: data.fp,
        falseNegativeCount: data.fn,
        avgLatencyMs: avgLat,
        minLatencyMs: minLat,
        maxLatencyMs: maxLat,
      };
    };

    return {
      totalSamples: total,
      totalShrimp,
      totalNotShrimp,
      totalErroneousSamples,
      models: {
        model_1: buildMetric("model_1", "Model 1: Multiclass"),
        model_2: buildMetric("model_2", "Model 2: Binaryclass"),
        model_3: buildMetric("model_3", "Model 3: Baseline"),
      },
      diseaseBreakdown,
    };
  };

  // Fetch prediction history from Supabase
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from("shrimp_predictions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows: ShrimpPredictionRecord[] = data || [];
      setRecords(rows);
      setStats(computeStats(rows));
    } catch (err: any) {
      console.error("Fetch report error:", err);
      setErrorMsg(err.message || "Gagal memuat data laporan dari Supabase");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered records based on active tab
  const filteredRecords = records.filter((r) => {
    if (filterType === "all") return true;
    if (filterType === "shrimp") return r.human_is_shrimp;
    if (filterType === "null_images") return !r.human_is_shrimp;
    if (filterType === "errors") {
      // Return records where at least one model was NOT selected, OR it was a null image with false positives
      const selected = r.selected_models || [];
      return selected.length < 3 || !r.human_is_shrimp;
    }
    return true;
  });

  // 1-Click Download ZIP for YOLO Null Images Training Dataset
  const handleDownloadYoloNullDataset = async () => {
    // Get all records that represent False Positives or Null Images (Bukan Udang)
    const targetRecords = records.filter((r) => !r.human_is_shrimp || (r.selected_models || []).length < 3);

    if (targetRecords.length === 0) {
      alert("Belum ada sampel foto salah deteksi atau null images untuk didownload.");
      return;
    }

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder("images");
      const labelFolder = zip.folder("labels");

      let count = 0;
      for (const rec of targetRecords) {
        count++;
        const filename = `null_sample_${String(count).padStart(3, "0")}`;
        try {
          const res = await fetch(rec.image_url);
          if (res.ok) {
            const blob = await res.blob();
            imgFolder?.file(`${filename}.jpg`, blob);
            // In YOLO format, background / null images are represented by an EMPTY .txt file!
            labelFolder?.file(`${filename}.txt`, "");
          }
        } catch (e) {
          console.warn("Error fetching image for zip:", rec.image_url, e);
        }
      }

      // Add YOLO dataset config yaml
      const datasetYaml = `# YOLO Background / Null Images Dataset Config
path: ./yolo_null_dataset
train: images
val: images

# Classes
nc: 5
names: ['black-gill', 'healthy', 'wssv', 'wssv-black-gill', 'yellowhead']
`;
      zip.file("dataset.yaml", datasetYaml);

      // Add README explaining how to train with null images
      const readmeText = `=== YOLO NULL IMAGES (BACKGROUND DATASET) ===
Total Foto: ${count} sampel
Tujuan: Melatih model YOLO agar mengenali objek non-udang (lumut, air, pakan, tangan) sehingga TIDAK memunculkan false positive bounding box.

Dalam standar YOLO Ultralytics, background image ditandai dengan file .txt kosong di folder labels/.
Perintah training rekomendasi:
yolo detect train data=dataset.yaml model=yolov8n.pt epochs=50 imgsz=640
`;
      zip.file("README.txt", readmeText);

      // Generate zip and trigger download
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `yolo_null_dataset_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("ZIP download error:", err);
      alert("Gagal membuat file ZIP: " + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  // Helper single file download
  const handleDownloadSingleImage = (url: string, id: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.download = `shrimp_sample_${id.substring(0, 8)}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Reset data handler with password authentication
  const handleResetData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordInput) {
      setResetError("Silakan masukkan password reset.");
      return;
    }
    setIsResetting(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      const res = await fetch("/api/report/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Password salah atau akses ditolak.");
      }
      setResetSuccess("Seluruh data laporan berhasil direset!");
      setResetPasswordInput("");
      setTimeout(() => {
        setIsResetModalOpen(false);
        setResetSuccess(null);
        fetchData();
      }, 1200);
    } catch (err: any) {
      setResetError(err.message || "Gagal mereset data.");
    } finally {
      setIsResetting(false);
    }
  };

  // Restore admin session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAdmin = sessionStorage.getItem("smartambak_admin");
      const savedPass = sessionStorage.getItem("smartambak_admin_pass");
      if (savedAdmin === "true" && savedPass) {
        setIsAdmin(true);
        setAdminPassword(savedPass);
      }
    }
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminLoginPasswordInput) {
      setAdminLoginError("Silakan masukkan kata sandi admin.");
      return;
    }
    setIsVerifyingAdmin(true);
    setAdminLoginError(null);
    try {
      const res = await fetch("/api/report/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminLoginPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kata sandi admin salah.");
      }
      setIsAdmin(true);
      setAdminPassword(adminLoginPasswordInput);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("smartambak_admin", "true");
        sessionStorage.setItem("smartambak_admin_pass", adminLoginPasswordInput);
      }
      setIsAdminLoginModalOpen(false);
      setAdminLoginPasswordInput("");
    } catch (err: any) {
      setAdminLoginError(err.message || "Gagal verifikasi admin.");
    } finally {
      setIsVerifyingAdmin(false);
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminPassword("");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("smartambak_admin");
      sessionStorage.removeItem("smartambak_admin_pass");
    }
  };

  const handleDeleteSingleRecord = async () => {
    if (!deleteConfirmRecord || !deleteConfirmRecord.id) return;
    setIsDeletingSingle(true);
    try {
      const res = await fetch("/api/report/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deleteConfirmRecord.id,
          password: adminPassword || "Abiyajr11",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus rekam sampel.");
      }
      const updated = records.filter((r) => r.id !== deleteConfirmRecord.id);
      setRecords(updated);
      setStats(computeStats(updated));
      if (selectedRecord?.id === deleteConfirmRecord.id) {
        setSelectedRecord(null);
      }
      setDeleteConfirmRecord(null);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus data.");
    } finally {
      setIsDeletingSingle(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 pt-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            Laporan Analisis & Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Metrik kesalahan model, latensi inferensi, dan ekspor dataset YOLO
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <div className="flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-700/60 rounded-xl px-2.5 py-1.5 text-xs text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-semibold text-[11px]">Admin Aktif</span>
              <button
                onClick={handleAdminLogout}
                className="ml-1 text-[10px] text-slate-400 hover:text-rose-300 underline"
                title="Keluar dari mode admin"
              >
                Keluar
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAdminLoginError(null);
                setAdminLoginPasswordInput("");
                setIsAdminLoginModalOpen(true);
              }}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700 rounded-xl px-2.5 py-2 font-medium active:scale-95 transition-all"
              title="Login admin untuk fitur hapus data"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              Mode Admin
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 rounded-xl px-3 py-2 active:scale-95 disabled:opacity-50 font-medium shadow-sm transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Segarkan
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/20 p-3.5 text-xs text-rose-300">
          <p className="font-semibold">Catatan Supabase:</p>
          <p className="font-mono text-[11px] mt-1">{errorMsg}</p>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Sampel Diuji</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100 font-mono">
              {stats.totalSamples}
            </span>
            <span className="text-[10px] text-slate-400">spesimen</span>
          </div>
          <div className="text-[10px] text-slate-500">
            {stats.totalShrimp} Udang Asli • {stats.totalNotShrimp} Null Images
          </div>
        </div>

        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/15 p-3.5 space-y-1">
          <span className="text-[11px] text-rose-300 font-medium">Sampel Salah / Null</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400 font-mono">
              {stats.totalErroneousSamples}
            </span>
            <span className="text-[10px] text-rose-300/80">foto</span>
          </div>
          <div className="text-[10px] text-rose-400/80">
            Siap untuk training YOLO background
          </div>
        </div>
      </div>

      {/* 1-Click YOLO Null Images Dataset Download Banner */}
      <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 to-slate-900 p-4 shadow-lg flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileArchive className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-100">Ekspor Dataset YOLO Null Images</h3>
            </div>
            <p className="text-[11px] text-slate-300">
              Download seluruh gambar non-udang / salah deteksi beserta file anotasi kosong (format background YOLO) dalam 1 arsip .zip.
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadYoloNullDataset}
          disabled={isZipping || stats.totalSamples === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs py-2.5 shadow-md shadow-cyan-500/20 active:scale-95 disabled:opacity-50 transition-all"
        >
          {isZipping ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" /> Sedang Mengompres File ZIP...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Download Dataset YOLO Null Images (1-Klik ZIP)
            </>
          )}
        </button>
      </div>

      {/* Dynamic Graphic Visualization: Accuracy & Error Comparison Chart */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            Grafik Komparasi Akurasi vs Tingkat Error
          </h2>
          <span className="text-[10px] text-slate-400 font-mono">Berdasarkan Validasi Manusia</span>
        </div>

        {/* Dynamic Bar Charts */}
        <div className="space-y-3">
          {[stats.models.model_1, stats.models.model_2, stats.models.model_3].map((m) => {
            const errRate = 100 - m.accuracy;
            return (
              <div key={m.modelId} className="space-y-1 rounded-xl bg-slate-950/60 p-2.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{m.name}</span>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-emerald-400 font-bold">{m.accuracy}% Akurat</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-rose-400 font-bold">{m.errorCount}x Salah</span>
                  </div>
                </div>

                {/* Stacked Progress Bar */}
                <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                    style={{ width: `${m.accuracy}%` }}
                    title={`Akurat: ${m.accuracy}%`}
                  ></div>
                  <div
                    className="h-full bg-rose-500/80 transition-all duration-700"
                    style={{ width: `${errRate}%` }}
                    title={`Salah: ${errRate}%`}
                  ></div>
                </div>

                {/* Breakdown details */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 font-mono">
                  <span>False Positive (Salah Sasaran): <strong className="text-amber-400">{m.falsePositiveCount}</strong></span>
                  <span>False Negative (Luput): <strong className="text-rose-400">{m.falseNegativeCount}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Graphic Visualization: Latency & Speed Chart */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            Grafik Waktu Inferensi (Latency Speed in ms)
          </h2>
          <span className="text-[10px] text-slate-400 font-mono">Cloud Run Inference</span>
        </div>

        <div className="space-y-2.5">
          {[stats.models.model_1, stats.models.model_2, stats.models.model_3].map((m) => {
            // max visual scale 1200ms
            const widthPct = Math.min(100, Math.max(5, (m.avgLatencyMs / 1200) * 100));
            return (
              <div key={m.modelId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{m.name}</span>
                  <span className="font-mono text-[11px] font-bold text-cyan-300">
                    {m.avgLatencyMs} ms <span className="text-[9px] text-slate-500">(rata-rata)</span>
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-700"
                    style={{ width: `${widthPct}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Disease Distribution Badge Cloud */}
      {Object.keys(stats.diseaseBreakdown).length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            Distribusi Diagnosis Penyakit Terdeteksi
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.diseaseBreakdown).map(([disease, count]) => (
              <div
                key={disease}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs"
              >
                <span className="capitalize text-slate-200">{disease}</span>
                <span className="rounded bg-cyan-950 px-1.5 py-0.2 text-[10px] font-bold text-cyan-400 font-mono border border-cyan-800/40">
                  {count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History List with Filter Tabs */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-cyan-400" />
            Daftar Sampel & Log ({filteredRecords.length})
          </h2>

          <button
            type="button"
            onClick={() => {
              setResetError(null);
              setResetSuccess(null);
              setResetPasswordInput("");
              setIsResetModalOpen(true);
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-400/90 hover:text-rose-300 transition-colors"
            title="Buka menu reset database"
          >
            <Trash2 className="h-3 w-3" />
            Reset Data
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: "all", label: "Semua" },
            { id: "errors", label: "Salah Deteksi" },
            { id: "null_images", label: "Null Images" },
            { id: "shrimp", label: "Udang Asli" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`rounded-xl px-3 py-1.5 font-medium whitespace-nowrap transition-all ${
                filterType === tab.id
                  ? "bg-cyan-500 text-slate-950 font-bold shadow"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-xl bg-slate-900/60 border border-slate-800"
              ></div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center">
            <FileQuestion className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <p className="text-xs text-slate-400 font-medium">Tidak ada sampel dalam filter ini</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecords.map((rec) => {
              const selected = rec.selected_models || [];
              const isNullSample = !rec.human_is_shrimp;
              const hasMistake = selected.length < 3 || isNullSample;
              const m1Count = rec.model_1_output?.images?.[0]?.results?.length || 0;
              const m2Count = rec.model_2_output?.images?.[0]?.results?.length || 0;
              const m3Count = rec.model_3_output?.images?.[0]?.results?.length || 0;

              return (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRecord(rec)}
                  className={`group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 transition-all active:scale-[0.99] ${
                    hasMistake
                      ? "border-amber-900/40 bg-amber-950/10 hover:border-amber-700"
                      : "border-slate-800/80 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={rec.image_url}
                      alt="Sampel"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as any).src = "https://placehold.co/100x100?text=No+Photo";
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          rec.human_is_shrimp
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                            : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                        }`}
                      >
                        {rec.human_is_shrimp ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Udang Asli
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" /> Null Image
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {formatDate(rec.created_at)}
                      </span>
                    </div>

                    {/* Per-model box count indicators */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                      <span className="rounded bg-slate-950 px-1.5 py-0.5 border border-slate-800 text-cyan-300">
                        M1: {m1Count} Box
                      </span>
                      <span className="rounded bg-slate-950 px-1.5 py-0.5 border border-slate-800 text-cyan-300">
                        M2: {m2Count} Box
                      </span>
                      <span className="rounded bg-slate-950 px-1.5 py-0.5 border border-slate-800 text-cyan-300">
                        M3: {m3Count} Box
                      </span>
                    </div>

                    {rec.notes && (
                      <p className="truncate text-[11px] text-slate-300 bg-slate-950/80 rounded-md px-2 py-0.5 border border-slate-800/80">
                        📝 {rec.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadSingleImage(rec.image_url, rec.id || "image");
                      }}
                      className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
                      title="Download Foto Asli"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>

                    {/* Admin Delete Action */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmRecord(rec);
                        }}
                        disabled={isDeletingSingle && deleteConfirmRecord?.id === rec.id}
                        className="p-2 rounded-xl bg-rose-950/70 border border-rose-800/70 text-rose-300 hover:bg-rose-900/80 hover:text-white transition-colors"
                        title="Hapus Sampel Ini (Admin)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zona Administrasi: Reset Seluruh Data */}
      <div className="rounded-2xl border border-rose-950/70 bg-gradient-to-b from-rose-950/20 via-slate-900 to-slate-950 p-4 space-y-3 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
            <ShieldAlert className="h-4 w-4" />
            Zona Administrasi & Reset Data
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Hapus seluruh rekaman riwayat sampel, log evaluasi model, dan metrik akurasi dari database Supabase. Tindakan ini memerlukan otentikasi password admin.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-rose-950/60">
          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
            <Lock className="h-3 w-3 text-rose-500/70" /> Password Protected
          </span>

          <button
            type="button"
            onClick={() => {
              setResetError(null);
              setResetSuccess(null);
              setResetPasswordInput("");
              setIsResetModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-rose-800/80 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 px-3.5 py-2 text-xs font-bold active:scale-95 transition-all shadow-md shadow-rose-950/50"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            Reset Seluruh Data
          </button>
        </div>
      </div>

      {/* Modal Detail & Visualisasi 4 Gambar (Asli + AI 1, 2, 3) */}
      <SampleDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        isAdmin={isAdmin}
        onDelete={(rec) => setDeleteConfirmRecord(rec)}
        formatDate={formatDate}
      />

      {/* Modal Login Mode Admin */}
      {isAdminLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                <KeyRound className="h-4 w-4 text-amber-400" />
                Akses Mode Admin
              </div>
              <button
                onClick={() => setIsAdminLoginModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white bg-slate-800/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Masukkan kata sandi admin untuk mengaktifkan izin menghapus sampel gambar tertentu.
            </p>

            <form onSubmit={handleAdminLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Password Admin:</label>
                <input
                  type="password"
                  value={adminLoginPasswordInput}
                  onChange={(e) => setAdminLoginPasswordInput(e.target.value)}
                  placeholder="Ketik password admin..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {adminLoginError && (
                <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-2 text-xs text-rose-300">
                  {adminLoginError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdminLoginModalOpen(false)}
                  className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingAdmin}
                  className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-xs font-bold text-slate-950 shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isVerifyingAdmin ? "Memverifikasi..." : "Masuk Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Sampel Tertentu (Admin) */}
      {deleteConfirmRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-rose-900/60 bg-slate-900 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-400">
                <Trash2 className="h-4 w-4" />
                Hapus Sampel Ini?
              </div>
              <button
                onClick={() => setDeleteConfirmRecord(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white bg-slate-800/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Apakah Anda yakin ingin menghapus data sampel ini secara permanen dari database Supabase dan storage?
            </p>

            {deleteConfirmRecord.notes && (
              <div className="rounded-lg bg-slate-950 p-2.5 text-[11px] text-slate-400 italic border border-slate-800">
                &quot;{deleteConfirmRecord.notes}&quot;
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmRecord(null)}
                className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={handleDeleteSingleRecord}
                className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isDeletingSingle ? "Menghapus..." : "Ya, Hapus Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Reset Data Terproteksi Password */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-rose-900/60 bg-gradient-to-b from-slate-900 to-slate-950 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">Reset Seluruh Data</h3>
                  <p className="text-[10px] text-slate-400">Aksi ini memerlukan otentikasi</p>
                </div>
              </div>

              <button
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="rounded-lg p-1 text-slate-400 hover:text-white bg-slate-800/60 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 p-3 text-xs text-rose-300/90 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Peringatan Hapus Data
              </div>
              <p className="text-[11px] leading-relaxed">
                Tindakan ini akan menghapus seluruh rekaman riwayat sampel, log evaluasi model, dan metrik akurasi dari database.
              </p>
            </div>

            <form onSubmit={handleResetData} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-cyan-400" /> Masukkan Password Admin:
                </label>
                <input
                  type="password"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="Ketik password reset..."
                  disabled={isResetting}
                  autoFocus
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                />
              </div>

              {resetError && (
                <div className="rounded-lg border border-rose-700 bg-rose-950/60 p-2 text-xs text-rose-300 flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="rounded-lg border border-emerald-700 bg-emerald-950/60 p-2 text-xs text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isResetting || !resetPasswordInput}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Mereset...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" /> Konfirmasi Reset
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
