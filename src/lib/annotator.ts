import { DetectionResult } from "@/types/prediction";

export interface BoxColor {
  stroke: string;
  fill: string;
  textBg: string;
  text: string;
}

export function getAnnotationColor(className: string): BoxColor {
  const lower = className.toLowerCase();
  if (lower.includes("healthy") || lower.includes("sehat")) {
    return {
      stroke: "#10b981", // emerald-500
      fill: "rgba(16, 185, 129, 0.15)",
      textBg: "#065f46",
      text: "#ffffff",
    };
  }
  if (lower.includes("wssv") || lower.includes("sakit") || lower.includes("disease")) {
    return {
      stroke: "#f43f5e", // rose-500
      fill: "rgba(244, 63, 94, 0.18)",
      textBg: "#881337",
      text: "#ffffff",
    };
  }
  if (lower.includes("black-gill") || lower.includes("blackgill") || lower.includes("insang")) {
    return {
      stroke: "#f59e0b", // amber-500
      fill: "rgba(245, 158, 11, 0.18)",
      textBg: "#78350f",
      text: "#ffffff",
    };
  }
  if (lower.includes("yellowhead") || lower.includes("kuning")) {
    return {
      stroke: "#eab308", // yellow-500
      fill: "rgba(234, 179, 8, 0.18)",
      textBg: "#713f12",
      text: "#ffffff",
    };
  }
  return {
    stroke: "#06b6d4", // cyan-500
    fill: "rgba(6, 182, 212, 0.15)",
    textBg: "#164e63",
    text: "#ffffff",
  };
}

/**
 * Loads an image from a URL or Blob string safely with CORS
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Renders annotated image with bounding boxes onto a canvas
 */
export function drawAnnotations(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  detections: DetectionResult[] = [],
  modelLabel?: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  canvas.width = w;
  canvas.height = h;

  // 1. Draw original base image
  ctx.drawImage(img, 0, 0, w, h);

  // Scale factor for font and line widths based on resolution
  const scale = Math.max(1, Math.min(w, h) / 640);
  const lineWidth = Math.max(2, Math.round(3 * scale));
  const fontSize = Math.max(12, Math.round(14 * scale));

  // 2. Draw each bounding box
  detections.forEach((det) => {
    let { x1, y1, x2, y2 } = det.box;

    // Normalize if in 0..1 range
    if (x1 <= 1 && x2 <= 1 && y1 <= 1 && y2 <= 1) {
      x1 = x1 * w;
      x2 = x2 * w;
      y1 = y1 * h;
      y2 = y2 * h;
    }

    const boxW = Math.max(1, x2 - x1);
    const boxH = Math.max(1, y2 - y1);
    const color = getAnnotationColor(det.name);

    // Box fill
    ctx.fillStyle = color.fill;
    ctx.fillRect(x1, y1, boxW, boxH);

    // Box border
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x1, y1, boxW, boxH);

    // Label text
    const confPercent = Math.round(det.confidence * 100);
    const labelText = `${det.name} ${confPercent}%`;

    ctx.font = `bold ${fontSize}px sans-serif`;
    const textMetrics = ctx.measureText(labelText);
    const textPaddingX = 6 * scale;
    const textPaddingY = 4 * scale;
    const badgeW = textMetrics.width + textPaddingX * 2;
    const badgeH = fontSize + textPaddingY * 2;

    const badgeX = Math.max(0, Math.min(w - badgeW, x1));
    const badgeY = y1 - badgeH >= 0 ? y1 - badgeH : y1;

    // Badge background
    ctx.fillStyle = color.textBg;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

    // Badge border
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = Math.max(1, Math.round(1 * scale));
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    // Badge text
    ctx.fillStyle = color.text;
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, badgeX + textPaddingX, badgeY + badgeH / 2);
  });

  // 3. Top Header banner watermark for model identification
  if (modelLabel) {
    const headerFont = Math.max(11, Math.round(13 * scale));
    ctx.font = `600 ${headerFont}px sans-serif`;
    const labelWithCount = `${modelLabel} • ${detections.length} Box Deteksi`;
    const metrics = ctx.measureText(labelWithCount);
    const pad = 6 * scale;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(10 * scale, 10 * scale, metrics.width + pad * 2, headerFont + pad * 2);

    ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10 * scale, 10 * scale, metrics.width + pad * 2, headerFont + pad * 2);

    ctx.fillStyle = "#38bdf8";
    ctx.textBaseline = "middle";
    ctx.fillText(labelWithCount, 10 * scale + pad, 10 * scale + (headerFont + pad * 2) / 2);
  }
}

/**
 * Creates a JPEG Blob from image + detections
 */
export async function createAnnotatedBlob(
  imgSrc: string,
  detections: DetectionResult[] = [],
  modelLabel?: string
): Promise<Blob | null> {
  try {
    const img = await loadImage(imgSrc);
    const canvas = document.createElement("canvas");
    drawAnnotations(canvas, img, detections, modelLabel);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        "image/jpeg",
        0.88
      );
    });
  } catch (err) {
    console.error("Failed to create annotated blob:", err);
    return null;
  }
}
