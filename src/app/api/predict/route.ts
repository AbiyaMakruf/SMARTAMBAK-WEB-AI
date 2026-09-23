import { NextRequest, NextResponse } from "next/server";
import { SingleModelInferenceResult, UltralyticsResponse } from "@/types/prediction";

const PRIMARY_API_KEY = process.env.ULTRALYTICS_API_KEY || "ul_8386598a334c3a245f372dbf2071aa1f7f03f5bf";
const FALLBACK_API_KEY = "ul_2ca442bc5d7c26bf7df782ad65e67083edde8bb8";

const MODEL_CONFIGS = [
  {
    id: "model_1" as const,
    key: "multiclass" as const,
    name: "Model 1: Multiclass (Penyakit Spesifik)",
    baseUrl: process.env.NEXT_PUBLIC_MODEL_1_URL || "https://predict-6ab3fedd1e05d96795884b28-dproatj77a-et.a.run.app",
    preferredKey: PRIMARY_API_KEY,
  },
  {
    id: "model_2" as const,
    key: "binaryclass" as const,
    name: "Model 2: Binaryclass (Sehat vs Sakit)",
    baseUrl: process.env.NEXT_PUBLIC_MODEL_2_URL || "https://predict-6ab3fee4cb033e32d1ef6cb2-dproatj77a-et.a.run.app",
    preferredKey: PRIMARY_API_KEY,
  },
  {
    id: "model_3" as const,
    key: "oldmodel" as const,
    name: "Model 3: Baseline (Old Model)",
    baseUrl: process.env.NEXT_PUBLIC_MODEL_3_URL || "https://predict-6a0e0767af1f97748662-dproatj77a-et.a.run.app",
    preferredKey: FALLBACK_API_KEY,
  },
];

async function callUltralyticsModel(
  baseUrl: string,
  imageBlob: Blob,
  fileName: string,
  preferredKey = PRIMARY_API_KEY,
  conf = "0.25",
  iou = "0.7",
  imgsz = "640"
): Promise<UltralyticsResponse> {
  const url = baseUrl.endsWith("/predict") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/predict`;

  const makeRequest = async (keyToUse: string) => {
    const formData = new FormData();
    formData.append("file", imageBlob, fileName);
    formData.append("conf", conf);
    formData.append("iou", iou);
    formData.append("imgsz", imgsz);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${keyToUse}`,
        },
        body: formData,
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let res = await makeRequest(preferredKey);

  // If 401 Unauthorized, automatically try the alternate API key
  if (res.status === 401) {
    const alternateKey = preferredKey === PRIMARY_API_KEY ? FALLBACK_API_KEY : PRIMARY_API_KEY;
    console.log(`401 encountered on ${baseUrl}, retrying with alternate key...`);
    res = await makeRequest(alternateKey);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
  }

  const data = await res.json();
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;
    const modelParam = req.nextUrl.searchParams.get("model");
    const conf = (formData.get("conf") as string) || "0.25";
    const iou = (formData.get("iou") as string) || "0.7";
    const imgsz = (formData.get("imgsz") as string) || "640";

    if (!file) {
      return NextResponse.json({ error: "File gambar tidak ditemukan dalam request" }, { status: 400 });
    }

    const fileName = (file as File).name || "sample.jpg";

    // If a specific model is targeted (e.g. ?model=model_1)
    if (modelParam) {
      const target = MODEL_CONFIGS.find((m) => m.id === modelParam || m.key === modelParam);
      if (!target) {
        return NextResponse.json({ error: `Model ID ${modelParam} tidak valid` }, { status: 400 });
      }

      const startTime = Date.now();
      try {
        const data = await callUltralyticsModel(target.baseUrl, file, fileName, target.preferredKey, conf, iou, imgsz);
        const durationMs = Date.now() - startTime;
        const result: SingleModelInferenceResult = {
          modelId: target.id,
          modelName: target.name,
          modelKey: target.key,
          status: "success",
          data,
          durationMs,
        };
        return NextResponse.json(result);
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        return NextResponse.json(
          {
            modelId: target.id,
            modelName: target.name,
            modelKey: target.key,
            status: "error",
            error: err.message || "Gagal melakukan inferensi pada model",
            durationMs,
          },
          { status: 502 }
        );
      }
    }

    // Default: Run all 3 models in parallel via Promise.allSettled
    const startTime = Date.now();
    const results = await Promise.allSettled(
      MODEL_CONFIGS.map(async (model) => {
        const mStart = Date.now();
        const data = await callUltralyticsModel(model.baseUrl, file, fileName, model.preferredKey, conf, iou, imgsz);
        return {
          modelId: model.id,
          modelName: model.name,
          modelKey: model.key,
          status: "success" as const,
          data,
          durationMs: Date.now() - mStart,
        };
      })
    );

    const formattedResults: SingleModelInferenceResult[] = results.map((res, idx) => {
      const model = MODEL_CONFIGS[idx];
      if (res.status === "fulfilled") {
        return res.value;
      } else {
        return {
          modelId: model.id,
          modelName: model.name,
          modelKey: model.key,
          status: "error",
          error: res.reason?.message || "Gagal melakukan inferensi",
          durationMs: Date.now() - startTime,
        };
      }
    });

    return NextResponse.json({
      totalDurationMs: Date.now() - startTime,
      results: formattedResults,
    });
  } catch (error: any) {
    console.error("Inference proxy error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
