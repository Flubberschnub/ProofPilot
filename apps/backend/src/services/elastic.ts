import type { SourceChunk } from "../types.js";
import { nanoid } from "nanoid";

const memoryIndex = new Map<string, SourceChunk[]>();

export async function indexDocs(sourceId: string, apiName: string, docsText: string): Promise<SourceChunk[]> {
  const sections = docsText
    .split(/(?=^##\s+)/m)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunks = sections.map((section, index) => {
    const title = section.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? (index === 0 ? apiName : `Section ${index + 1}`);
    return {
      id: `chunk_${nanoid(8)}`,
      sourceId,
      title,
      text: section.slice(0, 5000),
      sourceType: "markdown" as const,
      metadata: { apiName }
    };
  });

  memoryIndex.set(sourceId, chunks);
  return chunks;
}

export async function retrieveEvidence(sourceId: string, query: string, maxResults = 4): Promise<SourceChunk[]> {
  const chunks = memoryIndex.get(sourceId) ?? [];
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);

  return chunks
    .map((chunk) => {
      const haystack = `${chunk.title} ${chunk.text}`.toLowerCase();
      const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((x) => x.chunk);
}

// TODO: Replace memoryIndex with real Elastic implementation.
// Suggested production shape:
// - index: proofpilot-doc-chunks
// - fields: sourceId, title, text, sourceType, method, path, embedding, capability_tags
// - retrieval: hybrid BM25 + vector search + metadata filters
