import type { SourceChunk } from "../types.js";
import { Client } from "@elastic/elasticsearch";
import { nanoid } from "nanoid";

const memoryIndex = new Map<string, SourceChunk[]>();
let elasticClient: Client | undefined;

type CustomerDocument = {
  path: string;
  text: string;
};

export async function indexDocs(sourceId: string, apiName: string, docsText: string): Promise<SourceChunk[]> {
  const chunks = chunkText(sourceId, apiName, docsText, "markdown", { apiName });
  await persistChunks(elasticDocsIndexName(), sourceId, chunks);
  return chunks;
}

export async function indexCustomerData(sourceId: string, customerId: string, documents: CustomerDocument[]): Promise<SourceChunk[]> {
  const chunks = documents.flatMap((document) => {
    const label = document.path.replace(/\\/g, "/").split("/").pop()?.replace(/\.[^.]+$/, "") ?? customerId;
    return chunkText(sourceId, label, document.text, "customer", {
      customerId,
      sourcePath: document.path,
      domain: inferDomain(document.path)
    });
  });

  await persistChunks(elasticBusinessIndexName(), sourceId, chunks);
  return chunks;
}

export async function retrieveEvidence(sourceId: string, query: string, maxResults = 4): Promise<SourceChunk[]> {
  return retrieveEvidenceAcross([sourceId], query, maxResults);
}

export async function retrieveEvidenceAcross(sourceIds: string[], query: string, maxResults = 4): Promise<SourceChunk[]> {
  const uniqueSourceIds = [...new Set(sourceIds.filter(Boolean))];
  if (!uniqueSourceIds.length) return [];

  if (useElastic()) {
    const result = await getElasticClient().search<SourceChunk>({
      index: [elasticDocsIndexName(), elasticBusinessIndexName()],
      size: maxResults,
      query: {
        bool: {
          filter: [{ terms: { sourceId: uniqueSourceIds } }],
          must: [{
            multi_match: {
              query,
              fields: ["title^2", "text", "metadata.domain^2", "metadata.customerId"]
            }
          }]
        }
      }
    });

    return result.hits.hits.map((hit) => hit._source).filter((chunk): chunk is SourceChunk => Boolean(chunk));
  }

  const chunks = uniqueSourceIds.flatMap((id) => memoryIndex.get(id) ?? []);
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);

  return chunks
    .map((chunk) => {
      const haystack = `${chunk.title} ${chunk.text} ${Object.values(chunk.metadata ?? {}).join(" ")}`.toLowerCase();
      const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((x) => x.chunk);
}

async function persistChunks(index: string, sourceId: string, chunks: SourceChunk[]) {
  memoryIndex.set(sourceId, chunks);
  if (!useElastic()) return;

  const client = getElasticClient();
  await client.indices.create({
    index,
    mappings: {
      _meta: {
        description: "ProofPilot source-grounding chunks. Use sourceId, sourceType, and metadata fields to distinguish API docs from customer business evidence."
      },
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

function chunkText(
  sourceId: string,
  defaultTitle: string,
  text: string,
  sourceType: SourceChunk["sourceType"],
  metadata: Record<string, unknown>
) {
  const sections = text
    .split(/(?=^##\s+)/m)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.map((section, index) => {
    const title = section.match(/^##\s+(.+)$/m)?.[1]?.trim()
      ?? section.match(/^#\s+(.+)$/m)?.[1]?.trim()
      ?? (index === 0 ? defaultTitle : `${defaultTitle} section ${index + 1}`);

    return {
      id: `chunk_${nanoid(8)}`,
      sourceId,
      title,
      text: section.slice(0, 5000),
      sourceType,
      metadata
    };
  });
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

function elasticDocsIndexName() {
  return process.env.ELASTIC_INDEX ?? "proofpilot-doc-chunks";
}

function elasticBusinessIndexName() {
  return process.env.ELASTIC_BUSINESS_INDEX ?? "proofpilot-business-chunks";
}

function inferDomain(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("billing")) return "billing";
  if (normalized.includes("dispatch")) return "dispatch";
  if (normalized.includes("faa") || normalized.includes("pilot")) return "compliance";
  if (normalized.includes("maintenance") || normalized.includes("hardware")) return "maintenance";
  if (normalized.includes("support")) return "support";
  if (normalized.includes("integration") || normalized.includes("schema")) return "integration";
  return "general";
}
