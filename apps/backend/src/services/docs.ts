import type { DemoRequest, WorkflowRequest } from "../types.js";
import yaml from "js-yaml";

const maxDocsChars = Number(process.env.PROOFPILOT_MAX_DOCS_CHARS ?? 120000);

export async function resolveWorkflowDocs(input: WorkflowRequest): Promise<DemoRequest> {
  if (input.docsUrl) {
    const fetched = await fetchDocsFromUrl(input.docsUrl);
    if (fetched.text.length < 50) {
      throw new Error(`Could not extract enough documentation text from ${input.docsUrl}. Try a more direct docs, OpenAPI, Markdown, or HTML URL.`);
    }

    return normalizeResolvedRequest(input, fetched.text, fetched.url);
  }

  const pastedDocs = input.docsText?.trim();
  if (pastedDocs && pastedDocs.length >= 50) {
    return normalizeResolvedRequest(input, pastedDocs);
  }

  throw new Error("Provide either API docs text or a URL to the API documentation.");
}

function normalizeResolvedRequest(input: WorkflowRequest, docsText: string, docsSourceUrl?: string): DemoRequest {
  const context = input.context?.trim();
  const fallbackGoal = context || "Generate a source-grounded bespoke API demo from the provided API documentation and customer data.";

  return {
    ...input,
    apiName: input.apiName.trim(),
    docsText,
    docsSourceUrl,
    industry: input.industry?.trim() || inferIndustry(input.customerId, context),
    audience: input.audience ?? "sales",
    goal: input.goal?.trim() || fallbackGoal,
    context,
    preferredStack: input.preferredStack?.trim(),
    liveApiAllowed: input.liveApiAllowed ?? false,
    customerId: input.customerId?.trim() || undefined,
    customerPersona: input.customerPersona?.trim() || undefined,
    targetSystem: input.targetSystem?.trim() || undefined
  };
}

function inferIndustry(customerId?: string, context?: string) {
  const text = `${customerId ?? ""} ${context ?? ""}`.toLowerCase();
  if (text.includes("aerocore") || text.includes("leasing") || text.includes("drone")) return "Industrial equipment leasing";
  if (text.includes("insurance") || text.includes("claim")) return "Insurance";
  if (text.includes("health") || text.includes("patient")) return "Healthcare";
  if (text.includes("bank") || text.includes("loan")) return "Financial services";
  return "Customer operations";
}

async function fetchDocsFromUrl(docsUrl: string) {
  const url = new URL(docsUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Docs URL must start with http:// or https://.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/json,application/yaml,text/markdown,text/plain;q=0.9",
        "User-Agent": "ProofPilot/0.1 docs fetcher"
      }
    });

    if (!response.ok) {
      throw new Error(`Docs fetch failed (${response.status}): ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();
    const text = extractDocsText(raw, contentType);
    return {
      url: response.url || docsUrl,
      text: trimDocs(text)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractDocsText(raw: string, contentType: string) {
  if (/json/i.test(contentType) || looksLikeJson(raw)) {
    const parsed = tryParseJson(raw);
    if (parsed.ok) return stringifyStructuredDocs(parsed.value);
    return fallbackText(raw, `Fetched docs looked like JSON but could not be parsed: ${parsed.error}`);
  }

  if (/ya?ml/i.test(contentType) || looksLikeYaml(raw)) {
    const parsed = tryParseYaml(raw);
    if (parsed.ok) return stringifyStructuredDocs(parsed.value);
    return fallbackText(raw, `Fetched docs looked like YAML but could not be parsed: ${parsed.error}`);
  }

  if (/html/i.test(contentType) || /<html|<body|<main|<article/i.test(raw)) {
    return htmlToText(raw);
  }

  return raw;
}

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

function tryParseYaml(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: yaml.load(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid YAML" };
  }
}

function fallbackText(raw: string, reason: string) {
  const text = /<html|<body|<main|<article/i.test(raw) ? htmlToText(raw) : raw;
  return `${reason}\n\n${text}`;
}

function stringifyStructuredDocs(value: unknown) {
  if (!value || typeof value !== "object") return String(value ?? "");
  return JSON.stringify(value, null, 2);
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(h[1-6]|p|li|tr|section|article|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function trimDocs(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxDocsChars);
}

function looksLikeJson(raw: string) {
  return /^[\s\n]*[{\[]/.test(raw);
}

function looksLikeYaml(raw: string) {
  return /\bopenapi:\s*3|\bswagger:\s*["']?2|^info:\s*$/im.test(raw);
}
