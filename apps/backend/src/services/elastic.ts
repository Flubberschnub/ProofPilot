import type { SourceChunk } from "../types.js";
import { Client } from "@elastic/elasticsearch";
import { nanoid } from "nanoid";

const memoryIndex = new Map<string, SourceChunk[]>();
let elasticClient: Client | undefined;

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
  if (useElastic()) {
    const client = getElasticClient();
    const index = elasticIndexName();

    await client.indices.create({
      index,
      mappings: {
        properties: {
          sourceId: { type: "keyword" },
          title: { type: "text" },
          text: { type: "text" },
          sourceType: { type: "keyword" },
          metadata: { type: "object", enabled: true }
        }
      }
    }, { ignore: [400] });

    if (chunks.length) {
      await client.bulk({
        refresh: true,
        operations: chunks.flatMap((chunk) => [
          { index: { _index: index, _id: chunk.id } },
          chunk
        ])
      });
    }
  }

  return chunks;
}

export async function retrieveEvidence(sourceId: string, query: string, maxResults = 4): Promise<SourceChunk[]> {
  if (useElastic()) {
    const result = await getElasticClient().search<SourceChunk>({
      index: elasticIndexName(),
      size: maxResults,
      query: {
        bool: {
          filter: [{ term: { sourceId } }],
          must: [{
            multi_match: {
              query,
              fields: ["title^2", "text"]
            }
          }]
        }
      }
    });

    return result.hits.hits.map((hit) => hit._source).filter((chunk): chunk is SourceChunk => Boolean(chunk));
  }

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

function useElastic() {
  return (process.env.PROOFPILOT_ELASTIC_PROVIDER ?? "").toLowerCase() === "elastic";
}

function getElasticClient() {
  if (elasticClient) return elasticClient;

  const node = process.env.ELASTIC_URL;
  if (!node) throw new Error("ELASTIC_URL is required when PROOFPILOT_ELASTIC_PROVIDER=elastic.");

  elasticClient = new Client({
    node,
    auth: process.env.ELASTIC_API_KEY ? { apiKey: process.env.ELASTIC_API_KEY } : undefined
  });
  return elasticClient;
}

function elasticIndexName() {
  return process.env.ELASTIC_INDEX ?? "proofpilot-doc-chunks";
}
