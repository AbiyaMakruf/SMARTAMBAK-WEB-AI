"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
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
  FileText,
  Printer,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  Eye,
  Check,
  Info,
} from "lucide-react";

interface LoadTestRequestLog {
  id: number;
  userId?: number;
  userReqIndex?: number;
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
  const [concurrency, setConcurrency] = useState<number>(5); // Virtual Users
  const [requestsPerUser, setRequestsPerUser] = useState<number>(10); // Loop requests per user

  // Custom image selection
  const [imageSource, setImageSource] = useState<"synthetic" | "custom">("synthetic");
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LoadTestRequestLog[]>([]);
  const [stepUpResults, setStepUpResults] = useState<StepUpResult[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "success" | "error">("all");
  const [hoveredLog, setHoveredLog] = useState<LoadTestRequestLog | null>(null);
  const [testDurationSec, setTestDurationSec] = useState<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const testStartTimeRef = useRef<number>(0);

  // Derived Total Requests
  const totalRequests = useMemo(() => {
    return concurrency * requestsPerUser;
  }, [concurrency, requestsPerUser]);

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

  // Handle custom image selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Pilih berkas berupa gambar (JPG, PNG, WebP).");
        return;
      }
      setCustomImageFile(file);
      setImageSource("custom");
      const previewUrl = URL.createObjectURL(file);
      setCustomImagePreview(previewUrl);
    }
  };

  const handleClearCustomImage = () => {
    setCustomImageFile(null);
    setCustomImagePreview(null);
    setImageSource("synthetic");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    concurrencyLevel?: number,
    userId?: number,
    userReqIndex?: number
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
          userId,
          userReqIndex,
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
        userId,
        userReqIndex,
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
        userId,
        userReqIndex,
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

  // Concurrency Worker Pool Runner:
  // Launches `concurrencyCount` virtual users simultaneously, each running `reqsPerUser` requests
  const runWorkerPool = async (
    concurrencyCount: number,
    reqsPerUser: number,
    testFile: File,
    signal: AbortSignal,
    onReqComplete: (log: LoadTestRequestLog) => void
  ) => {
    let globalCompleted = 0;
    const activeWorkers: Promise<void>[] = [];

    for (let u = 1; u <= concurrencyCount; u++) {
      const worker = async (vUserId: number) => {
        for (let r = 1; r <= reqsPerUser; r++) {
          if (signal.aborted) break;

          globalCompleted++;
          const currentReqId = globalCompleted;
          const modelToFire =
            targetModel === "all"
              ? (["model_1", "model_2", "model_3"][(currentReqId - 1) % 3] as string)
              : targetModel;

          const log = await fireSingleRequest(
            currentReqId,
            modelToFire,
            testFile,
            signal,
            concurrencyCount,
            vUserId,
            r
          );
          onReqComplete(log);
        }
      };
      activeWorkers.push(worker(u));
    }

    await Promise.all(activeWorkers);
  };

  // Main test trigger
  const handleStartTest = async () => {
    setIsRunning(true);
    setLogs([]);
    setStepUpResults([]);
    setProgress(0);
    setHoveredLog(null);
    testStartTimeRef.current = performance.now();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Determine test file payload (custom image or synthetic canvas)
      let testFile: File;
      if (imageSource === "custom" && customImageFile) {
        testFile = customImageFile;
      } else {
        testFile = await createDummyImageFile();
      }

      if (testMode === "fixed") {
        const targetTotal = concurrency * requestsPerUser;
        let completed = 0;

        await runWorkerPool(
          concurrency,
          requestsPerUser,
          testFile,
          controller.signal,
          (newLog) => {
            completed++;
            setProgress(Math.round((completed / targetTotal) * 100));
            setLogs((prev) => [newLog, ...prev]);
          }
        );
      } else {
        // Step-up ladder test: 1 -> 3 -> 5 -> 10 -> 20 concurrent users
        // Each virtual user executes 5 requests at each step
        const ladderLevels = [1, 3, 5, 10, 20];
        const reqsPerUserStep = 5;
        const totalStepReqs = ladderLevels.reduce((acc, lvl) => acc + lvl * reqsPerUserStep, 0);
        let completed = 0;

        for (const level of ladderLevels) {
          if (controller.signal.aborted) break;

          const levelLogs: LoadTestRequestLog[] = [];
          const levelStart = performance.now();

          await runWorkerPool(
            level,
            reqsPerUserStep,
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
    } catch (err: any) {
      console.error("Load test error:", err);
    } finally {
      setIsRunning(false);
      const testEnd = performance.now();
      const elapsed = (testEnd - testStartTimeRef.current) / 1000;
      setTestDurationSec(Math.max(0.5, Number(elapsed.toFixed(1))));
    }
  };

  const handleStopTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  };

  // Metrics computation from logs
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

    const effectiveDuration = testDurationSec > 0 ? testDurationSec : Math.max(1, max / 1000);
    const rps = Number((logs.length / effectiveDuration).toFixed(1));

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
      rps,
    };
  }, [logs, testDurationSec]);

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

  // Sorted chronological logs (Request #1 to #N)
  const sortedLogsChronological = useMemo(() => {
    return [...logs].sort((a, b) => a.id - b.id);
  }, [logs]);

  // Download test report JSON
  const handleExportJson = () => {
    const reportData = {
      testTimestamp: new Date().toISOString(),
      configuration: {
        targetModel,
        testMode,
        concurrency,
        requestsPerUser,
        totalRequests: logs.length,
        imageSource: imageSource === "custom" && customImageFile ? customImageFile.name : "synthetic_canvas",
      },
      summaryMetrics: metrics,
      stepUpResults,
      diagnostics: diagnosis,
      logs: sortedLogsChronological,
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

  // Download official test report PDF via jsPDF
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Top banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 28, "F");

      // Cyan accent line
      doc.setFillColor(6, 182, 212); // cyan-500
      doc.rect(0, 27, pageWidth, 1.5, "F");

      // Header text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("SMART AMBAK AI — LAPORAN UJI BEBAN ENDPOINT", 14, 12);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Waktu Pengujian: ${new Date().toLocaleString("id-ID")}`, 14, 18);
      doc.text(
        `Model: ${targetModel.toUpperCase()} | Skenario: ${testMode === "fixed" ? "Konkurensi Tetap" : "Step-Up Bertingkat"}`,
        14,
        23
      );

      // Status Badge
      const statusText = metrics.successRate >= 95 ? "STABIL / READY" : "DEGRADASI / WARNING";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      if (metrics.successRate >= 95) {
        doc.setFillColor(6, 78, 59); // emerald-900
        doc.setTextColor(167, 243, 208); // emerald-200
      } else {
        doc.setFillColor(120, 53, 15); // amber-900
        doc.setTextColor(253, 230, 138); // amber-200
      }
      doc.roundedRect(pageWidth - 55, 9, 41, 8, 1.5, 1.5, "F");
      doc.text(statusText, pageWidth - 52, 14.5);

      // Section 1: Konfigurasi Uji
      let yPos = 35;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("1. KONFIGURASI PARAMETER PENGUJIAN", 14, yPos);
      yPos += 3;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, yPos, pageWidth - 28, 22, 2, 2, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`• Mode Beban: ${testMode === "fixed" ? "Konkurensi Tetap" : "Step-Up Ladder Test"}`, 18, yPos + 6);
      doc.text(`• Concurrent Users: ${concurrency} Virtual Users`, 18, yPos + 11);
      doc.text(`• Permintaan per User: ${requestsPerUser} Requests / User`, 18, yPos + 16);

      const imgInfo =
        imageSource === "custom" && customImageFile
          ? `${customImageFile.name} (${(customImageFile.size / 1024).toFixed(1)} KB)`
          : "Canvas Sintetis Udang (640x640)";
      doc.text(`• Total Permintaan Selesai: ${metrics.total} Req`, 105, yPos + 6);
      doc.text(`• Citra Pengujian: ${imgInfo}`, 105, yPos + 11);
      doc.text(`• Target Model: ${targetModel === "all" ? "3 Model Paralel" : targetModel}`, 105, yPos + 16);

      yPos += 28;

      // Section 2: Ringkasan Metrik KPI
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("2. RINGKASAN KINERJA (KEY PERFORMANCE INDICATORS)", 14, yPos);
      yPos += 4;

      const kpiBoxes = [
        { label: "Total Permintaan", val: `${metrics.total} req`, sub: `${metrics.success} OK / ${metrics.failed} Err` },
        { label: "Success Rate", val: `${metrics.successRate}%`, sub: metrics.successRate >= 95 ? "Optimal" : "Degradasi" },
        { label: "Throughput (RPS)", val: `${metrics.rps} req/s`, sub: `Durasi: ${testDurationSec}s` },
        { label: "Rata-rata Latensi", val: `${metrics.avgLatency} ms`, sub: `Min ${metrics.minLatency} / Max ${metrics.maxLatency}` },
        { label: "P50 (Median)", val: `${metrics.p50} ms`, sub: "50% Request di bawah ini" },
        { label: "P95 (Tail Latency)", val: `${metrics.p95} ms`, sub: "95% Request di bawah ini" },
      ];

      const boxW = (pageWidth - 28 - 10) / 3;
      const boxH = 16;
      kpiBoxes.forEach((b, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const bx = 14 + col * (boxW + 5);
        const by = yPos + row * (boxH + 3);

        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(bx, by, boxW, boxH, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(b.label, bx + 3, by + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(b.val, bx + 3, by + 10);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(b.sub, bx + 3, by + 14);
      });

      yPos += 2 * (boxH + 3) + 7;

      // Section 3: Diagnostik AI Cloud Run
      if (diagnosis) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text("3. DIAGNOSTIK & EVALUASI INFRASTRUKTUR CLOUD RUN", 14, yPos);
        yPos += 4;

        doc.setFillColor(254, 243, 199); // amber-100
        doc.setDrawColor(251, 191, 36);
        doc.roundedRect(14, yPos, pageWidth - 28, 18, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(146, 64, 14);
        doc.text("Analisis Cold Start & Skalabilitas:", 18, yPos + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(120, 53, 15);
        doc.text(`• ${diagnosis.coldStartMsg}`, 18, yPos + 10);
        doc.text(`• ${diagnosis.scalabilityMsg}`, 18, yPos + 14.5);

        yPos += 24;
      }

      // Section 4: Log Permintaan
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("4. LOG RIWAYAT PERMINTAAN SAMPEL", 14, yPos);
      yPos += 4;

      // Table Header
      const colX = [14, 26, 42, 64, 88, 118, 144, 170];
      doc.setFillColor(15, 23, 42);
      doc.rect(14, yPos, pageWidth - 28, 6, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text("ID", colX[0] + 2, yPos + 4);
      doc.text("User", colX[1] + 1, yPos + 4);
      doc.text("Waktu", colX[2] + 1, yPos + 4);
      doc.text("Model Target", colX[3] + 1, yPos + 4);
      doc.text("Kode HTTP", colX[4] + 1, yPos + 4);
      doc.text("Latensi (ms)", colX[5] + 1, yPos + 4);
      doc.text("Box", colX[6] + 1, yPos + 4);
      doc.text("Hasil", colX[7] + 1, yPos + 4);

      yPos += 6;

      const sampleLogs = sortedLogsChronological.slice(0, 36);
      sampleLogs.forEach((l, idx) => {
        if (yPos > pageHeight - 18) {
          doc.addPage();
          yPos = 16;
          // repeat table header on next page
          doc.setFillColor(15, 23, 42);
          doc.rect(14, yPos, pageWidth - 28, 6, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(255, 255, 255);
          doc.text("ID", colX[0] + 2, yPos + 4);
          doc.text("User", colX[1] + 1, yPos + 4);
          doc.text("Waktu", colX[2] + 1, yPos + 4);
          doc.text("Model Target", colX[3] + 1, yPos + 4);
          doc.text("Kode HTTP", colX[4] + 1, yPos + 4);
          doc.text("Latensi (ms)", colX[5] + 1, yPos + 4);
          doc.text("Box", colX[6] + 1, yPos + 4);
          doc.text("Hasil", colX[7] + 1, yPos + 4);
          yPos += 6;
        }

        const isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
        doc.rect(14, yPos, pageWidth - 28, 5.2, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);

        doc.text(`#${l.id}`, colX[0] + 2, yPos + 3.8);
        doc.text(`U${l.userId || 1}`, colX[1] + 1, yPos + 3.8);
        doc.text(l.timestamp || "-", colX[2] + 1, yPos + 3.8);
        doc.text(l.modelTarget, colX[3] + 1, yPos + 3.8);
        doc.text(`${l.httpCode}`, colX[4] + 1, yPos + 3.8);
        doc.text(`${l.latencyMs} ms`, colX[5] + 1, yPos + 3.8);
        doc.text(`${l.boxCount}`, colX[6] + 1, yPos + 3.8);

        if (l.status === "success") {
          doc.setTextColor(5, 150, 105);
          doc.text("SUKSES", colX[7] + 1, yPos + 3.8);
        } else {
          doc.setTextColor(225, 29, 72);
          doc.text("GAGAL", colX[7] + 1, yPos + 3.8);
        }

        yPos += 5.2;
      });

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("Smart Ambak AI - Load Testing & Cloud Run Benchmarking", 14, pageHeight - 6);
        doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - 32, pageHeight - 6);
      }

      doc.save(`Laporan_Uji_Beban_AI_Smartambak_${targetModel}_${Date.now()}.pdf`);
    } catch (e: any) {
      console.error("Gagal export PDF:", e);
      alert("Gagal membuat file PDF: " + (e?.message || e));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredLogs = logs.filter((l) => {
    if (logFilter === "success") return l.status === "success";
    if (logFilter === "error") return l.status === "error";
    return true;
  });

  // Admin login screen
  if (!isAdmin) {
    return (
      <div className="space-y-4 pb-28 pt-4 max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <Link
            href="/report"
            className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-xs text-slate-400 font-medium">Kembali ke Laporan</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">AI Load & Concurrency Testing</h2>
              <p className="text-xs text-slate-400">Autentikasi administrator diperlukan</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Halaman ini digunakan untuk menguji batas throughput, latensi konkurensi simultan, dan auto-scaling endpoint Google Cloud Run. Masukkan kata sandi admin untuk melanjutkan.
          </p>

          <form onSubmit={handleAdminLogin} className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Kata Sandi Admin:
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Masukkan password admin..."
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none pr-10"
                />
                <KeyRound className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
              </div>
            </div>

            {adminAuthError && (
              <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-2.5 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{adminAuthError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifyingAdmin}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isVerifyingAdmin ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  Masuk ke Suite Pengujian
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Latency SVG parameters
  const chartWidth = 700;
  const chartHeight = 180;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;
  const maxL = Math.max(metrics.maxLatency, 1000) * 1.15;

  return (
    <div className="space-y-4 pb-28 pt-2 max-w-3xl mx-auto print:p-0 print:space-y-3">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between gap-3 print:hidden">
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
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4 backdrop-blur shadow-xl print:border-slate-300 print:bg-white print:text-black">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 print:border-slate-300">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 print:text-black">
            <Sliders className="h-3.5 w-3.5 text-cyan-400" />
            Parameter Pengujian Endpoint
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">Google Cloud Run Proxy</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Target Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block print:text-black">
              Model AI Target:
            </label>
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
            <label className="text-xs font-semibold text-slate-300 block print:text-black">
              Mode Skenario Beban:
            </label>
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
                <div className="text-[10px] text-slate-400">Tes beban user × req konstan</div>
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

        {/* Citra Pengujian Payload (Custom Upload vs Synthetic) */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-cyan-400" />
              Citra Uji Beban (Image Payload):
            </label>
            <span className="text-[10px] text-slate-400">
              {imageSource === "custom" && customImageFile
                ? `Foto Kustom: ${(customImageFile.size / 1024).toFixed(1)} KB`
                : "Canvas Udang Sintetis (640x640)"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                if (customImageFile) setImageSource("custom");
                else fileInputRef.current?.click();
              }}
              className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                imageSource === "custom"
                  ? "bg-cyan-950/70 border-cyan-500 text-cyan-200 font-semibold"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <UploadCloud className="h-4 w-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold">Unggah Foto Sendiri</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {customImageFile ? customImageFile.name : "Pilih foto udang/tambak riil"}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setImageSource("synthetic")}
              className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                imageSource === "synthetic"
                  ? "bg-cyan-950/70 border-cyan-500 text-cyan-200 font-semibold"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <Cpu className="h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <div className="font-semibold">Gambar Sintetis Bawaan</div>
                <div className="text-[10px] text-slate-400">Canvas 640x640 auto-generate</div>
              </div>
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            className="hidden"
          />

          {/* Custom Image Preview & Clear */}
          {customImageFile && customImagePreview && (
            <div className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={customImagePreview}
                  alt="Test payload preview"
                  className="h-12 w-12 rounded-lg object-cover border border-slate-700 shrink-0"
                />
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {customImageFile.name}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono">
                    Ukuran: {(customImageFile.size / 1024).toFixed(1)} KB • Tipe: {customImageFile.type}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] text-slate-300 hover:text-white bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg"
                >
                  Ganti
                </button>
                <button
                  type="button"
                  onClick={handleClearCustomImage}
                  className="text-[11px] text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-800/50 p-1.5 rounded-lg"
                  title="Hapus gambar kustom"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sliders for Fixed Mode: Concurrency & Requests per User */}
        {testMode === "fixed" && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Virtual Users (Concurrency) */}
              <div className="space-y-1.5 rounded-xl bg-slate-950/60 p-3 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5 text-cyan-400" /> Concurrent Users (Simultan):
                  </span>
                  <span className="font-mono font-bold text-cyan-300 text-sm">{concurrency} User</span>
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
                  <span>1 User</span>
                  <span>10 User</span>
                  <span>20 User</span>
                  <span>30 User</span>
                </div>
              </div>

              {/* Requests per User */}
              <div className="space-y-1.5 rounded-xl bg-slate-950/60 p-3 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-amber-400" /> Permintaan per User:
                  </span>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {requestsPerUser} Req/User
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  disabled={isRunning}
                  value={requestsPerUser}
                  onChange={(e) => setRequestsPerUser(Number(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1 Req</span>
                  <span>25 Req</span>
                  <span>50 Req</span>
                  <span>100 Req</span>
                </div>
              </div>
            </div>

            {/* Total Load Calculation Banner & Presets */}
            <div className="rounded-xl bg-gradient-to-r from-cyan-950/60 via-slate-950 to-amber-950/60 border border-slate-700/80 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-cyan-400" />
                  Kalkulasi Beban Total:
                </div>
                <div className="text-xs font-mono font-bold text-slate-100 flex items-center gap-1.5">
                  <span className="text-cyan-400">{concurrency} Users</span>
                  <span className="text-slate-500">×</span>
                  <span className="text-amber-400">{requestsPerUser} Req</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-emerald-400 text-sm">{totalRequests.toLocaleString("id-ID")} Total Permintaan</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1 text-[10px]">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setConcurrency(3);
                    setRequestsPerUser(5);
                  }}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                >
                  3x5 (15)
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setConcurrency(5);
                    setRequestsPerUser(10);
                  }}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                >
                  5x10 (50)
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setConcurrency(10);
                    setRequestsPerUser(10);
                  }}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                >
                  10x10 (100)
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setConcurrency(30);
                    setRequestsPerUser(100);
                  }}
                  className="px-2 py-1 rounded bg-amber-950/80 text-amber-300 hover:text-white border border-amber-800/80 font-semibold"
                >
                  30x100 (3.000)
                </button>
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
                  <Cpu className="h-3.5 w-3.5 text-cyan-400 animate-spin" /> Menjalankan Pengujian Beban ({logs.length} / {testMode === "fixed" ? totalRequests : "Step-Up"} Req)...
                </span>
                <span className="font-mono font-bold text-cyan-300">{progress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!isRunning ? (
              <button
                type="button"
                onClick={handleStartTest}
                className="flex-1 min-w-[200px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                Mulai Pengujian ({testMode === "fixed" ? `${concurrency} User × ${requestsPerUser} Req` : "Step-Up"})
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopTest}
                className="flex-1 min-w-[200px] flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 py-3 text-xs font-bold text-white shadow-lg shadow-rose-600/20 active:scale-[0.98] transition-all"
              >
                <Square className="h-4 w-4 fill-white" />
                Hentikan Pengujian
              </button>
            )}

            {logs.length > 0 && !isRunning && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/80 px-3.5 py-3 text-xs font-semibold text-cyan-200 transition-colors shadow-sm"
                  title="Unduh Laporan Resmi Format PDF"
                >
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Ekspor PDF
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-3 text-xs font-semibold text-slate-200 transition-colors"
                  title="Cetak Halaman / Simpan PDF Browser"
                >
                  <Printer className="h-4 w-4 text-slate-300" />
                  Cetak
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-3 text-xs font-semibold text-slate-300 transition-colors"
                  title="Download Raw Data JSON"
                >
                  <Download className="h-4 w-4 text-slate-400" />
                  JSON
                </button>
              </div>
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
            <div className="text-[10px] text-slate-400">
              {metrics.failed === 0 ? "100% Bebas Error" : `${metrics.failed} request gagal`}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Throughput (RPS)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-cyan-300">{metrics.rps}</span>
              <span className="text-[10px] text-slate-500">req/s</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Waktu: {testDurationSec} detik
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Rata-rata Latensi</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-amber-300">
                {metrics.avgLatency}
              </span>
              <span className="text-[10px] text-slate-500">ms</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Min: {metrics.minLatency}ms | Max: {metrics.maxLatency}ms
            </div>
          </div>
        </div>
      )}

      {/* Latency Percentiles (P50 & P95) */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">Median Latency (P50)</span>
              <span className="text-base font-bold font-mono text-slate-100">{metrics.p50} ms</span>
            </div>
            <span className="text-[10px] text-slate-500 text-right">50% request lebih cepat dari ini</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">Tail Latency (P95)</span>
              <span className="text-base font-bold font-mono text-amber-300">{metrics.p95} ms</span>
            </div>
            <span className="text-[10px] text-slate-500 text-right">95% request lebih cepat dari ini</span>
          </div>
        </div>
      )}

      {/* Step-Up Ladder Results Comparison */}
      {testMode === "step_up" && stepUpResults.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            Grafik Eskalasi Konkurensi vs Latensi Rata-rata
          </h3>

          <div className="grid grid-cols-5 gap-2 pt-2">
            {stepUpResults.map((r) => {
              const maxL = Math.max(...stepUpResults.map((x) => x.avgLatencyMs), 2000);
              const heightPercent = Math.min(100, Math.max(15, Math.round((r.avgLatencyMs / maxL) * 100)));

              return (
                <div key={r.concurrency} className="flex flex-col items-center gap-1 text-center">
                  <div className="h-24 w-full flex items-end justify-center">
                    <div
                      className="w-8 rounded-t bg-gradient-to-t from-cyan-600 to-amber-500 transition-all"
                      style={{ height: `${heightPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-200">{r.concurrency} User</span>
                  <span className="text-[9px] font-mono text-cyan-300">{r.avgLatencyMs} ms</span>
                  <span className="text-[9px] font-mono text-slate-500">{r.rps} RPS</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Latency Trend Visualizer (Interactive Vector SVG) */}
      {logs.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-cyan-400" />
              Tren Latensi Per Nomor Permintaan (Timeline)
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-cyan-400">Avg: {metrics.avgLatency}ms</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400">P95: {metrics.p95}ms</span>
            </div>
          </div>

          {/* Interactive Inspection Card */}
          {hoveredLog ? (
            <div className="flex items-center justify-between bg-slate-950 border border-cyan-800/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 animate-fadeIn">
              <div className="flex items-center gap-2 font-mono">
                <span className="font-bold text-cyan-300">Permintaan #{hoveredLog.id}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">User #{hoveredLog.userId || 1}</span>
                <span className="text-slate-500">•</span>
                <span>Req #{hoveredLog.userReqIndex || 1}</span>
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span className={`font-bold ${hoveredLog.status === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                  HTTP {hoveredLog.httpCode}
                </span>
                <span className="font-bold text-amber-300">{hoveredLog.latencyMs} ms</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 font-mono italic">
              Arahkan kursor atau sentuh bar/titik di bawah untuk melihat detail permintaan spesifik.
            </div>
          )}

          {/* SVG Latency Chart */}
          <div className="w-full overflow-hidden bg-slate-950/80 rounded-xl border border-slate-800/80 p-2">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto block select-none"
              style={{ minHeight: "150px" }}
            >
              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = padTop + plotH * (1 - pct);
                const latVal = Math.round(maxL * pct);
                return (
                  <g key={pct}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={padLeft + plotW}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth="1"
                      strokeDasharray={pct === 0 ? "none" : "2 2"}
                    />
                    <text
                      x={padLeft - 6}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {latVal}ms
                    </text>
                  </g>
                );
              })}

              {/* Reference Line: Avg Latency */}
              {metrics.avgLatency > 0 && (
                <g>
                  {(() => {
                    const avgY = padTop + plotH - (metrics.avgLatency / maxL) * plotH;
                    return (
                      <>
                        <line
                          x1={padLeft}
                          y1={avgY}
                          x2={padLeft + plotW}
                          y2={avgY}
                          stroke="#06b6d4"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={padLeft + plotW - 4}
                          y={avgY - 4}
                          fill="#06b6d4"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="end"
                        >
                          Avg: {metrics.avgLatency}ms
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}

              {/* Reference Line: P95 Latency */}
              {metrics.p95 > 0 && (
                <g>
                  {(() => {
                    const p95Y = padTop + plotH - (metrics.p95 / maxL) * plotH;
                    return (
                      <>
                        <line
                          x1={padLeft}
                          y1={p95Y}
                          x2={padLeft + plotW}
                          y2={p95Y}
                          stroke="#f59e0b"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={padLeft + 4}
                          y={p95Y - 4}
                          fill="#f59e0b"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          P95: {metrics.p95}ms
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}

              {/* Bars and Data Points */}
              {sortedLogsChronological.map((l, i) => {
                const totalPoints = sortedLogsChronological.length;
                const x =
                  padLeft +
                  (totalPoints > 1
                    ? (i / (totalPoints - 1)) * plotW
                    : plotW / 2);

                const barH = Math.max(4, (l.latencyMs / maxL) * plotH);
                const y = padTop + plotH - barH;
                const barWidth = Math.max(2, Math.min(18, (plotW / totalPoints) * 0.75));

                const isError = l.status === "error";
                const isSlow = l.latencyMs > metrics.avgLatency * 1.4;
                const color = isError ? "#f43f5e" : isSlow ? "#f59e0b" : "#06b6d4";

                return (
                  <g
                    key={l.id}
                    onMouseEnter={() => setHoveredLog(l)}
                    onTouchStart={() => setHoveredLog(l)}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                  >
                    {/* Vertical Bar */}
                    <rect
                      x={x - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={barH}
                      rx="1"
                      fill={color}
                      opacity={hoveredLog && hoveredLog.id === l.id ? 1 : 0.85}
                    />

                    {/* Point on top */}
                    <circle
                      cx={x}
                      cy={y}
                      r={hoveredLog && hoveredLog.id === l.id ? 3.5 : 2}
                      fill={color}
                    />
                  </g>
                );
              })}

              {/* X-axis Line & Labels */}
              <line
                x1={padLeft}
                y1={padTop + plotH}
                x2={padLeft + plotW}
                y2={padTop + plotH}
                stroke="#334155"
                strokeWidth="1"
              />

              {sortedLogsChronological.length > 0 && (
                <>
                  <text
                    x={padLeft}
                    y={chartHeight - 10}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    Req #{sortedLogsChronological[0]?.id || 1}
                  </text>

                  {sortedLogsChronological.length > 2 && (
                    <text
                      x={padLeft + plotW / 2}
                      y={chartHeight - 10}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      Req #{sortedLogsChronological[Math.floor(sortedLogsChronological.length / 2)]?.id}
                    </text>
                  )}

                  <text
                    x={padLeft + plotW}
                    y={chartHeight - 10}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    Req #{sortedLogsChronological[sortedLogsChronological.length - 1]?.id}
                  </text>
                </>
              )}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span> Normal (&le; Avg)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span> Di Atas Rata-rata
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span> Gagal / Timeout
            </span>
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
                  <span className="font-mono text-[11px] text-slate-500 w-9 shrink-0">
                    #{log.id}
                  </span>
                  <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-mono text-cyan-400 border border-slate-700 shrink-0">
                    U{log.userId || 1}·r{log.userReqIndex || 1}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[10px] font-bold shrink-0 ${
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
