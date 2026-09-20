// Ultralytics Model Result Types based on the API response structure

export interface BoundingBox {
  x1: number; // normalized coordinate (0 to 1) or pixel coordinate
  y1: number;
  x2: number;
  y2: number;
}

export interface DetectionResult {
  name: string; // e.g. "healthy", "wssv", "black-gill", "yellowhead"
  class: number;
  confidence: number; // e.g. 0.52984
  box: BoundingBox;
}

export interface ModelSpeed {
  preprocess?: number;
  inference?: number;
  postprocess?: number;
}

export interface ModelMetadata {
  imageCount?: number;
  classNames?: string[];
  functionTimeAlive?: number;
  functionTimeCall?: number;
  task?: string;
  version?: {
    ultralytics?: string;
    torch?: string;
    torchvision?: string;
    python?: string;
  };
}

export interface UltralyticsResponse {
  images?: Array<{
    shape?: [number, number]; // [height, width]
    speed?: ModelSpeed;
    results?: DetectionResult[];
  }>;
  metadata?: ModelMetadata;
  networkTime?: number;
  error?: string;
}

export interface SingleModelInferenceResult {
  modelId: "model_1" | "model_2" | "model_3";
  modelName: string;
  modelKey: "multiclass" | "binaryclass" | "oldmodel";
  status: "success" | "error";
  data?: UltralyticsResponse;
  error?: string;
  durationMs?: number;
}

export interface ShrimpPredictionRecord {
  id?: string;
  created_at?: string;
  image_url: string;
  model_1_output: UltralyticsResponse | null;
  model_2_output: UltralyticsResponse | null;
  model_3_output: UltralyticsResponse | null;
  human_is_shrimp: boolean;
  selected_models: string[]; // e.g. ["model_1", "model_2"]
  notes?: string;
}

export interface ModelMetricDetail {
  modelId: "model_1" | "model_2" | "model_3";
  name: string;
  accuracy: number; // percentage
  totalEvaluated: number;
  agreedCount: number; // True Positives + True Negatives
  errorCount: number; // Total mistakes
  falsePositiveCount: number; // Detected boxes when sample is NOT shrimp
  falseNegativeCount: number; // 0 boxes when sample IS shrimp
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
}

export interface DetailedReportStats {
  totalSamples: number;
  totalShrimp: number;
  totalNotShrimp: number;
  totalErroneousSamples: number; // samples where at least 1 model failed or misdetected
  models: {
    model_1: ModelMetricDetail;
    model_2: ModelMetricDetail;
    model_3: ModelMetricDetail;
  };
  diseaseBreakdown: Record<string, number>;
}
