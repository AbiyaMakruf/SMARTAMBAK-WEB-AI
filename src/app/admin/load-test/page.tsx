"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Zap,
  Activity,
  BarChart3,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  Layers,
  Download,
  KeyRound,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  Server,
  Gauge,
  Sliders,
} from "lucide-react";

interface LoadTestRequestLog {
  id: number;
  timestamp: string;
  modelTarget: string;
  status: "success" | "error";
  httpCode: number;
  latencyMs: number;
  boxCount: number;
  error?: string;
  concurrencyLevel?: number;
}

interface StepUpResult {
  concurrency: number;
  requestsSent: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  rps: number;
}

export default function LoadTestPage() {
  // Admin auth gate
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);

  // Load test configuration
  const [targetModel, setTargetModel] = useState<"model_1" | "model_2" | "model_3" | "all">("model_1");
  const [testMode, setTestMode] = useState<"fixed" | "step_up">("fixed");
  const [concurrency, setConcurrency] = useState<number>(5);
  const [totalRequests, setTotalRequests] = useState<number>(20);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LoadTestRequestLog[]>([]);
  const [stepUpResults, setStepUpResults] = useState<StepUpResult[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "success" | "error">("all");

  const abortControllerRef = useRef<AbortController | null>(null);

  // Check admin session on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAdmin = sessionStorage.getItem("smartambak_admin");
      if (savedAdmin === "true") {
        setIsAdmin(true);
      }
    }
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput) {
      setAdminAuthError("Silakan masukkan kata sandi admin.");
      return;
    }
    setIsVerifyingAdmin(true);
    setAdminAuthError(null);
    try {
      const res = await fetch("/api/report/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Password admin salah.");
      }
      setIsAdmin(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("smartambak_admin", "true");
        sessionStorage.setItem("smartambak_admin_pass", adminPasswordInput);
      }
    } catch (err: any) {
      setAdminAuthError(err.message || "Gagal verifikasi admin.");
    } finally {
      setIsVerifyingAdmin(false);
    }
  };

  // Helper to generate a lightweight dummy shrimp test image File
  const createDummyImageFile = async (): Promise<File> => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Background water
      ctx.fillStyle = "#0f2b38";
      ctx.fillRect(0, 0, 640, 640);

      // Draw synthetic shrimp shape
      ctx.fillStyle = "#e0684b";
      ctx.beginPath();
      ctx.ellipse(320, 320, 160, 60, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();

      // Antennae & details
      ctx.strokeStyle = "#ff9a80";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(420, 270);
      ctx.lineTo(550, 200);
      ctx.stroke();
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const file = new File([blob || new Blob()], `load_test_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        resolve(file);
      }, "image/jpeg", 0.85);
    });
  };

  // Run a single request to the predict API
  const fireSingleRequest = async (
    reqId: number,
    modelId: string,
    file: File,
    signal: AbortSignal,
    concurrencyLevel?: number
  ): Promise<LoadTestRequestLog> => {
    const startTime = performance.now();
    const timestamp = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("conf", "0.25");
    formData.append("iou", "0.7");
    formData.append("imgsz", "640");

    try {
      const res = await fetch(`/api/predict?model=${modelId}`, {
        method: "POST",
        body: formData,
        signal,
      });

      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);
      const data = await res.json();

      const boxCount = data?.data?.images?.[0]?.results?.length || 0;

      if (!res.ok) {
        return {
          id: reqId,
          timestamp,
          modelTarget: modelId,
          status: "error",
          httpCode: res.status,
          latencyMs,
          boxCount: 0,
          error: data.error || `HTTP ${res.status}`,
          concurrencyLevel,
        };
      }

      return {
        id: reqId,
        timestamp,
        modelTarget: modelId,
        status: "success",
        httpCode: res.status,
        latencyMs,
        boxCount,
        concurrencyLevel,
      };
    } catch (err: any) {
      const endTime = performance.now();
      return {
        id: reqId,
        timestamp,
        modelTarget: modelId,
        status: "error",
        httpCode: err.name === "AbortError" ? 499 : 500,
        latencyMs: Math.round(endTime - startTime),
        boxCount: 0,
        error: err.name === "AbortError" ? "Dibatalkan (Aborted)" : err.message || "Network Error",
        concurrencyLevel,
      };
    }
  };

  // Concurrency Worker Pool Runner
  const runWorkerPool = async (
    targetReqCount: number,
    concurrencyCount: number,
    testFile: File,
    signal: AbortSignal,
    onReqComplete: (log: LoadTestRequestLog) => void
  ) => {
    let nextIndex = 0;
    const activeWorkers: Promise<void>[] = [];

    const worker = async () => {
      while (nextIndex < targetReqCount && !signal.aborted) {
        const currentIndex = ++nextIndex;
        const modelToFire =
          targetModel === "all"
            ? (["model_1", "model_2", "model_3"][(currentIndex - 1) % 3] as string)
            : targetModel;

        const log = await fireSingleRequest(
          currentIndex,
          modelToFire,
          testFile,
          signal,
          concurrencyCount
        );
        onReqComplete(log);
      }
    };

    for (let i = 0; i < Math.min(concurrencyCount, targetReqCount); i++) {
      activeWorkers.push(worker());
    }

    await Promise.all(activeWorkers);
  };

  // Main test trigger
  const handleStartTest = async () => {
    setIsRunning(true);
    setLogs([]);
    setStepUpResults([]);
    setProgress(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const testFile = await createDummyImageFile();

      if (testMode === "fixed") {
        let completed = 0;
        await runWorkerPool(
          totalRequests,
          concurrency,
          testFile,
          controller.signal,
          (newLog) => {
            completed++;
            setProgress(Math.round((completed / totalRequests) * 100));
            setLogs((prev) => [newLog, ...prev]);
          }
        );
      } else {
        // Step-up ladder test: 1 -> 3 -> 5 -> 10 -> 20 concurrent users
        const ladderLevels = [1, 3, 5, 10, 20];
        const reqsPerLevel = 6;
        const totalStepReqs = ladderLevels.length * reqsPerLevel;
        let completed = 0;

        for (const level of ladderLevels) {
          if (controller.signal.aborted) break;

          const levelLogs: LoadTestRequestLog[] = [];
          const levelStart = performance.now();

          await runWorkerPool(
            reqsPerLevel,
            level,
            testFile,
            controller.signal,
            (newLog) => {
              completed++;
              setProgress(Math.round((completed / totalStepReqs) * 100));
              levelLogs.push(newLog);
              setLogs((prev) => [newLog, ...prev]);
            }
          );

          const levelEnd = performance.now();
          const durationSec = Math.max(0.1, (levelEnd - levelStart) / 1000);
          const successCount = levelLogs.filter((l) => l.status === "success").length;
          const latencies = levelLogs.map((l) => l.latencyMs).sort((a, b) => a - b);
          const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
          const p95 = latencies[Math.floor(latencies.length * 0.95)] || avg;

          setStepUpResults((prev) => [
            ...prev,
            {
              concurrency: level,
              requestsSent: levelLogs.length,
              successRate: Math.round((successCount / (levelLogs.length || 1)) * 100),
              avgLatencyMs: avg,
              p95LatencyMs: p95,
              rps: Number((levelLogs.length / durationSec).toFixed(1)),
            },
          ]);
        }
      }
    } catch (err) {
      console.error("Load test error:", err);
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  };

  // Computed summary metrics
  const metrics = useMemo(() => {
    if (logs.length === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        successRate: 0,
        avgLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p50: 0,
        p95: 0,
        rps: 0,
      };
    }

    const successLogs = logs.filter((l) => l.status === "success");
    const failedLogs = logs.filter((l) => l.status === "error");
    const latencies = logs.map((l) => l.latencyMs).sort((a, b) => a - b);

    const sum = latencies.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / (latencies.length || 1));
    const min = latencies[0] || 0;
    const max = latencies[latencies.length - 1] || 0;
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

    return {
      total: logs.length,
      success: successLogs.length,
      failed: failedLogs.length,
      successRate: Math.round((successLogs.length / logs.length) * 100),
      avgLatency: avg,
      minLatency: min,
      maxLatency: max,
      p50,
      p95,
      rps: Number((logs.length / (Math.max(1, max) / 1000)).toFixed(1)),
    };
  }, [logs]);

  // Automated performance diagnostics
  const diagnosis = useMemo(() => {
    if (logs.length < 3) return null;

    const firstReq = logs[logs.length - 1]; // chronological first
    const restReqs = logs.slice(0, logs.length - 1);
    const restAvg =
      restReqs.reduce((a, b) => a + b.latencyMs, 0) / (restReqs.length || 1);

    let coldStartMsg = "Waktu respons awal konsisten.";
    if (firstReq && firstReq.latencyMs > restAvg * 1.8 && firstReq.latencyMs > 1500) {
      coldStartMsg = `Terdeteksi Cold Start pada Cloud Run (${firstReq.latencyMs} ms pada request #1 vs ${Math.round(
        restAvg
      )} ms rata-rata berikutnya).`;
    }

    let scalabilityMsg = "";
    if (metrics.successRate >= 98 && metrics.avgLatency < 1200) {
      scalabilityMsg = `Sangat Stabil: Endpoint mampu menangani ${concurrency} user bersamaan dengan latensi cepat (${metrics.avgLatency} ms).`;
    } else if (metrics.successRate >= 95) {
      scalabilityMsg = `Baik: Endpoint melayani beban dengan latensi rata-rata ${metrics.avgLatency} ms tanpa lonjakan error berarti.`;
    } else {
      scalabilityMsg = `Perhatian: Ditemukan ${metrics.failed} request gagal (${100 - metrics.successRate}% failure rate). Kemungkinan batas konkurensi Cloud Run tercapai.`;
    }

    return { coldStartMsg, scalabilityMsg };
  }, [logs, metrics, concurrency]);

  // Download test report JSON
  const handleExportJson = () => {
    const reportData = {
      testTimestamp: new Date().toISOString(),
      configuration: {
        targetModel,
        testMode,
        concurrency,
        totalRequests,
      },
      summaryMetrics: metrics,
      stepUpResults,
      diagnostics: diagnosis,
      logs,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `load_test_${targetModel}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((l) => {
    if (logFilter === "success") return l.status === "success";
    if (logFilter === "error") return l.status === "error";
    return true;
  });

  // If not authenticated as admin, show password gate
  if (!isAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4 shadow-2xl">
          <div className="text-center space-y-1.5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Akses Pengujian Beban (Admin)</h2>
            <p className="text-xs text-slate-400">
              Halaman ini ditujukan untuk stress testing konkurensi endpoint model AI. Masukkan kata sandi admin.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-3 pt-2">
            <div className="space-y-1">
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Masukkan password admin..."
                autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {adminAuthError && (
              <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-2 text-xs text-rose-300">
                {adminAuthError}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifyingAdmin}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-bold text-slate-950 shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isVerifyingAdmin ? "Memverifikasi..." : "Buka Halaman Load Test"}
            </button>
          </form>

          <div className="text-center pt-1">
            <Link href="/report" className="text-xs text-slate-400 hover:text-cyan-400 flex items-center justify-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Kembali ke Laporan & Log
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28 pt-2 max-w-3xl mx-auto">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Link
              href="/report"
              className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              AI Model Load & Concurrency Testing
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Uji konkurensi kapasitas user simultan, latensi, dan analisis auto-scaling Cloud Run
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-emerald-950/70 border border-emerald-700/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
            <Server className="h-3 w-3 text-emerald-400" />
            Admin Mode
          </span>
        </div>
      </div>

      {/* Control & Configuration Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4 backdrop-blur shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-cyan-400" />
            Parameter Pengujian Endpoint
          </h2>
          <span className="text-[11px] text-slate-400">Google Cloud Run Proxy</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Target Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Model AI Target:</label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setTargetModel("model_1")}
                className={`p-2 rounded-xl border text-left truncate transition-all ${
                  targetModel === "model_1"
                    ? "bg-cyan-950/80 border-cyan-500 text-cyan-200 font-semibold"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40"
                }`}
              >
                Model 1: Multiclass
              </button>
              <button
                type="button"
                onClick={() => setTargetModel("model_2")}
                className={`p-2 rounded-xl border text-left truncate transition-all ${
                  targetModel === "model_2"
                    ? "bg-cyan-950/80 border-cyan-500 text-cyan-200 font-semibold"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40"
                }`}
              >
                Model 2: Binaryclass
              </button>
              <button
                type="button"
                onClick={() => setTargetModel("model_3")}
                className={`p-2 rounded-xl border text-left truncate transition-all ${
                  targetModel === "model_3"
                    ? "bg-cyan-950/80 border-cyan-500 text-cyan-200 font-semibold"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40"
                }`}
              >
                Model 3: Baseline
              </button>
              <button
                type="button"
                onClick={() => setTargetModel("all")}
                className={`p-2 rounded-xl border text-left truncate transition-all ${
                  targetModel === "all"
                    ? "bg-emerald-950/80 border-emerald-500 text-emerald-200 font-semibold"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40"
                }`}
              >
                Semua 3 Model Simultan
              </button>
            </div>
          </div>

          {/* Test Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Mode Skenario Beban:</label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setTestMode("fixed")}
                className={`p-2 rounded-xl border text-left transition-all ${
                  testMode === "fixed"
                    ? "bg-cyan-950/80 border-cyan-500 text-cyan-200 font-semibold"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40"
                }`}
              >
                <div className="font-semibold">Konkurensi Tetap</div>
                <div className="text-[10px] text-slate-400">Tes ketahanan beban statis</div>
              </button>

              <button
                type="button"
                onClick={() => setTestMode("step_up")}
                className={`p-2 rounded-xl border text-left transition-all ${
                  testMode === "step_up"
                    ? "bg-amber-950/80 border-amber-500 text-amber-200 font-semibold"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/40"
                }`}
              >
                <div className="font-semibold">Bertingkat (Step-Up)</div>
                <div className="text-[10px] text-slate-400">1➔3➔5➔10➔20 Users</div>
              </button>
            </div>
          </div>
        </div>

        {/* Sliders for Fixed Mode */}
        {testMode === "fixed" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1 rounded-xl bg-slate-950/60 p-3 border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-cyan-400" /> Concurrent Users (Parallel Requests):
                </span>
                <span className="font-mono font-bold text-cyan-300">{concurrency} User</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                disabled={isRunning}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1 User (Serial)</span>
                <span>10 User</span>
                <span>20 User</span>
                <span>30 User</span>
              </div>
            </div>

            <div className="space-y-1 rounded-xl bg-slate-950/60 p-3 border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-amber-400" /> Total Permintaan (Requests):
                </span>
                <span className="font-mono font-bold text-amber-300">{totalRequests} Req</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                disabled={isRunning}
                value={totalRequests}
                onChange={(e) => setTotalRequests(Number(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>5 Req</span>
                <span>30 Req</span>
                <span>60 Req</span>
                <span>100 Req</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Trigger Buttons & Progress */}
        <div className="pt-2 space-y-2">
          {isRunning && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-cyan-400 animate-spin" /> Menjalankan Pengujian Beban...
                </span>
                <span className="font-mono font-bold text-cyan-300">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-amber-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!isRunning ? (
              <button
                type="button"
                onClick={handleStartTest}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                Mulai Pengujian Beban
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopTest}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 py-3 text-xs font-bold text-white shadow-lg shadow-rose-600/20 active:scale-[0.98] transition-all"
              >
                <Square className="h-4 w-4 fill-white" />
                Hentikan Pengujian
              </button>
            )}

            {logs.length > 0 && !isRunning && (
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 text-xs font-semibold text-slate-200 transition-colors"
                title="Download Hasil Uji (.JSON)"
              >
                <Download className="h-4 w-4 text-cyan-400" />
                Ekspor JSON
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Summary */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Total Selesai</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-slate-100">{metrics.total}</span>
              <span className="text-[10px] text-slate-500">req</span>
            </div>
            <div className="text-[10px] text-emerald-400">
              {metrics.success} Sukses • {metrics.failed} Gagal
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Success Rate</span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-xl font-bold font-mono ${
                  metrics.successRate >= 95 ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {metrics.successRate}%
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              {metrics.failed === 0 ? "100% Bebas Error" : `${metrics.failed} Permintaan Error`}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Rata-rata Latensi</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-cyan-300">{metrics.avgLatency}</span>
              <span className="text-[10px] text-slate-500">ms</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Min: {metrics.minLatency}ms • Max: {metrics.maxLatency}ms
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400">P95 / Throughput</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-purple-300">{metrics.p95}</span>
              <span className="text-[10px] text-slate-500">ms</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ~{metrics.rps} req/dtk
            </div>
          </div>
        </div>
      )}

      {/* Automated Diagnostic Assessment */}
      {diagnosis && (
        <div className="rounded-2xl border border-cyan-800/50 bg-cyan-950/20 p-4 space-y-2">
          <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            Analisis Diagnostik Otomatis Performa Model
          </h3>
          <div className="space-y-1 text-xs text-slate-300">
            <p className="flex items-start gap-1.5">
              <span className="text-cyan-400">•</span>
              <span>{diagnosis.coldStartMsg}</span>
            </p>
            <p className="flex items-start gap-1.5">
              <span className="text-cyan-400">•</span>
              <span>{diagnosis.scalabilityMsg}</span>
            </p>
          </div>
        </div>
      )}

      {/* Step-Up Ladder Results Chart */}
      {stepUpResults.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              Kurva Hubungan: Jumlah User Konkuren vs Waktu Respons (ms)
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Step-Up Test</span>
          </div>

          <div className="space-y-2">
            {stepUpResults.map((s) => {
              const maxMs = Math.max(...stepUpResults.map((r) => r.p95LatencyMs), 2000);
              const barWidth = Math.min(100, Math.round((s.avgLatencyMs / maxMs) * 100));

              return (
                <div key={s.concurrency} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold text-cyan-300">
                      {s.concurrency} User Konkuren
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      Avg: <strong className="text-slate-100">{s.avgLatencyMs} ms</strong> • P95: {s.p95LatencyMs} ms ({s.rps} RPS)
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-950 overflow-hidden flex items-center p-0.5 border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        s.avgLatencyMs < 1200
                          ? "bg-emerald-500"
                          : s.avgLatencyMs < 2500
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.max(5, barWidth)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Latency Scatter / Trend Visualizer */}
      {logs.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-cyan-400" />
              Tren Latensi Per Nomor Permintaan (Timeline)
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              Avg Line: {metrics.avgLatency}ms
            </span>
          </div>

          <div className="h-28 w-full flex items-end gap-1 pt-2 pb-1 border-b border-slate-800 overflow-x-auto">
            {logs.slice(0, 40).map((l, i) => {
              const maxL = Math.max(metrics.maxLatency, 1500);
              const heightPercent = Math.min(100, Math.max(8, Math.round((l.latencyMs / maxL) * 100)));
              return (
                <div
                  key={l.id}
                  className="flex-1 min-w-[8px] flex flex-col items-center gap-1 group relative cursor-pointer"
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      l.status === "error"
                        ? "bg-rose-500"
                        : l.latencyMs > metrics.avgLatency * 1.5
                        ? "bg-amber-400"
                        : "bg-cyan-500/80"
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  ></div>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-slate-950 border border-slate-700 px-2 py-1 rounded text-[10px] text-slate-200 whitespace-nowrap z-20 shadow-xl">
                    <span>Req #{l.id}</span>
                    <span className="font-mono text-cyan-300">{l.latencyMs} ms</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Req Terbaru</span>
            <span className="text-cyan-400">● Normal</span>
            <span className="text-amber-400">● Di Atas Rata-rata</span>
            <span className="text-rose-400">● Error / Timeout</span>
            <span>Req Terdahulu</span>
          </div>
        </div>
      )}

      {/* Tabular Request Logs */}
      {logs.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-cyan-400" />
              Log Rinci Permintaan ({filteredLogs.length})
            </h3>

            {/* Filter buttons */}
            <div className="flex gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setLogFilter("all")}
                className={`px-2 py-1 rounded-lg border ${
                  logFilter === "all"
                    ? "bg-slate-800 text-cyan-300 border-slate-700 font-semibold"
                    : "text-slate-400 border-transparent hover:bg-slate-800/40"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setLogFilter("success")}
                className={`px-2 py-1 rounded-lg border ${
                  logFilter === "success"
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-700 font-semibold"
                    : "text-slate-400 border-transparent hover:bg-slate-800/40"
                }`}
              >
                Sukses ({metrics.success})
              </button>
              <button
                type="button"
                onClick={() => setLogFilter("error")}
                className={`px-2 py-1 rounded-lg border ${
                  logFilter === "error"
                    ? "bg-rose-950/80 text-rose-300 border-rose-700 font-semibold"
                    : "text-slate-400 border-transparent hover:bg-slate-800/40"
                }`}
              >
                Error ({metrics.failed})
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/80 text-xs">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2.5 hover:bg-slate-900/60 transition-colors gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] text-slate-500 w-8">
                    #{log.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[10px] font-bold ${
                      log.status === "success"
                        ? "bg-emerald-950/70 text-emerald-400 border border-emerald-800/50"
                        : "bg-rose-950/70 text-rose-400 border border-rose-800/50"
                    }`}
                  >
                    {log.httpCode}
                  </span>
                  <span className="text-[11px] text-slate-300 font-medium truncate">
                    {log.modelTarget.replace("model_", "M")}
                  </span>
                  {log.error && (
                    <span className="text-[10px] text-rose-400 truncate max-w-[150px]">
                      ({log.error})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-right shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {log.boxCount} Box
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold ${
                      log.latencyMs > metrics.avgLatency * 1.4
                        ? "text-amber-400"
                        : "text-cyan-300"
                    }`}
                  >
                    {log.latencyMs} ms
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {log.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
