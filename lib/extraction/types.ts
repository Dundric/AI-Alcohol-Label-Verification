import type {
  AccuracyDecision,
  ExtractedAlcoholLabel,
  ExpectedAlcoholLabel,
} from "@/lib/schemas";

export type Logger = {
  log: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

export type ExtractLabelError = {
  ok: false;
  status: number;
  error: string;
};

export type ExtractLabelSuccess = {
  ok: true;
  label: ExtractedAlcoholLabel;
  evaluation: AccuracyDecision | null;
};

export type ExtractLabelResult = ExtractLabelError | ExtractLabelSuccess;

export type StepResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ExtractLabelError };

export type OpenAIConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
};

export type ExtractionCandidate = {
  extracted: ExtractedAlcoholLabel;
  evaluation: AccuracyDecision | null;
  index: number;
};

// Minimal form-data shape for both Next and Azure Functions.
export type FormDataLike = {
  get: (name: string) => unknown;
};

// Minimal file/blob shape needed to read image bytes.
export type BlobLike = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  type?: string;
  size?: number;
};

export type LoggerFns = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export type { AccuracyDecision, ExtractedAlcoholLabel, ExpectedAlcoholLabel };
