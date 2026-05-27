import type { ApiCapability, ClaimReport, DemoClaim, DemoPlan, DemoRequest, SourceChunk } from "../types.js";
import { retrieveEvidence } from "./elastic.js";

export async function extractCapabilities(input: DemoRequest, chunks: SourceChunk[]): Promise<ApiCapability[]> {
  // Mock mode heuristic extraction. Replace with Gemini structured output.
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

export async function generateDemoPlan(input: DemoRequest, capabilities: ApiCapability[]): Promise<DemoPlan> {
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

export async function validateClaims(sourceId: string, claims: DemoClaim[]): Promise<ClaimReport> {
  const checkedClaims = [];

  for (const claim of claims) {
    const evidence = await retrieveEvidence(sourceId, claim.text, 3);
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

    checkedClaims.push({
      ...claim,
      status,
      evidenceChunkIds: evidence.map((e) => e.id),
      rewrite
    });
  }

  const summary = { supported: 0, inferred: 0, unsupported: 0, marketing: 0, unknown: 0 };
  for (const claim of checkedClaims) summary[claim.status ?? "unknown"]++;

  return { claims: checkedClaims as ClaimReport["claims"], summary };
}
