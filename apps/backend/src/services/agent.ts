import type {
  ApiCapability,
  BusinessContext,
  BusinessSignal,
  ClaimReport,
  DemoClaim,
  DemoPlan,
  DemoRequest,
  SourceChunk
} from "../types.js";
import { getModelClient } from "../models/index.js";
import { retrieveEvidenceAcross } from "./elastic.js";

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

export async function extractBusinessSignals(
  input: DemoRequest,
  chunks: SourceChunk[],
  capabilities: ApiCapability[]
): Promise<BusinessSignal[]> {
  if (!chunks.length) return [];

  const fallback = () => heuristicBusinessSignals(input, chunks, capabilities);
  const response = await getModelClient().generateJson<{ signals: BusinessSignal[] }>({
    schemaName: "BusinessSignalExtraction",
    system: agentSystemPrompt(),
    prompt: [
      `Extract business signals for ${input.customerId ?? "the target customer"} that could shape a bespoke API demo.`,
      `API: ${input.apiName}`,
      `Goal: ${input.goal}`,
      `Target persona: ${input.customerPersona ?? "not specified"}`,
      `Target system: ${input.targetSystem ?? "not specified"}`,
      "",
      "API capabilities:",
      JSON.stringify(capabilities, null, 2),
      "",
      "Customer chunks:",
      JSON.stringify(chunks.map((chunk) => ({
        id: chunk.id,
        title: chunk.title,
        sourcePath: chunk.metadata?.sourcePath,
        domain: chunk.metadata?.domain,
        text: chunk.text
      })), null, 2),
      "",
      "Prefer signals with measurable pain, named workflows, integration constraints, or concrete sample records."
    ].join("\n"),
    schema: {
      signals: [{
        id: "signal_1",
        title: "short signal title",
        summary: "why this matters for the demo",
        department: "business department",
        metric: "optional measured pain or value",
        evidenceChunkIds: ["chunk_id"]
      }]
    },
    fallback: businessSignalResponseFallback(fallback)
  });

  return normalizeBusinessSignals(response.signals, chunks, fallback);
}

export async function generateDemoPlan(input: DemoRequest, capabilities: ApiCapability[], businessContext?: BusinessContext): Promise<DemoPlan> {
  const fallback = () => heuristicDemoPlan(input, capabilities, businessContext);
  const response = await getModelClient().generateJson<DemoPlan>({
    schemaName: "DemoPlan",
    system: agentSystemPrompt(),
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
      "Customer business context:",
      JSON.stringify({
        customerId: businessContext?.customerId,
        persona: input.customerPersona,
        targetSystem: input.targetSystem,
        signals: businessContext?.signals ?? [],
        evidence: businessContext?.evidence.map((chunk) => ({
          id: chunk.id,
          title: chunk.title,
          sourcePath: chunk.metadata?.sourcePath,
          domain: chunk.metadata?.domain,
          text: chunk.text
        })) ?? []
      }, null, 2),
      "",
      "Generate a realistic demo plan. Keep claims testable against the API documentation and customer business evidence."
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
  return validateClaimsAcross([sourceId], claims);
}

export async function validateClaimsAcross(sourceIds: string[], claims: DemoClaim[]): Promise<ClaimReport> {
  const checkedClaims = [];

  for (const claim of claims) {
    const evidence = await retrieveEvidenceAcross(sourceIds, claim.text, 4);
    const fallback = () => heuristicClaimCheck(claim, evidence);
    const result = await getModelClient().generateJson<{ status: DemoClaim["status"]; rewrite?: string }>({
      schemaName: "ClaimValidation",
      system: agentSystemPrompt(),
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

function businessSignalResponseFallback(fallback: () => BusinessSignal[]) {
  return () => ({ signals: fallback() });
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

function heuristicBusinessSignals(input: DemoRequest, chunks: SourceChunk[], capabilities: ApiCapability[]): BusinessSignal[] {
  const terms = [
    input.goal,
    input.customerPersona ?? "",
    input.targetSystem ?? "",
    capabilities.flatMap((capability) => [...capability.businessUseCases, capability.name]).join(" ")
  ].join(" ").toLowerCase().split(/\W+/).filter((term) => term.length > 3);

  return chunks
    .map((chunk) => {
      const haystack = `${chunk.title} ${chunk.text} ${Object.values(chunk.metadata ?? {}).join(" ")}`.toLowerCase();
      const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0)
        + (/manual|bottleneck|error|delay|overdue|support|invoice|salesforce|cargowise|waiver|rma/i.test(haystack) ? 3 : 0)
        + (/\d+(\.\d+)?%|\$\d|hours?|days?/i.test(chunk.text) ? 2 : 0);
      return { chunk, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ chunk }, index) => ({
      id: `signal_${index + 1}`,
      title: chunk.title,
      summary: summarizeSignal(chunk),
      department: typeof chunk.metadata?.domain === "string" ? chunk.metadata.domain : undefined,
      metric: extractMetric(chunk.text),
      evidenceChunkIds: [chunk.id]
    }));
}

function heuristicDemoPlan(input: DemoRequest, capabilities: ApiCapability[], businessContext?: BusinessContext): DemoPlan {
  const primarySignal = businessContext?.signals[0];
  const isAeroCore = input.customerId?.toLowerCase().includes("aerocore");
  const title = isAeroCore
    ? "AeroCore Field-Ops Document Intelligence Demo"
    : input.industry.toLowerCase().includes("insurance")
      ? "ClaimFlow: API-Powered Claims Intake Demo"
      : `${input.apiName} Bespoke API Demo`;

  const targetWorkflow = primarySignal?.title ?? input.goal;
  const targetSystem = input.targetSystem ?? "the customer's integration layer";

  return {
    id: "plan_default",
    title,
    story: businessContext?.customerId
      ? `${businessContext.customerId} evaluates ${input.apiName} against real operational evidence: ${targetWorkflow}. The demo follows ${input.customerPersona ?? "the target user"} from source document intake through reviewed output for ${targetSystem}.`
      : `A ${input.industry} team evaluates ${input.apiName} by walking through a realistic workflow: ${input.goal}`,
    screens: [
      businessContext?.customerId ? "Customer pain and evidence brief" : "Business workflow overview",
      "Upload or submit sample record",
      "API response and extracted data review",
      "Human approval / correction step",
      targetSystem.includes("Salesforce") ? "Salesforce payload preview" : "Export or reporting dashboard"
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
      "Keeps demo claims grounded in product documentation",
      ...(primarySignal ? [`Connects the demo to customer evidence: ${primarySignal.summary}`] : [])
    ],
    claims: [
      { id: "claim_1", text: `${input.apiName} supports uploading documents or records for processing.` },
      { id: "claim_2", text: `${input.apiName} returns structured fields that can be reviewed by a human operator.` },
      { id: "claim_3", text: `${input.apiName} can export approved data to a downstream integration layer.` },
      { id: "claim_4", text: `${input.apiName} directly integrates with the customer's existing core system.` },
      { id: "claim_5", text: `${input.apiName} can reduce manual review effort, though exact savings depend on workflow design.` },
      ...(primarySignal ? [{
        id: "claim_6",
        text: `${businessContext?.customerId ?? "The customer"} has a documented workflow pain related to ${primarySignal.title}.`
      }] : [])
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

function normalizeBusinessSignals(signals: BusinessSignal[] | undefined, chunks: SourceChunk[], fallback: () => BusinessSignal[]) {
  if (!Array.isArray(signals) || !signals.length) return fallback();

  const chunkIds = new Set(chunks.map((chunk) => chunk.id));
  return signals.map((signal, index) => ({
    id: signal.id || `signal_${index + 1}`,
    title: signal.title || `Signal ${index + 1}`,
    summary: signal.summary || "",
    department: signal.department,
    metric: signal.metric,
    evidenceChunkIds: Array.isArray(signal.evidenceChunkIds)
      ? signal.evidenceChunkIds.filter((id) => chunkIds.has(id))
      : []
  })).filter((signal) => signal.title && signal.summary);
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

function summarizeSignal(chunk: SourceChunk) {
  const metric = extractMetric(chunk.text);
  const firstSentence = chunk.text.replace(/^#+\s+.+$/m, "").trim().split(/(?<=[.!?])\s+/)[0]?.slice(0, 220);
  return metric ? `${firstSentence} Evidence includes ${metric}.` : firstSentence || `Relevant customer evidence from ${chunk.title}.`;
}

function extractMetric(text: string) {
  return text.match(/(\$[0-9,]+(?:\.\d+)?|[0-9]+(?:\.[0-9]+)?%|[0-9]+(?:\+)?\s+(?:hours?|days?|minutes?|monthly active leases))/i)?.[0];
}
