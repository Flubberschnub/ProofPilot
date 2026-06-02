import { GeminiModelClient } from "./gemini.js";
import { MockModelClient } from "./mock.js";
import type { ModelClient, ModelMetadata, ModelProviderName } from "./types.js";
import { VertexModelClient } from "./vertex.js";

let client: ModelClient | undefined;

export function getModelClient() {
  client ??= createModelClient(process.env);
  return client;
}

export function describeModelClient(): ModelMetadata {
  return getModelClient().metadata;
}

export function createModelClient(env: NodeJS.ProcessEnv): ModelClient {
  const provider = resolveProvider(env);

  if (provider === "gemini") {
    return new GeminiModelClient(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? env.PROOFPILOT_MODEL ?? "gemini-2.0-flash");
  }

  if (provider === "vertex") {
    return new VertexModelClient(
      env.VERTEX_PROJECT_ID ?? env.GOOGLE_CLOUD_PROJECT,
      env.VERTEX_LOCATION ?? "us-central1",
      env.VERTEX_ACCESS_TOKEN,
      env.VERTEX_MODEL ?? env.PROOFPILOT_MODEL ?? "gemini-2.0-flash"
    );
  }

  return new MockModelClient();
}

function resolveProvider(env: NodeJS.ProcessEnv): ModelProviderName {
  const explicit = (env.PROOFPILOT_MODEL_PROVIDER ?? env.MODEL_PROVIDER)?.toLowerCase();
  if (explicit === "mock" || explicit === "gemini" || explicit === "vertex") return explicit;

  if (env.MOCK_MODE !== "false") return "mock";
  if (env.VERTEX_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT) return "vertex";
  if (env.GEMINI_API_KEY) return "gemini";
  return "mock";
}
