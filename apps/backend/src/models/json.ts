export function buildJsonPrompt(prompt: string, schemaName: string, schema?: unknown) {
  const schemaBlock = schema ? `\n\nJSON shape for ${schemaName}:\n${JSON.stringify(schema, null, 2)}` : "";
  return `${prompt}${schemaBlock}\n\nReturn only valid JSON. Do not wrap it in Markdown.`;
}

export function parseJsonResponse<T>(text: string): T {
  const cleaned = stripMarkdownFence(text).trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const objectText = extractJsonObject(cleaned);
    if (!objectText) {
      throw new Error(`Model response did not contain JSON: ${cleaned.slice(0, 300)}`);
    }
    return JSON.parse(objectText) as T;
  }
}

function stripMarkdownFence(text: string) {
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence?.[1] ?? text;
}

function extractJsonObject(text: string) {
  const firstObject = text.indexOf("{");
  const firstArray = text.indexOf("[");
  const starts = [firstObject, firstArray].filter((index) => index >= 0);
  if (!starts.length) return undefined;

  const start = Math.min(...starts);
  const opening = text[start];
  const closing = opening === "{" ? "}" : "]";
  const end = text.lastIndexOf(closing);
  return end > start ? text.slice(start, end + 1) : undefined;
}
