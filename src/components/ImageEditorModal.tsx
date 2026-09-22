"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sliders,
  Sun,
  Contrast,
  Droplets,
  RotateCcw,
  Sparkles,
  Check,
  X,
  Eye,
  Zap,
  Layers,
  AlertTriangle,
} from "lucide-react";

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalFile: File | null;
  originalPreviewUrl: string | null;
  onApply: (editedFile: File, editedPreviewUrl: string) => void;
}

export function ImageEditorModal({
  isOpen,
  onClose,
  originalFile,
  originalPreviewUrl,
  onApply,
}: ImageEditorModalProps) {
  // Filter settings
  const [brightness, setBrightness] = useState<number>(0); // -100 to +100
  const [contrast, setContrast] = useState<number>(0); // -50 to +100
  const [saturation, setSaturation] = useState<number>(0); // -100 to +100
  const [turbidity, setTurbidity] = useState<number>(0); // 0 to 100 (air keruh tambak)

  const [activePreset, setActivePreset] = useState<string>("custom");
  const [isRendering, setIsRendering] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Load image element when modal opens or preview URL changes
  useEffect(() => {
    if (!originalPreviewUrl || !isOpen) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageElementRef.current = img;
      renderFilteredCanvas();
    };
    img.src = originalPreviewUrl;
  }, [originalPreviewUrl, isOpen]);

  // Redraw canvas whenever filter values change
  const renderFilteredCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageElementRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use responsive display width
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    canvas.width = w;
    canvas.height = h;

    // Calculate CSS filter string
    const brightnessVal = 1 + brightness / 100; // e.g. 0.5 to 1.5
    const contrastVal = 1 + contrast / 100; // e.g. 0.5 to 2.0
    const saturateVal = 1 + saturation / 100; // e.g. 0 to 2.0

    ctx.save();
    ctx.filter = `brightness(${brightnessVal}) contrast(${contrastVal}) saturate(${saturateVal})`;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();

    // Turbidity simulation (Air kolam keruh: warm brownish tint + slight haze)
    if (turbidity > 0) {
      const alpha = (turbidity / 100) * 0.45;
      ctx.fillStyle = `rgba(101, 84, 52, ${alpha})`; // greenish-brown pond water
      ctx.fillRect(0, 0, w, h);
    }
  }, [brightness, contrast, saturation, turbidity]);

  useEffect(() => {
    if (isOpen && imageElementRef.current) {
      renderFilteredCanvas();
    }
  }, [brightness, contrast, saturation, turbidity, isOpen, renderFilteredCanvas]);

  // Preset handlers
  const applyPreset = (presetName: string) => {
    setActivePreset(presetName);
    switch (presetName) {
      case "normal":
        setBrightness(0);
        setContrast(0);
        setSaturation(0);
        setTurbidity(0);
        break;
      case "dark_night":
        setBrightness(-55);
        setContrast(-15);
        setSaturation(-20);
        setTurbidity(0);
        break;
      case "bright_sun":
        setBrightness(50);
        setContrast(25);
        setSaturation(10);
        setTurbidity(0);
        break;
      case "turbid_water":
        setBrightness(-10);
        setContrast(-25);
        setSaturation(-35);
        setTurbidity(65);
        break;
      case "high_contrast":
        setBrightness(-5);
        setContrast(65);
        setSaturation(15);
        setTurbidity(0);
        break;
      default:
        break;
    }
  };

  const handleSliderChange = (setter: React.Dispatch<React.SetStateAction<number>>, val: number) => {
    setActivePreset("custom");
    setter(val);
  };

  const handleSaveAndApply = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !originalFile) return;

    setIsRendering(true);
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setIsRendering(false);
            return;
          }
          const editedFile = new File([blob], `simulated_${Date.now()}_${originalFile.name}`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          const newUrl = URL.createObjectURL(blob);
          onApply(editedFile, newUrl);
          setIsRendering(false);
          onClose();
        },
        "image/jpeg",
        0.88
      );
    } catch (err) {
      console.error("Error creating edited blob:", err);
      setIsRendering(false);
    }
  };

  if (!isOpen) return null;

  const isModified = brightness !== 0 || contrast !== 0 || saturation !== 0 || turbidity !== 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4">
      <div className="flex flex-col w-full max-w-lg max-h-[92vh] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Simulasi Kondisi Ekstrem / Edit Gambar</h3>
              <p className="text-[10px] text-slate-400">
                Uji ketahanan AI pada kondisi minim cahaya, terik silau, atau air keruh
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Live Canvas Preview */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-700 bg-black flex items-center justify-center">
            <canvas ref={canvasRef} className="h-full w-full object-contain" />
            {isModified && (
              <div className="absolute top-2 left-2 rounded-md bg-cyan-950/80 border border-cyan-700/60 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                Simulasi Aktif
              </div>
            )}
          </div>

          {/* Quick Simulation Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Pilih Skenario Ekstrem Lapangan:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset("normal")}
                className={`flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium border text-left transition-all ${
                  activePreset === "normal"
                    ? "bg-slate-800 text-white border-cyan-500"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                Normal (Asli)
              </button>

              <button
                type="button"
                onClick={() => applyPreset("dark_night")}
                className={`flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium border text-left transition-all ${
                  activePreset === "dark_night"
                    ? "bg-indigo-950/60 text-indigo-200 border-indigo-500"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                <div className="h-2 w-2 rounded-full bg-indigo-400 shrink-0"></div>
                Malam / Gelap
              </button>

              <button
                type="button"
                onClick={() => applyPreset("bright_sun")}
                className={`flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium border text-left transition-all ${
                  activePreset === "bright_sun"
                    ? "bg-amber-950/60 text-amber-200 border-amber-500"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                Silau Terik
              </button>

              <button
                type="button"
                onClick={() => applyPreset("turbid_water")}
                className={`flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium border text-left transition-all ${
                  activePreset === "turbid_water"
                    ? "bg-emerald-950/60 text-emerald-200 border-emerald-500"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                <Droplets className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                Air Keruh
              </button>

              <button
                type="button"
                onClick={() => applyPreset("high_contrast")}
                className={`flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium border text-left transition-all col-span-2 sm:col-span-1 ${
                  activePreset === "high_contrast"
                    ? "bg-cyan-950/60 text-cyan-200 border-cyan-500"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                <Contrast className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                Kontras Tinggi
              </button>
            </div>
          </div>

          {/* Detailed Sliders */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            {/* Brightness */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-amber-400" /> Kecerahan (Brightness)
                </span>
                <span className="font-mono text-slate-400">{brightness > 0 ? `+${brightness}%` : `${brightness}%`}</span>
              </div>
              <input
                type="range"
                min="-80"
                max="80"
                value={brightness}
                onChange={(e) => handleSliderChange(setBrightness, Number(e.target.value))}
                className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Contrast */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Contrast className="h-3.5 w-3.5 text-cyan-400" /> Kontras (Contrast)
                </span>
                <span className="font-mono text-slate-400">{contrast > 0 ? `+${contrast}%` : `${contrast}%`}</span>
              </div>
              <input
                type="range"
                min="-60"
                max="80"
                value={contrast}
                onChange={(e) => handleSliderChange(setContrast, Number(e.target.value))}
                className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Turbidity / Air Keruh */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5 text-emerald-400" /> Kekeruhan Air (Pond Turbidity)
                </span>
                <span className="font-mono text-slate-400">{turbidity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={turbidity}
                onChange={(e) => handleSliderChange(setTurbidity, Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5 text-purple-400" /> Saturasi Warna
                </span>
                <span className="font-mono text-slate-400">{saturation > 0 ? `+${saturation}%` : `${saturation}%`}</span>
              </div>
              <input
                type="range"
                min="-80"
                max="80"
                value={saturation}
                onChange={(e) => handleSliderChange(setSaturation, Number(e.target.value))}
                className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="grid grid-cols-2 gap-2 p-3 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={isRendering}
            onClick={handleSaveAndApply}
            className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/20 hover:opacity-95 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {isRendering ? "Menerapkan..." : "Terapkan & Uji Model"}
          </button>
        </div>
      </div>
    </div>
  );
}
