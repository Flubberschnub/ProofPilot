import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { getRequestContext } from "./context.js";
import { Client } from "@elastic/elasticsearch";
import path from "node:path";
import fs from "fs-extra";

const supportedExtensions = new Set([".md", ".json", ".txt", ".yaml", ".yml"]);

// Local memory storage for generated demo memory in mock mode
const mockMemoryStore: any[] = [];

// Helper to get Elastic Client
function getElasticClient(elasticUrl?: string, elasticApiKey?: string) {
  if (!elasticUrl) {
    throw new Error("Elastic URL not provided");
  }
  return new Client({
    node: elasticUrl,
    auth: elasticApiKey ? { apiKey: elasticApiKey } : undefined
  });
}

// Simple text chunking helper
function chunkText(sourceId: string, defaultTitle: string, text: string, sourceType: "markdown" | "customer", metadata: Record<string, any>) {
  const sections = text.split(/(?=^##\s+)/m).map((s) => s.trim()).filter(Boolean);
  return sections.map((section, index) => {
    const title = section.match(/^##\s+(.+)$/m)?.[1]?.trim()
      ?? section.match(/^#\s+(.+)$/m)?.[1]?.trim()
      ?? (index === 0 ? defaultTitle : `${defaultTitle} section ${index + 1}`);
    return {
      id: `chunk_${Math.random().toString(36).substring(2, 10)}`,
      sourceId,
      title,
      text: section.substring(0, 5000),
      sourceType,
      metadata
    };
  });
}

// Helper to list all files in directory recursively
async function listFiles(dir: string): Promise<string[]> {
  if (!(await fs.pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return files.flat();
}

// Helper to load local customer documents
async function loadLocalCustomerDocs(customerId: string): Promise<{ path: string; text: string }[]> {
  const candidates = [
    path.resolve(process.cwd(), "sample-data", customerId),
    path.resolve(process.cwd(), "..", "sample-data", customerId),
    path.resolve(process.cwd(), "..", "..", "sample-data", customerId),
  ];
  
  let sampleDataDir = "";
  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      sampleDataDir = candidate;
      break;
    }
  }
  
  if (!sampleDataDir) return [];
  
  const files = await listFiles(sampleDataDir);
  const documents: { path: string; text: string }[] = [];
  for (const file of files) {
    if (!supportedExtensions.has(path.extname(file).toLowerCase())) continue;
    const text = await fs.readFile(file, "utf8");
    documents.push({
      path: path.relative(sampleDataDir, file).replace(/\\/g, "/"),
      text
    });
  }
  return documents;
}

// Local text search helper
function localSearch(chunks: any[], query: string, maxResults = 5) {
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  if (terms.length === 0) return chunks.slice(0, maxResults);
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

// 1. search_api_docs
export const searchApiDocs = new FunctionTool({
  name: "search_api_docs",
  description: "Search API documentation chunks indexed by ProofPilot. Use this when validating what an API can actually do, finding endpoints, checking authentication, or grounding claims in product docs. Do not use for customer business pain or operational context.",
  parameters: z.object({
    query: z.string()
  }) as any,
  execute: async ({ query }: any) => {
    const ctx = getRequestContext();
    if (!ctx.mockMode && ctx.elasticUrl) {
      const client = getElasticClient(ctx.elasticUrl, ctx.elasticApiKey);
      const index = ctx.elasticIndex || "proofpilot-doc-chunks";
      const result = await client.search({
        index,
        size: 5,
        query: {
          bool: {
            filter: [{ term: { sourceId: ctx.sourceId } }],
            must: [{ multi_match: { query, fields: ["title^2", "text"] } }]
          }
        }
      });
      return result.hits.hits.map(h => h._source);
    } else {
      const chunks = chunkText(ctx.sourceId, ctx.apiName, ctx.docsText, "markdown", { apiName: ctx.apiName });
      return localSearch(chunks, query, 5);
    }
  }
});

// 2. search_customer_context
export const searchCustomerContext = new FunctionTool({
  name: "search_customer_context",
  description: "Search customer-specific business evidence, including support tickets, workflows, and operational pain. Do not use as API product documentation.",
  parameters: z.object({
    query: z.string()
  }) as any,
  execute: async ({ query }: any) => {
    const ctx = getRequestContext();
    if (!ctx.customerId) return [];
    
    if (!ctx.mockMode && ctx.elasticUrl) {
      const client = getElasticClient(ctx.elasticUrl, ctx.elasticApiKey);
      const index = ctx.elasticBusinessIndex || "proofpilot-business-chunks";
      const result = await client.search({
        index,
        size: 5,
        query: {
          bool: {
            filter: [{ term: { "metadata.customerId": ctx.customerId } }],
            must: [{ multi_match: { query, fields: ["title^2", "text", "metadata.domain^2"] } }]
          }
        }
      });
      return result.hits.hits.map(h => h._source);
    } else {
      const documents = await loadLocalCustomerDocs(ctx.customerId);
      const chunks = documents.flatMap((doc) => {
        const label = doc.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? ctx.customerId!;
        return chunkText(ctx.businessSourceId || "mock_biz", label, doc.text, "customer", {
          customerId: ctx.customerId,
          sourcePath: doc.path,
          domain: doc.path.includes("billing") ? "billing" : "general"
        });
      });
      return localSearch(chunks, query, 5);
    }
  }
});

// 3. search_demo_memory
export const searchDemoMemory = new FunctionTool({
  name: "search_demo_memory",
  description: "Search prior generated demo ideas, claim outcomes, and plan summaries. Use this to reuse or improve prior successful demo designs.",
  parameters: z.object({
    query: z.string()
  }) as any,
  execute: async ({ query }: any) => {
    const ctx = getRequestContext();
    if (!ctx.mockMode && ctx.elasticUrl) {
      const client = getElasticClient(ctx.elasticUrl, ctx.elasticApiKey);
      const index = ctx.elasticMemoryIndex || "proofpilot-demo-memory";
      const result = await client.search({
        index,
        size: 5,
        query: {
          multi_match: { query, fields: ["title^2", "summary", "story"] }
        }
      });
      return result.hits.hits.map(h => h._source);
    } else {
      return localSearch(mockMemoryStore, query, 5);
    }
  }
});

// 4. find_operational_pain
export const findOperationalPain = new FunctionTool({
  name: "find_operational_pain",
  description: "Return customer operational pain points, measured bottlenecks, error rates, and manual delays from business context.",
  parameters: z.object({
    customerId: z.string(),
    domain: z.string().optional()
  }) as any,
  execute: async ({ customerId, domain }: any) => {
    const ctx = getRequestContext();
    if (!ctx.mockMode && ctx.elasticUrl) {
      const client = getElasticClient(ctx.elasticUrl, ctx.elasticApiKey);
      const filterClause = domain && domain !== "any" 
        ? `| WHERE metadata.customerId == '${customerId}' AND metadata.domain == '${domain}'` 
        : `| WHERE metadata.customerId == '${customerId}'`;
      const query = `
        FROM proofpilot-business-chunks
        ${filterClause}
        | WHERE MATCH(text, 'manual OR bottleneck OR delay OR error OR reconciliation OR overdue OR RMA OR support')
        | KEEP title, text, metadata.domain, metadata.sourcePath
        | LIMIT 10
      `.trim();
      const result = await client.esql.query({ query }) as any;
      return result.rows || result.body?.rows || result;
    } else {
      const documents = await loadLocalCustomerDocs(customerId);
      const chunks = documents.flatMap((doc) => {
        const label = doc.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? customerId;
        return chunkText("mock_biz", label, doc.text, "customer", {
          customerId,
          sourcePath: doc.path,
          domain: doc.path.includes("billing") ? "billing" : "general"
        });
      });
      return chunks.filter(c => 
        /manual|bottleneck|delay|error|reconciliation|overdue|RMA|support/i.test(c.text) &&
        (!domain || domain === "any" || c.metadata.domain === domain)
      ).slice(0, 10);
    }
  }
});

// 5. find_integration_constraints
export const findIntegrationConstraints = new FunctionTool({
  name: "find_integration_constraints",
  description: "Retrieve customer system limitations or handoff constraints (e.g. Salesforce, CargoWise, billing databases).",
  parameters: z.object({
    customerId: z.string(),
    targetSystem: z.string()
  }) as any,
  execute: async ({ customerId, targetSystem }: any) => {
    const ctx = getRequestContext();
    if (!ctx.mockMode && ctx.elasticUrl) {
      const client = getElasticClient(ctx.elasticUrl, ctx.elasticApiKey);
      const query = `
        FROM proofpilot-business-chunks
        | WHERE metadata.customerId == '${customerId}'
        | WHERE MATCH(text, '${targetSystem}')
        | KEEP title, text, metadata.domain, metadata.sourcePath
        | LIMIT 10
      `.trim();
      const result = await client.esql.query({ query }) as any;
      return result.rows || result.body?.rows || result;
    } else {
      const documents = await loadLocalCustomerDocs(customerId);
      const chunks = documents.flatMap((doc) => {
        const label = doc.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? customerId;
        return chunkText("mock_biz", label, doc.text, "customer", {
          customerId,
          sourcePath: doc.path,
          domain: "integration"
        });
      });
      const regex = new RegExp(targetSystem, "i");
      return chunks.filter(c => regex.test(c.text)).slice(0, 10);
    }
  }
});

// 6. list_supported_api_endpoints
export const listSupportedApiEndpoints = new FunctionTool({
  name: "list_supported_api_endpoints",
  description: "Find relevant supported endpoints and docs evidence inside the API documentation.",
  parameters: z.object({
    apiName: z.string(),
    query: z.string()
  }) as any,
  execute: async ({ apiName, query }: any) => {
    const ctx = getRequestContext();
    if (!ctx.mockMode && ctx.elasticUrl) {
      const client = getElasticClient(ctx.elasticUrl, ctx.elasticApiKey);
      const queryStr = `
        FROM proofpilot-doc-chunks
        | WHERE metadata.apiName == '${apiName}'
        | WHERE MATCH(text, '${query}')
        | KEEP title, text
        | LIMIT 10
      `.trim();
      const result = await client.esql.query({ query: queryStr }) as any;
      return result.rows || result.body?.rows || result;
    } else {
      const chunks = chunkText(ctx.sourceId, apiName, ctx.docsText, "markdown", { apiName });
      return localSearch(chunks, query, 10);
    }
  }
});

// 7. rank_demo_opportunities
export const rankDemoOpportunities = new FunctionTool({
  name: "rank_demo_opportunities",
  description: "Return candidate opportunities from prior memory scored outcomes.",
  parameters: z.object({
    customerId: z.string(),
    apiName: z.string()
  }) as any,
  execute: async ({ customerId, apiName }: any) => {
    const ctx = getRequestContext();
    if (!ctx.mockMode && ctx.elasticUrl) {
      const client = getElasticClient(ctx.elasticUrl, ctx.elasticApiKey);
      const query = `
        FROM proofpilot-demo-memory
        | WHERE customerId == '${customerId}' AND apiName == '${apiName}'
        | SORT score DESC
        | KEEP title, summary, score, evidenceChunkIds, createdAt
        | LIMIT 5
      `.trim();
      const result = await client.esql.query({ query }) as any;
      return result.rows || result.body?.rows || result;
    } else {
      return mockMemoryStore
        .filter(m => m.customerId === customerId && m.apiName === apiName)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }
  }
});

// Export helper to add generated ideas back to memory
export async function writeToDemoMemory(memoryItem: any) {
  const ctx = getRequestContext();
  const item = {
    ...memoryItem,
    createdAt: new Date().toISOString(),
    score: memoryItem.score || 85
  };
  
  if (!ctx.mockMode && ctx.elasticUrl) {
    const client = getElasticClient(ctx.elasticUrl, ctx.elasticApiKey);
    const index = ctx.elasticMemoryIndex || "proofpilot-demo-memory";
    
    try {
      await client.indices.create({
        index,
        mappings: {
          _meta: {
            description: "ProofPilot demo history memory. Stores generated demo designs and claims validator scores."
          },
          properties: {
            customerId: { type: "keyword" },
            apiName: { type: "keyword" },
            title: { type: "text" },
            summary: { type: "text" },
            story: { type: "text" },
            score: { type: "integer" },
            evidenceChunkIds: { type: "keyword" },
            createdAt: { type: "date" }
          }
        }
      }, { ignore: [400] });
    } catch (e) {
      // Ignore if index already exists
    }
    
    await client.index({
      index,
      document: item
    });
  } else {
    mockMemoryStore.push(item);
  }
}
