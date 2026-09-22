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
  Camera,
  Activity,
  Waves,
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
  // Category tabs: "lighting" | "blur_noise" | "water_optical"
  const [activeCategory, setActiveCategory] = useState<"lighting" | "blur_noise" | "water_optical">("lighting");

  // Filter settings
  const [brightness, setBrightness] = useState<number>(0); // -100 to +100
  const [contrast, setContrast] = useState<number>(0); // -60 to +100
  const [saturation, setSaturation] = useState<number>(0); // -100 to +100

  // Blur & Noise
  const [blur, setBlur] = useState<number>(0); // 0 to 15px (lens focus blur)
  const [motionBlur, setMotionBlur] = useState<number>(0); // 0 to 25px (camera shake)
  const [noise, setNoise] = useState<number>(0); // 0 to 100% (ISO grain / digital noise)

  // Water & Optical
  const [turbidity, setTurbidity] = useState<number>(0); // 0 to 100% (air keruh cokelat)
  const [algae, setAlgae] = useState<number>(0); // 0 to 100% (air hijau lumut / algae bloom)
  const [glare, setGlare] = useState<number>(0); // 0 to 100% (pantulan silau air / sun glare)
  const [pixelation, setPixelation] = useState<number>(0); // 0 to 100% (kompresi rendah)

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

    // Responsive native dimensions
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    canvas.width = w;
    canvas.height = h;

    // 1. Calculate base adjustments
    const brightnessVal = 1 + brightness / 100;
    const contrastVal = 1 + contrast / 100;
    const saturateVal = 1 + saturation / 100;
    const cssFilter = `brightness(${brightnessVal}) contrast(${contrastVal}) saturate(${saturateVal}) blur(${blur}px)`;

    // 2. Draw base image with optional pixelation or motion blur
    if (pixelation > 0) {
      const pixelFactor = Math.max(0.04, 1 - (pixelation / 100) * 0.94);
      const smallW = Math.max(16, Math.floor(w * pixelFactor));
      const smallH = Math.max(16, Math.floor(h * pixelFactor));
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = smallW;
      tempCanvas.height = smallH;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.drawImage(img, 0, 0, smallW, smallH);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.filter = cssFilter;
        ctx.drawImage(tempCanvas, 0, 0, smallW, smallH, 0, 0, w, h);
        ctx.restore();
      }
    } else if (motionBlur > 0) {
      ctx.save();
      ctx.filter = cssFilter;
      const steps = 7;
      ctx.globalAlpha = 1 / steps;
      for (let i = -Math.floor(steps / 2); i <= Math.floor(steps / 2); i++) {
        const offset = (i * motionBlur) / steps;
        ctx.drawImage(img, offset, 0, w, h);
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.filter = cssFilter;
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    }

    // 3. Turbidity Simulation (Air kolam keruh cokelat)
    if (turbidity > 0) {
      const alpha = (turbidity / 100) * 0.45;
      ctx.fillStyle = `rgba(105, 85, 50, ${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 4. Algae Bloom Simulation (Air hijau lumut pekat)
    if (algae > 0) {
      const alpha = (algae / 100) * 0.42;
      ctx.fillStyle = `rgba(20, 115, 45, ${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 5. Sun Glare / Specular Reflection on Water Surface
    if (glare > 0) {
      ctx.save();
      const glareX = w * 0.55;
      const glareY = h * 0.4;
      const radius = Math.min(w, h) * 0.35 * (glare / 100) + 40;
      const grad = ctx.createRadialGradient(glareX, glareY, 5, glareX, glareY, radius);
      const alpha = (glare / 100) * 0.85;
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(0.3, `rgba(255, 255, 240, ${alpha * 0.6})`);
      grad.addColorStop(0.65, `rgba(255, 245, 190, ${alpha * 0.25})`);
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 6. Digital Noise / ISO Grain
    if (noise > 0) {
      try {
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const intensity = (noise / 100) * 55;
        for (let i = 0; i < data.length; i += 4) {
          const grain = (Math.random() - 0.5) * intensity;
          data[i] = Math.min(255, Math.max(0, data[i] + grain));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + grain));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + grain));
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (e) {
        console.warn("Noise apply error:", e);
      }
    }
  }, [brightness, contrast, saturation, blur, motionBlur, noise, turbidity, algae, glare, pixelation]);

  useEffect(() => {
    if (isOpen && imageElementRef.current) {
      renderFilteredCanvas();
    }
  }, [
    brightness,
    contrast,
    saturation,
    blur,
    motionBlur,
    noise,
    turbidity,
    algae,
    glare,
    pixelation,
    isOpen,
    renderFilteredCanvas,
  ]);

  // Reset all values helper
  const resetAll = () => {
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setBlur(0);
    setMotionBlur(0);
    setNoise(0);
    setTurbidity(0);
    setAlgae(0);
    setGlare(0);
    setPixelation(0);
  };

  // Preset handlers
  const applyPreset = (presetName: string) => {
    setActivePreset(presetName);
    resetAll();

    switch (presetName) {
      case "normal":
        break;
      case "dark_night":
        setBrightness(-55);
        setContrast(-15);
        setNoise(35);
        break;
      case "bright_sun":
        setBrightness(45);
        setContrast(20);
        setGlare(60);
        break;
      case "motion_blur":
        setMotionBlur(16);
        setBlur(2);
        break;
      case "turbid_water":
        setTurbidity(70);
        setContrast(-20);
        setSaturation(-30);
        break;
      case "algae_bloom":
        setAlgae(65);
        setContrast(-10);
        setSaturation(20);
        break;
      case "sensor_noise":
        setNoise(75);
        setBrightness(-20);
        break;
      case "low_res":
        setPixelation(70);
        setBlur(2);
        break;
      case "high_contrast":
        setContrast(65);
        setSaturation(15);
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

  const isModified =
    brightness !== 0 ||
    contrast !== 0 ||
    saturation !== 0 ||
    blur !== 0 ||
    motionBlur !== 0 ||
    noise !== 0 ||
    turbidity !== 0 ||
    algae !== 0 ||
    glare !== 0 ||
    pixelation !== 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4">
      <div className="flex flex-col w-full max-w-lg max-h-[94vh] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Simulasi Kondisi Ekstrem Lapangan</h3>
              <p className="text-[10px] text-slate-400">
                Uji ketahanan AI terhadap buram, noise, silau air, dan air keruh tambak
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Live Canvas Preview */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-700 bg-black flex items-center justify-center">
            <canvas ref={canvasRef} className="h-full w-full object-contain" />
            {isModified && (
              <div className="absolute top-2 left-2 rounded-md bg-cyan-950/90 border border-cyan-700/60 px-2 py-0.5 text-[10px] font-mono text-cyan-300 shadow-md">
                Simulasi Aktif
              </div>
            )}
          </div>

          {/* Quick Simulation Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                Preset Skenario Lapangan:
              </label>
              {isModified && (
                <button
                  type="button"
                  onClick={() => applyPreset("normal")}
                  className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Reset Semua
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => applyPreset("normal")}
                className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                  activePreset === "normal"
                    ? "bg-slate-800 text-cyan-300 border-cyan-500 font-semibold"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                Normal (Asli)
              </button>

              <button
                type="button"
                onClick={() => applyPreset("motion_blur")}
                className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                  activePreset === "motion_blur"
                    ? "bg-cyan-950/80 text-cyan-200 border-cyan-500 font-semibold"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                Kamera Goyang
              </button>

              <button
                type="button"
                onClick={() => applyPreset("sensor_noise")}
                className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                  activePreset === "sensor_noise"
                    ? "bg-purple-950/80 text-purple-200 border-purple-500 font-semibold"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                Noise Malam
              </button>

              <button
                type="button"
                onClick={() => applyPreset("bright_sun")}
                className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                  activePreset === "bright_sun"
                    ? "bg-amber-950/80 text-amber-200 border-amber-500 font-semibold"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                Silau Air (Glare)
              </button>

              <button
                type="button"
                onClick={() => applyPreset("turbid_water")}
                className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                  activePreset === "turbid_water"
                    ? "bg-amber-950/80 text-amber-200 border-amber-500 font-semibold"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                Air Keruh
              </button>

              <button
                type="button"
                onClick={() => applyPreset("algae_bloom")}
                className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                  activePreset === "algae_bloom"
                    ? "bg-emerald-950/80 text-emerald-200 border-emerald-500 font-semibold"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                Air Hijau Lumut
              </button>

              <button
                type="button"
                onClick={() => applyPreset("dark_night")}
                className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                  activePreset === "dark_night"
                    ? "bg-indigo-950/80 text-indigo-200 border-indigo-500 font-semibold"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                Minim Cahaya
              </button>

              <button
                type="button"
                onClick={() => applyPreset("low_res")}
                className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                  activePreset === "low_res"
                    ? "bg-rose-950/80 text-rose-200 border-rose-500 font-semibold"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                Kompresi Rendah
              </button>

              <button
                type="button"
                onClick={() => applyPreset("high_contrast")}
                className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                  activePreset === "high_contrast"
                    ? "bg-cyan-950/80 text-cyan-200 border-cyan-500 font-semibold"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/40"
                }`}
              >
                Kontras Tinggi
              </button>
            </div>
          </div>

          {/* Subcategory Tabs */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setActiveCategory("lighting")}
                className={`py-1.5 rounded-lg transition-all ${
                  activeCategory === "lighting"
                    ? "bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Cahaya & Kontras
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("blur_noise")}
                className={`py-1.5 rounded-lg transition-all ${
                  activeCategory === "blur_noise"
                    ? "bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Buram & Noise
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("water_optical")}
                className={`py-1.5 rounded-lg transition-all ${
                  activeCategory === "water_optical"
                    ? "bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Air Tambak & Optik
              </button>
            </div>

            {/* Slider Controls by Category */}
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              {activeCategory === "lighting" && (
                <>
                  {/* Brightness */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Sun className="h-3.5 w-3.5 text-amber-400" /> Kecerahan (Brightness)
                      </span>
                      <span className="font-mono text-slate-400">
                        {brightness > 0 ? `+${brightness}%` : `${brightness}%`}
                      </span>
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
                      <span className="font-mono text-slate-400">
                        {contrast > 0 ? `+${contrast}%` : `${contrast}%`}
                      </span>
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

                  {/* Saturation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Droplets className="h-3.5 w-3.5 text-purple-400" /> Saturasi Warna
                      </span>
                      <span className="font-mono text-slate-400">
                        {saturation > 0 ? `+${saturation}%` : `${saturation}%`}
                      </span>
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
                </>
              )}

              {activeCategory === "blur_noise" && (
                <>
                  {/* Focus Blur */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-cyan-400" /> Buram Lensa (Focus Blur)
                      </span>
                      <span className="font-mono text-slate-400">{blur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      value={blur}
                      onChange={(e) => handleSliderChange(setBlur, Number(e.target.value))}
                      className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Motion Blur */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-emerald-400" /> Kamera Goyang (Motion Blur)
                      </span>
                      <span className="font-mono text-slate-400">{motionBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="22"
                      value={motionBlur}
                      onChange={(e) => handleSliderChange(setMotionBlur, Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Digital Noise */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-400" /> Noise Sensor / ISO Grain
                      </span>
                      <span className="font-mono text-slate-400">{noise}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={noise}
                      onChange={(e) => handleSliderChange(setNoise, Number(e.target.value))}
                      className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </>
              )}

              {activeCategory === "water_optical" && (
                <>
                  {/* Turbidity */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Waves className="h-3.5 w-3.5 text-amber-600" /> Kekeruhan Air (Pond Turbidity)
                      </span>
                      <span className="font-mono text-slate-400">{turbidity}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={turbidity}
                      onChange={(e) => handleSliderChange(setTurbidity, Number(e.target.value))}
                      className="w-full accent-amber-600 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Algae Bloom */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Droplets className="h-3.5 w-3.5 text-emerald-400" /> Air Hijau Lumut (Algae Bloom)
                      </span>
                      <span className="font-mono text-slate-400">{algae}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={algae}
                      onChange={(e) => handleSliderChange(setAlgae, Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Sun Glare */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Sun className="h-3.5 w-3.5 text-yellow-300" /> Pantulan Silau Air (Sun Glare)
                      </span>
                      <span className="font-mono text-slate-400">{glare}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={glare}
                      onChange={(e) => handleSliderChange(setGlare, Number(e.target.value))}
                      className="w-full accent-yellow-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Pixelation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-rose-400" /> Kompresi / Pikselasi Rendah
                      </span>
                      <span className="font-mono text-slate-400">{pixelation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={pixelation}
                      onChange={(e) => handleSliderChange(setPixelation, Number(e.target.value))}
                      className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="grid grid-cols-2 gap-2 p-3 border-t border-slate-800 bg-slate-900/95">
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
            className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/20 hover:opacity-95 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <Check className="h-4 w-4" />
            {isRendering ? "Menerapkan..." : "Terapkan & Uji Model"}
          </button>
        </div>
      </div>
    </div>
  );
}
