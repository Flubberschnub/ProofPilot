import { Client } from '@elastic/elasticsearch';
import { generateJSON } from '../utils/llm.js';
import dotenv from 'dotenv';

dotenv.config();

let esClient: Client | null = null;
if (process.env.ELASTIC_CLOUD_ID && process.env.ELASTIC_API_KEY) {
  try {
    esClient = new Client({
      cloud: { id: process.env.ELASTIC_CLOUD_ID },
      auth: { apiKey: process.env.ELASTIC_API_KEY }
    });
  } catch (err) {
    console.error('[ClaimCheckerAgent] Failed to initialize Elasticsearch client:', err);
  }
}

/**
 * ClaimCheckerAgent: Cross-references the proposed plan against the documentation database.
 */
export async function runClaimCheckerAgent(demoPlan: any, capabilities: any): Promise<any> {
  let docVerificationContext = '';

  if (esClient) {
    try {
      console.log(`[ClaimCheckerAgent] Validating plan endpoints against Elastic documentation database...`);
      const endpointsToVerify = demoPlan.backendRoutes.map((route: any) => route.upstreamEndpoint).join(' OR ');
      
      const response = await esClient.search({
        index: 'api-docs',
        body: {
          query: {
            multi_match: {
              query: `${demoPlan.demoName} ${endpointsToVerify}`,
              fields: ['endpoint', 'description', 'content']
            }
          }
        }
      });

      if (response.hits && response.hits.hits.length > 0) {
        const matchingDocs = response.hits.hits.map(h => h._source);
        docVerificationContext = `Elasticsearch validation documentation match:\n${JSON.stringify(matchingDocs, null, 2)}`;
        console.log('[ClaimCheckerAgent] Verification docs fetched from Elasticsearch.');
      }
    } catch (error: any) {
      console.warn('[ClaimCheckerAgent] Elasticsearch check skipped or failed. Falling back to internal LLM verification. Error:', error.message);
    }
  }

  const systemInstruction = `
You are the ClaimCheckerAgent. Your job is to audit the proposed Demo Plan.
Specifically:
1. Verify if the upstream API endpoints inside the plan actually exist in the API capabilities or public docs.
2. Confirm parameter names and request payloads are correct and not hallucinated or deprecated.
3. Check for structural consistency.
4. If there are errors, correct them and explain the discrepancies in the "discrepancies" log.
5. Output the validated, corrected plan.

You MUST respond strictly with a valid JSON matching this schema:
{
  "isValid": true,
  "discrepancies": [
    "List of corrections or warning statements, empty if perfect"
  ],
  "validatedPlan": {
    "demoName": "...",
    "architectureOverview": "...",
    "backendRoutes": [...],
    "frontendComponents": [...],
    "steps": [...]
  }
}
`;

  const prompt = `
Original Demo Plan to verify:
${JSON.stringify(demoPlan, null, 2)}

Reference Capabilities:
${JSON.stringify(capabilities, null, 2)}

${docVerificationContext ? docVerificationContext : 'No database documents matched. Use your latest knowledge cutoff of this API to verify validity.'}
`;

  try {
    const result = await generateJSON<any>('gemini-1.5-flash', prompt, systemInstruction);
    return result;
  } catch (error) {
    console.error('[Claim Checker Agent] Error during verification:', error);
    throw error;
  }
}
