import type { GenerateJsonRequest, GenerateTextRequest, ModelClient, ModelMetadata } from "./types.js";

export class MockModelClient implements ModelClient {
  readonly metadata: ModelMetadata = {
    provider: "mock",
    model: "proofpilot-heuristics",
    configured: true,
    mode: "mock"
  };

  async generateText(request: GenerateTextRequest): Promise<string> {
    return request.prompt;
  }

  async generateJson<T>(request: GenerateJsonRequest<T>): Promise<T> {
    return request.fallback();
  }
}
