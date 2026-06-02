import { buildJsonPrompt, parseJsonResponse } from "./json.js";
import type { GenerateJsonRequest, GenerateTextRequest, ModelClient, ModelMetadata } from "./types.js";

type VertexResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export class VertexModelClient implements ModelClient {
  readonly metadata: ModelMetadata;

  constructor(
    private readonly projectId: string | undefined,
    private readonly location = "us-central1",
    private readonly accessToken: string | undefined,
    private readonly model = "gemini-2.0-flash"
  ) {
    this.metadata = {
      provider: "vertex",
      model,
      configured: Boolean(projectId && accessToken),
      mode: "live"
    };
  }

  async generateText(request: GenerateTextRequest): Promise<string> {
    if (!this.projectId) {
      throw new Error("VERTEX_PROJECT_ID is required when PROOFPILOT_MODEL_PROVIDER=vertex.");
    }
    if (!this.accessToken) {
      throw new Error("VERTEX_ACCESS_TOKEN is required when PROOFPILOT_MODEL_PROVIDER=vertex.");
    }

    const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
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
      throw new Error(`Vertex AI request failed (${response.status}): ${await response.text()}`);
    }

    return readText(await response.json() as VertexResponse);
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

function readText(response: VertexResponse) {
  const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Vertex AI response did not include text content.");
  return text;
}
