import { buildJsonPrompt, parseJsonResponse } from "./json.js";
import type { GenerateJsonRequest, GenerateTextRequest, ModelClient, ModelMetadata } from "./types.js";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export class GeminiModelClient implements ModelClient {
  readonly metadata: ModelMetadata;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model = "gemini-2.0-flash"
  ) {
    this.metadata = {
      provider: "gemini",
      model,
      configured: Boolean(apiKey),
      mode: "live"
    };
  }

  async generateText(request: GenerateTextRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is required when PROOFPILOT_MODEL_PROVIDER=gemini.");
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey
      },
      body: JSON.stringify({
        systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          responseMimeType: request.responseMimeType
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API request failed (${response.status}): ${await response.text()}`);
    }

    return readText(await response.json() as GeminiResponse);
  }

  async generateJson<T>(request: GenerateJsonRequest<T>): Promise<T> {
    const text = await this.generateText({
      ...request,
      prompt: buildJsonPrompt(request.prompt, request.schemaName, request.schema),
      responseMimeType: "application/json"
    });
    return parseJsonResponse<T>(text);
  }
}

function readText(response: GeminiResponse) {
  const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini API response did not include text content.");
  return text;
}
