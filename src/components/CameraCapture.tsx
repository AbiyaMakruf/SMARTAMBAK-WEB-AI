"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, RefreshCw, Image as ImageIcon, Sparkles, X, Check, ArrowDownUp, Sliders } from "lucide-react";
import { compressImage, formatBytes } from "@/lib/imageCompressor";

interface CameraCaptureProps {
  onImageSelected: (file: File, previewUrl: string) => void;
  onOpenEditor?: () => void;
  isProcessing?: boolean;
}

export function CameraCapture({ onImageSelected, onOpenEditor, isProcessing = false }: CameraCaptureProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{
    original: number;
    compressed: number;
  } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera stream safely
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start camera stream with iOS Safari robust compatibility
  const startCamera = useCallback(async (mode: "environment" | "user") => {
    stopCameraStream();
    setCameraError(null);
    setVideoAspect(null);

    let stream: MediaStream | null = null;

    // 1. Try with ideal facingMode and standard resolution
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode === "environment" ? { ideal: "environment" } : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (firstErr) {
      console.warn("First getUserMedia attempt failed, trying simple constraints:", firstErr);
      // 2. Fallback: simple facingMode constraint without resolution constraints (fixes iOS Safari bugs)
      try {
        const fallbackConstraints: MediaStreamConstraints = {
          video: {
            facingMode: mode === "environment" ? "environment" : "user",
          },
          audio: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      } catch (secondErr: any) {
        console.error("Camera access error:", secondErr);
        setCameraError(
          secondErr.name === "NotAllowedError"
            ? "Izin kamera ditolak. Silakan berikan izin di browser atau gunakan upload galeri."
            : "Tidak dapat mengakses kamera perangkat. Silakan gunakan galeri foto."
        );
        setIsCameraActive(false);
        return;
      }
    }

    if (!stream) return;
    streamRef.current = stream;
    setIsCameraActive(true);

    // Wait next tick to ensure video element is mounted in DOM
    setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;

      // Ensure iOS playsinline attributes are explicitly set on the DOM
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.srcObject = stream;

      const handlePlay = () => {
        if (video.videoWidth && video.videoHeight) {
          setVideoAspect(video.videoWidth / video.videoHeight);
        }
      };

      video.onloadedmetadata = () => {
        handlePlay();
        video.play().catch((err) => console.warn("video.play() warning:", err));
      };

      // Also invoke play directly in case metadata loaded instantly
      video.play().then(handlePlay).catch(() => {});
    }, 50);
  }, [stopCameraStream]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Toggle front/back camera
  const toggleFacingMode = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (isCameraActive) {
      await startCamera(nextMode);
    }
  };

  // Process raw file or captured blob through compression
  const processImageFile = async (rawFile: File | Blob) => {
    try {
      const { file: compressedFile, dataUrl, originalSize, compressedSize } = await compressImage(
        rawFile,
        1280,
        0.85
      );

      setCompressionInfo({
        original: originalSize,
        compressed: compressedSize,
      });
      setSelectedPreview(dataUrl);
      onImageSelected(compressedFile, dataUrl);
    } catch (err) {
      console.error("Compression error:", err);
      if (rawFile instanceof File) {
        const url = URL.createObjectURL(rawFile);
        setSelectedPreview(url);
        onImageSelected(rawFile, url);
      }
    }
  };

  // Capture snapshot from video stream - TRUE 1:1 WYSIWYG
  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontally if front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        stopCameraStream();
        setIsCameraActive(false);
        await processImageFile(blob);
      },
      "image/jpeg",
      0.9
    );
  };

  // Handle gallery file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCameraStream();
    setIsCameraActive(false);
    await processImageFile(file);
  };

  // Reset captured state
  const handleReset = () => {
    setSelectedPreview(null);
    setCompressionInfo(null);
    setVideoAspect(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Camera className="h-4 w-4 text-cyan-400" />
          Input Foto Udang Tambak
        </h2>
        {selectedPreview && (
          <button
            onClick={handleReset}
            disabled={isProcessing}
            className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Ganti Foto
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Mode 1: Image Captured Preview */}
      {selectedPreview ? (
        <div className="space-y-3">
          <div className="relative w-full max-h-[70vh] overflow-hidden rounded-xl border border-slate-700 bg-black flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPreview}
              alt="Sampel Udang"
              className="max-h-[70vh] w-full object-contain"
            />
            <div className="absolute top-2 left-2 rounded-md bg-slate-950/70 backdrop-blur px-2 py-1 text-[11px] font-medium text-emerald-300 flex items-center gap-1 border border-emerald-500/30">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Sampel Siap Diuji
            </div>
          </div>

          {compressionInfo && (
            <div className="flex items-center justify-between rounded-lg bg-cyan-950/30 border border-cyan-800/40 px-3 py-1.5 text-xs text-cyan-300">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Kompresi Hemat Data:
              </span>
              <span className="font-mono font-medium">
                {formatBytes(compressionInfo.original)} ➔ {formatBytes(compressionInfo.compressed)} (-
                {Math.round(
                  ((compressionInfo.original - compressionInfo.compressed) /
                    compressionInfo.original) *
                    100
                )}
                %)
              </span>
            </div>
          )}

          {/* Action to trigger extreme simulation editor */}
          {onOpenEditor && (
            <button
              type="button"
              onClick={onOpenEditor}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-cyan-950/60 border border-cyan-700/60 hover:border-cyan-500 py-2.5 text-xs font-semibold text-cyan-300 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Sliders className="h-4 w-4 text-cyan-400" />
              Simulasi Kondisi Ekstrem / Edit Gambar
            </button>
          )}
        </div>
      ) : isCameraActive ? (
        /* Mode 2: Live Camera View - 100% WYSIWYG without distortion/cropping */
        <div className="space-y-3">
          <div
            className="relative w-full max-h-[70vh] overflow-hidden rounded-xl border border-cyan-500/60 bg-black shadow-2xl flex items-center justify-center"
            style={{
              aspectRatio: videoAspect ? `${videoAspect}` : "4/3",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-contain ${
                facingMode === "user" ? "scale-x-[-1]" : ""
              }`}
            />

            {/* Toggle Camera Button */}
            <button
              onClick={toggleFacingMode}
              type="button"
              className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/85 text-white backdrop-blur border border-slate-700 active:scale-95 shadow-md z-10"
              title="Ganti Kamera Depan / Belakang"
            >
              <ArrowDownUp className="h-5 w-5 text-cyan-400" />
            </button>

            {/* Close Camera Button */}
            <button
              onClick={() => {
                stopCameraStream();
                setIsCameraActive(false);
              }}
              type="button"
              className="absolute top-3 left-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/85 text-white backdrop-blur border border-slate-700 active:scale-95 shadow-md z-10"
              title="Tutup Kamera"
            >
              <X className="h-5 w-5 text-slate-300" />
            </button>
          </div>

          {/* Shutter Button */}
          <div className="flex flex-col items-center justify-center pt-1 gap-1.5">
            <button
              onClick={captureSnapshot}
              type="button"
              className="group relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-cyan-400 bg-white/20 backdrop-blur transition-all active:scale-90"
            >
              <div className="h-11 w-11 rounded-full bg-cyan-400 group-hover:bg-cyan-300 transition-colors shadow-lg shadow-cyan-500/50"></div>
            </button>
            <span className="text-[11px] text-slate-400">Ketuk untuk mengambil foto sampel</span>
          </div>
        </div>
      ) : (
        /* Mode 3: Initial Selection Options */
        <div className="space-y-3">
          {cameraError && (
            <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-3 text-xs text-rose-300">
              {cameraError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => startCamera("environment")}
              disabled={isProcessing}
              type="button"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-cyan-800/60 bg-gradient-to-b from-cyan-950/50 to-slate-900 p-5 text-center transition-all hover:border-cyan-500 hover:bg-cyan-950/70 active:scale-95 disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Camera className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">Buka Kamera</div>
                <div className="text-[11px] text-slate-400">Depan / Belakang</div>
              </div>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              type="button"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-5 text-center transition-all hover:border-slate-500 hover:bg-slate-800/70 active:scale-95 disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700/40 text-slate-300 border border-slate-600">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">Pilih Galeri</div>
                <div className="text-[11px] text-slate-400">Ambil dari file</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
