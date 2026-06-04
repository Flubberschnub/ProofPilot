import type { DemoRequest, WorkflowRequest } from "../types.js";
import yaml from "js-yaml";

const maxDocsChars = Number(process.env.PROOFPILOT_MAX_DOCS_CHARS ?? 120000);

export async function resolveWorkflowDocs(input: WorkflowRequest): Promise<DemoRequest> {
  if (input.docsUrl) {
    const fetched = await fetchDocsFromUrl(input.docsUrl);
    if (fetched.text.length < 50) {
      throw new Error(`Could not extract enough documentation text from ${input.docsUrl}. Try a more direct docs, OpenAPI, Markdown, or HTML URL.`);
    }

    return {
      ...input,
      apiName: input.apiName.trim(),
      docsText: fetched.text,
      docsSourceUrl: fetched.url
    };
  }

  const pastedDocs = input.docsText?.trim();
  if (pastedDocs && pastedDocs.length >= 50) {
    return { ...input, docsText: pastedDocs };
  }

  throw new Error("Provide either API docs text or a URL to the API documentation.");
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
    return stringifyStructuredDocs(JSON.parse(raw));
  }

  if (/ya?ml/i.test(contentType) || looksLikeYaml(raw)) {
    const parsed = yaml.load(raw);
    return stringifyStructuredDocs(parsed);
  }

  if (/html/i.test(contentType) || /<html|<body|<main|<article/i.test(raw)) {
    return htmlToText(raw);
  }

  return raw;
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
