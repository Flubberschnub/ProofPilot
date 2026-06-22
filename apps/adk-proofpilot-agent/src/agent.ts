import { LlmAgent, Gemini, SkillToolset, loadAllSkillsInDir } from "@google/adk";
import { z } from "zod";
import path from "node:path";
import { MockLlm } from "./mock-model.js";
import {
  searchApiDocs,
  searchCustomerContext,
  searchDemoMemory,
  findOperationalPain,
  findIntegrationConstraints,
  listSupportedApiEndpoints,
  rankDemoOpportunities
} from "./tools.js";

// Define the output schema for the ADK agent's planning results
export const ADKOutputSchema = z.object({
  capabilities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    endpoints: z.array(z.string()),
    businessUseCases: z.array(z.string()),
    evidenceChunkIds: z.array(z.string())
  })),
  businessContext: z.object({
    customerId: z.string(),
    signals: z.array(z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      department: z.string(),
      metric: z.string(),
      evidenceChunkIds: z.array(z.string())
    }))
  }),
  plan: z.object({
    title: z.string(),
    story: z.string(),
    screens: z.array(z.string()),
    endpointsUsed: z.array(z.string()),
    sampleDataNeeded: z.array(z.string()),
    implementationSteps: z.array(z.string()),
    businessValue: z.array(z.string()),
    claims: z.array(z.object({
      id: z.string(),
      text: z.string()
    }))
  }),
  claimReport: z.object({
    claims: z.array(z.object({
      id: z.string(),
      text: z.string(),
      status: z.string(),
      evidenceChunkIds: z.array(z.string()),
      rewrite: z.string()
    })),
    summary: z.object({
      supported: z.number(),
      inferred: z.number(),
      unsupported: z.number(),
      marketing: z.number(),
      unknown: z.number()
    })
  })
});

// Resolve model client based on config
export function getLlmClient(config: {
  mockMode?: boolean;
  apiKey?: string;
  vertexai?: boolean;
  project?: string;
  location?: string;
  modelName?: string;
}) {
  const isMock = config.mockMode || (!config.apiKey && !config.project);
  if (isMock) {
    return new MockLlm();
  }

  return new Gemini({
    model: config.modelName || "gemini-2.0-flash",
    apiKey: config.apiKey,
    vertexai: config.vertexai,
    project: config.project,
    location: config.location
  });
}

export async function createProofPilotAgent(model: any) {
  // Load skills dynamically from the local directory structure
  const skillsDir = path.resolve(process.cwd(), "skills");
  const skills = await loadAllSkillsInDir(skillsDir);
  
  // Initialize the SkillToolset with loaded skills and add grounding tools as latent additions
  const skillToolset = new SkillToolset(skills, {
    additionalTools: [
      searchApiDocs,
      searchCustomerContext,
      searchDemoMemory,
      findOperationalPain,
      findIntegrationConstraints,
      listSupportedApiEndpoints,
      rankDemoOpportunities
    ]
  });

  return new LlmAgent({
    name: "proofpilot_adk_planner",
    description: "ProofPilot source-grounded API demo planning agent running on Google ADK with Elastic Agent Builder skills.",
    instruction: `
You are ProofPilot's source-grounded API demo planning agent.
Your task is to review the API name, documentation, customer details, and buyer scenarios.
You have access to specialized 'skills' that extend your capabilities. You MUST use the skill tools to interact with these skills:
- first use list_skills to see what skills are available.
- load the skills relevant to capability extraction, business context, demo planning, and claim validation.
- once loaded, use the newly enabled grounding search tools within those skills to perform searches.

Then, generate:
1. Grounded API capabilities matching the business use cases.
2. Evidence-linked business signals and operational pain points.
3. A tailored, screen-by-screen demo plan.
4. A claim validation report, checking all claims against product docs or customer evidence.

CRITICAL CONSTRAINTS ON MEMORY RESULTS:
- Prior demo memory results retrieved via search_demo_memory or rank_demo_opportunities are ONLY structural templates and references for API usage/screens.
- You MUST ALWAYS use the customerId, context, goal, industry, audience, persona, and targetSystem provided in the current request.
- Do NOT copy the company name, industry, or storyline from prior memory search results (such as "GridPulse Renewables" or "Solar Yield") into the new plan. If the current request is for "aerocore-leasing" / "Aviation" / "flight dispatch", your plan must focus solely on Aerocore Leasing's aviation operations and flight limitations.

CRITICAL CONSTRAINTS ON SCREEN LIST:
- The generated screens list MUST contain ONLY clean, minimal screen titles (e.g., "Screen 1: AeroCore Dispatch Dashboard", "Screen 2: Pre-Flight Safety Audit Console").
- Do NOT append roles, visuals, storylines, action descriptions, or API request/response payloads into the screen strings. Keep each screen title under 60 characters.

Always prefer precise, testable claims over broad marketing language. Return ONLY the JSON object matching the requested schema.
    `.trim(),
    model,
    outputSchema: ADKOutputSchema as any,
    tools: [skillToolset]
  });
}
