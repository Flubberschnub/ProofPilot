import { Client } from '@elastic/elasticsearch';
import { generateJSON } from '../utils/llm.js';
import dotenv from 'dotenv';

dotenv.config();

let esClient: Client | null = null;
const apiKey = process.env.ELASTIC_API_KEY;
const cloudId = process.env.ELASTIC_CLOUD_ID;
const nodeUrl = process.env.ELASTIC_NODE_URL;

if (apiKey && (cloudId || nodeUrl)) {
  try {
    const config: any = { auth: { apiKey } };
    if (cloudId) {
      config.cloud = { id: cloudId };
    } else {
      config.node = nodeUrl;
    }
    esClient = new Client(config);
    console.log('[SourceCapabilityAgent] Elasticsearch client initialized.');
  } catch (err) {
    console.error('[SourceCapabilityAgent] Failed to initialize Elasticsearch client:', err);
  }
} else {
  console.warn('[SourceCapabilityAgent] ELASTIC_API_KEY and (ELASTIC_CLOUD_ID or ELASTIC_NODE_URL) missing. Graceful mock fallback will be used.');
}

/**
 * SourceCapabilityAgent: Queries Elasticsearch for target API's capabilities.
 */
export async function runSourceCapabilityAgent(targetApi: string, userGoalSummary: string): Promise<any> {
  let docs: any[] | null = null;

  if (esClient) {
    try {
      console.log(`[SourceCapabilityAgent] Querying Elastic index "api-docs" for: ${targetApi}`);
      const response = await esClient.search({
        index: 'api-docs',
        body: {
          query: {
            bool: {
              must: [
                { match: { apiName: targetApi } }
              ],
              should: [
                { match: { description: userGoalSummary } }
              ]
            }
          }
        }
      });

      if (response.hits && response.hits.hits.length > 0) {
        docs = response.hits.hits.map(h => h._source);
        console.log(`[SourceCapabilityAgent] Found ${docs.length} documents in Elasticsearch.`);
      }
    } catch (error: any) {
      console.warn('[SourceCapabilityAgent] Elasticsearch lookup failed, falling back to LLM fallback. Error:', error.message);
    }
  }

  const systemInstruction = `
You are the SourceCapabilityAgent. Your job is to compile a detailed, structured capabilities JSON profile for the target API based on documentation snippets (if provided) and public developer documentation.
You must return a list of available endpoints, methods, descriptions, header requirements, required query/body parameters, and authentication formats.

You MUST respond strictly with a valid JSON matching this schema:
{
  "apiName": "Name of the API",
  "baseUrl": "Base URL of the API",
  "authentication": {
    "type": "bearer | api_key | oauth2 | basic",
    "headerName": "e.g., Authorization or X-API-Key",
    "valuePlaceholder": "e.g., BEARER_TOKEN or API_KEY"
  },
  "endpoints": [
    {
      "name": "Concise identifier",
      "path": "/v1/charges",
      "method": "GET | POST | PUT | DELETE",
      "description": "What this endpoint does",
      "headers": {
        "Content-Type": "application/json"
      },
      "requiredParams": [
        {
          "name": "param_name",
          "type": "string | number | boolean",
          "description": "What it is used for"
        }
      ],
      "optionalParams": [
        {
          "name": "param_name",
          "type": "string",
          "description": "description"
        }
      ]
    }
  ]
}
`;

  const prompt = `
Target API: ${targetApi}
Goal to achieve: ${userGoalSummary}
${docs ? `Here are some matched documentation pieces from Elasticsearch database:\n${JSON.stringify(docs, null, 2)}` : 'No database documents found; please generate the standard public endpoints for this API based on your knowledge base.'}
`;

  try {
    const result = await generateJSON<any>('gemini-2.5-flash', prompt, systemInstruction);
    return result;
  } catch (error) {
    console.error('[SourceCapabilityAgent] Error generating capabilities:', error);
    throw error;
  }
}
