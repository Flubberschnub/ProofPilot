export type ModelProviderName = "mock" | "gemini" | "vertex";

export type ModelMetadata = {
  provider: ModelProviderName;
  model: string;
  configured: boolean;
  mode: "mock" | "live";
};

export type GenerateTextRequest = {
  system?: string;
  prompt: string;
  temperature?: number;
  responseMimeType?: "text/plain" | "application/json";
};

export type GenerateJsonRequest<T> = Omit<GenerateTextRequest, "responseMimeType"> & {
  schemaName: string;
  schema?: unknown;
  fallback: () => T;
};

export interface ModelClient {
  readonly metadata: ModelMetadata;
  generateText(request: GenerateTextRequest): Promise<string>;
  generateJson<T>(request: GenerateJsonRequest<T>): Promise<T>;
}
