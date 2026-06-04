import type { ApiCapability, ClaimReport, DemoClaim, DemoPlan, DemoRequest, SourceChunk } from "../types.js";
import { getModelClient } from "../models/index.js";
import { retrieveEvidence } from "./elastic.js";

export async function extractCapabilities(input: DemoRequest, chunks: SourceChunk[]): Promise<ApiCapability[]> {
  const fallback = () => heuristicExtractCapabilities(chunks);
  const responseFallback = () => ({ capabilities: fallback() });
  const response = await getModelClient().generateJson<{ capabilities: ApiCapability[] }>({
    schemaName: "CapabilityExtraction",
    system: agentSystemPrompt(),
    prompt: [
      `Extract API capabilities for ${input.apiName}.`,
      `Target industry: ${input.industry}.`,
      `Target audience: ${input.audience}.`,
      `Demo goal: ${input.goal}`,
      "Use only the provided source chunks. Include evidenceChunkIds that support each capability.",
      "",
      "Source chunks:",
      JSON.stringify(chunks.map((chunk) => ({
        id: chunk.id,
        title: chunk.title,
        text: chunk.text
      })), null, 2)
    ].join("\n"),
    schema: {
      capabilities: [{
        name: "short capability name",
        description: "plain-language description",
        endpoints: ["METHOD /path"],
        businessUseCases: ["workflow use case"],
        evidenceChunkIds: ["chunk_id"]
      }]
    },
    fallback: responseFallback
  });

  return normalizeCapabilities(response.capabilities, chunks, fallback);
}

export async function generateDemoPlan(input: DemoRequest, capabilities: ApiCapability[]): Promise<DemoPlan> {
  const fallback = () => heuristicDemoPlan(input, capabilities);
  const response = await getModelClient().generateJson<DemoPlan>({
    schemaName: "DemoPlan",
    system: "You are ProofPilot's source-grounded API demo planning agent. Do not invent API capabilities to satisfy the user's business scenario. If the user requests a workflow (e.g., 'document uploading' or 'claims intake') that is not supported by the retrieved Elastic documentation for the target API, you must handle that business logic entirely within the generated React/Node app as mock application logic. The target API must ONLY be used for its documented endpoints. Prefer precise, testable claims over broad marketing language.",
    prompt: [
      `Create a concise source-grounded demo plan for ${input.apiName}.`,
      `Industry: ${input.industry}`,
      `Audience: ${input.audience}`,
      `Goal: ${input.goal}`,
      `Preferred stack: ${input.preferredStack ?? "not specified"}`,
      "",
      "Capabilities:",
      JSON.stringify(capabilities, null, 2),
      "",
      "Generate a realistic demo plan. Keep claims testable against the capabilities and documentation evidence."
    ].join("\n"),
    schema: {
      id: "plan_default",
      title: "demo title",
      story: "one paragraph buyer story",
      screens: ["screen names"],
      endpointsUsed: ["METHOD /path"],
      sampleDataNeeded: ["sample data item"],
      implementationSteps: ["step"],
      businessValue: ["business value"],
      claims: [{ id: "claim_1", text: "testable claim" }]
    },
    fallback
  });

  return normalizeDemoPlan(response, fallback);
}

export async function validateClaims(sourceId: string, claims: DemoClaim[]): Promise<ClaimReport> {
  const checkedClaims = [];

  for (const claim of claims) {
    const evidence = await retrieveEvidence(sourceId, claim.text, 3);
    const fallback = () => heuristicClaimCheck(claim, evidence);
    const result = await getModelClient().generateJson<{ status: DemoClaim["status"]; rewrite?: string }>({
      schemaName: "ClaimValidation",
      system: "You are ProofPilot's claim audit checking agent. You must aggressively audit the 'Source-grounded claims' section. You must strip out any claim that the target API performs an action not explicitly found in the Elastic database. Ensure the final output clearly delineates between what the Custom Demo App does (e.g., 'The app allows users to upload a claim') and what the Target API does (e.g., 'Open-Meteo provides historical weather data for the claim location'). Prefer precise, testable claims over broad marketing language.",
      prompt: [
        "Validate the claim against the evidence.",
        "Use status supported only when the evidence directly supports the claim.",
        "Use inferred for reasonable but indirect support, marketing for qualified impact/value claims, unsupported for contradicted or absent proof, and unknown when evidence is insufficient.",
        "",
        `Claim: ${claim.text}`,
        "",
        "Evidence chunks:",
        JSON.stringify(evidence.map((chunk) => ({
          id: chunk.id,
          title: chunk.title,
          text: chunk.text
        })), null, 2)
      ].join("\n"),
      schema: {
        status: "supported | inferred | unsupported | marketing | unknown",
        rewrite: "optional safer wording when unsupported or marketing"
      },
      fallback
    });

    checkedClaims.push({
      ...claim,
      status: normalizeClaimStatus(result.status),
      evidenceChunkIds: evidence.map((e) => e.id),
      rewrite: result.rewrite
    });
  }

  const summary = { supported: 0, inferred: 0, unsupported: 0, marketing: 0, unknown: 0 };
  for (const claim of checkedClaims) summary[claim.status ?? "unknown"]++;

  return { claims: checkedClaims as ClaimReport["claims"], summary };
}

function heuristicExtractCapabilities(chunks: SourceChunk[]): ApiCapability[] {
  const endpoints = chunks.flatMap((chunk) => [...chunk.text.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s`]+)/g)]
    .map((m) => `${m[1]} ${m[2]}`));

  const capabilities: ApiCapability[] = [
    {
      name: "Upload and process documents",
      description: "Accepts business documents and starts an extraction workflow.",
      endpoints: endpoints.filter((e) => e.includes("POST") && e.includes("document")),
      businessUseCases: ["claim intake", "invoice processing", "loan document review"],
      evidenceChunkIds: chunks.filter((c) => /upload|extract|document/i.test(c.text)).map((c) => c.id)
    },
    {
      name: "Retrieve extraction results",
      description: "Returns extracted structured fields and confidence values for review.",
      endpoints: endpoints.filter((e) => e.includes("GET") && e.includes("document")),
      businessUseCases: ["human review", "operations dashboard", "quality control"],
      evidenceChunkIds: chunks.filter((c) => /confidence|fields|status/i.test(c.text)).map((c) => c.id)
    },
    {
      name: "Export approved data",
      description: "Exports reviewed structured data to a downstream system or integration layer.",
      endpoints: endpoints.filter((e) => e.includes("export") || e.includes("approve")),
      businessUseCases: ["system integration", "records handoff", "workflow completion"],
      evidenceChunkIds: chunks.filter((c) => /export|approve/i.test(c.text)).map((c) => c.id)
    }
  ].filter((c) => c.endpoints.length || c.evidenceChunkIds.length);

  return capabilities;
}

function heuristicDemoPlan(input: DemoRequest, capabilities: ApiCapability[]): DemoPlan {
  const title = input.industry.toLowerCase().includes("insurance")
    ? "ClaimFlow: API-Powered Claims Intake Demo"
    : `${input.apiName} Bespoke API Demo`;

  return {
    id: "plan_default",
    title,
    story: `A ${input.industry} team evaluates ${input.apiName} by walking through a realistic workflow: ${input.goal}`,
    screens: [
      "Business workflow overview",
      "Upload or submit sample record",
      "API response and extracted data review",
      "Human approval / correction step",
      "Export or reporting dashboard"
    ],
    endpointsUsed: [...new Set(capabilities.flatMap((c) => c.endpoints))].slice(0, 5),
    sampleDataNeeded: ["sample business document", "mock API response", "reviewed output payload"],
    implementationSteps: [
      "Create React demo shell",
      "Create Node backend proxy with mock API client",
      "Add workflow pages tailored to the scenario",
      "Render raw API response beside business-friendly fields",
      "Generate README, demo script, and claim report"
    ],
    businessValue: [
      "Lets buyers evaluate API fit in their own workflow language",
      "Reduces sales-engineering time spent handcrafting demos",
      "Keeps demo claims grounded in product documentation"
    ],
    claims: [
      { id: "claim_1", text: `${input.apiName} supports uploading documents or records for processing.` },
      { id: "claim_2", text: `${input.apiName} returns structured fields that can be reviewed by a human operator.` },
      { id: "claim_3", text: `${input.apiName} can export approved data to a downstream integration layer.` },
      { id: "claim_4", text: `${input.apiName} directly integrates with the customer's existing core system.` },
      { id: "claim_5", text: `${input.apiName} can reduce manual review effort, though exact savings depend on workflow design.` }
    ]
  };
}

function heuristicClaimCheck(claim: DemoClaim, evidence: SourceChunk[]) {
  const evidenceText = evidence.map((e) => `${e.title}\n${e.text}`).join("\n").toLowerCase();
  const lower = claim.text.toLowerCase();

  let status: DemoClaim["status"] = evidence.length ? "inferred" : "unknown";
  let rewrite: string | undefined;

  if (/directly integrates|guarantees|70%|specific savings/i.test(lower)) {
    status = "unsupported";
    rewrite = claim.text.replace(/directly integrates with the customer's existing core system/i, "can export data for connection through the customer's integration layer");
  } else if (/marketing note|reduce manual|time savings/i.test(evidenceText + lower)) {
    status = "marketing";
    rewrite = claim.text.includes("exact") ? claim.text : `${claim.text} Exact impact depends on workflow design and document quality.`;
  } else if (evidence.length >= 1) {
    status = "supported";
  }

  return { status, rewrite };
}

function normalizeCapabilities(capabilities: ApiCapability[] | undefined, chunks: SourceChunk[], fallback: () => ApiCapability[]) {
  if (!Array.isArray(capabilities) || !capabilities.length) return fallback();

  const chunkIds = new Set(chunks.map((chunk) => chunk.id));
  return capabilities.map((capability, index) => ({
    name: capability.name || `Capability ${index + 1}`,
    description: capability.description || "",
    endpoints: Array.isArray(capability.endpoints) ? capability.endpoints.filter(Boolean) : [],
    businessUseCases: Array.isArray(capability.businessUseCases) ? capability.businessUseCases.filter(Boolean) : [],
    evidenceChunkIds: Array.isArray(capability.evidenceChunkIds)
      ? capability.evidenceChunkIds.filter((id) => chunkIds.has(id))
      : []
  })).filter((capability) => capability.name && (capability.description || capability.endpoints.length || capability.evidenceChunkIds.length));
}

function normalizeDemoPlan(plan: DemoPlan | undefined, fallback: () => DemoPlan): DemoPlan {
  if (!plan || !Array.isArray(plan.screens) || !Array.isArray(plan.claims)) return fallback();

  return {
    id: plan.id || "plan_default",
    title: plan.title || fallback().title,
    story: plan.story || fallback().story,
    screens: plan.screens.filter(Boolean),
    endpointsUsed: Array.isArray(plan.endpointsUsed) ? plan.endpointsUsed.filter(Boolean) : [],
    sampleDataNeeded: Array.isArray(plan.sampleDataNeeded) ? plan.sampleDataNeeded.filter(Boolean) : [],
    implementationSteps: Array.isArray(plan.implementationSteps) ? plan.implementationSteps.filter(Boolean) : [],
    businessValue: Array.isArray(plan.businessValue) ? plan.businessValue.filter(Boolean) : [],
    claims: plan.claims.map((claim, index) => ({
      id: claim.id || `claim_${index + 1}`,
      text: claim.text
    })).filter((claim) => claim.text)
  };
}

function normalizeClaimStatus(status: DemoClaim["status"]): NonNullable<DemoClaim["status"]> {
  if (status === "supported" || status === "inferred" || status === "unsupported" || status === "marketing" || status === "unknown") {
    return status;
  }
  return "unknown";
}

function agentSystemPrompt() {
  return "You are ProofPilot's source-grounded API demo planning agent. Prefer precise, testable claims over broad marketing language.";
}
