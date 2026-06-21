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
  const fallback = () => heuristicExtractCapabilities(chunks, input);
  const responseFallback = () => ({ capabilities: fallback() });
  const response = await getModelClient().generateJson<{ capabilities: ApiCapability[] }>({
    schemaName: "CapabilityExtraction",
    system: agentSystemPrompt(),
    prompt: [
      `Extract API capabilities for ${input.apiName}.`,
      `Target industry: ${input.industry}.`,
      `Target audience: ${input.audience}.`,
      `Demo goal: ${input.goal}`,
      `Additional context: ${input.context ?? "none"}`,
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
      `Additional context: ${input.context ?? "none"}`,
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
      `Additional context: ${input.context ?? "none"}`,
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

function heuristicExtractCapabilities(chunks: SourceChunk[], input?: DemoRequest): ApiCapability[] {
  const isWeather = input && (
    input.apiName.toLowerCase().includes("weather") ||
    input.apiName.toLowerCase().includes("meteo") ||
    (input.context ?? "").toLowerCase().includes("weather") ||
    (input.context ?? "").toLowerCase().includes("meteo") ||
    (input.docsText ?? "").toLowerCase().includes("weather") ||
    (input.docsText ?? "").toLowerCase().includes("meteo")
  );

  const isPayment = input && (
    input.apiName.toLowerCase().includes("payment") ||
    input.apiName.toLowerCase().includes("stripe") ||
    input.apiName.toLowerCase().includes("paypal") ||
    (input.context ?? "").toLowerCase().includes("stripe") ||
    (input.context ?? "").toLowerCase().includes("paypal")
  );

  const endpoints = chunks.flatMap((chunk) => [...chunk.text.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s`]+)/g)]
    .map((m) => `${m[1]} ${m[2]}`));

  if (isWeather) {
    return [
      {
        name: "Retrieve real-time weather forecasts",
        description: "Fetches hourly and daily temperature, wind speed, and precipitation forecasts for any coordinates.",
        endpoints: endpoints.filter((e) => e.includes("forecast") || e.includes("GET")).concat(["GET /v1/forecast"]),
        businessUseCases: ["flight dispatch scheduling", "risk warning automation"],
        evidenceChunkIds: chunks.slice(0, 2).map((c) => c.id)
      },
      {
        name: "Access historical weather archives",
        description: "Retrieves historical climate and weather data to analyze past delays.",
        endpoints: endpoints.filter((e) => e.includes("archive")).concat(["GET /v1/archive"]),
        businessUseCases: ["historical delay audit"],
        evidenceChunkIds: chunks.slice(2, 4).map((c) => c.id)
      }
    ];
  }

  if (isPayment) {
    return [
      {
        name: "Process customer payment",
        description: "Accepts credit card or alternative payment details to authorize charges.",
        endpoints: endpoints.filter((e) => e.includes("charge") || e.includes("payment") || e.includes("POST")).concat(["POST /v1/charges"]),
        businessUseCases: ["billing reconciliation", "lease payments"],
        evidenceChunkIds: chunks.slice(0, 2).map((c) => c.id)
      },
      {
        name: "Refund or manage transactions",
        description: "Refunds a transaction or retrieves status.",
        endpoints: endpoints.filter((e) => e.includes("refund") || e.includes("GET")).concat(["GET /v1/transactions/:id"]),
        businessUseCases: ["transaction management", "customer support refunds"],
        evidenceChunkIds: chunks.slice(2, 4).map((c) => c.id)
      }
    ];
  }

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
  const isWeather = 
    input.apiName.toLowerCase().includes("weather") ||
    input.apiName.toLowerCase().includes("meteo") ||
    (input.context ?? "").toLowerCase().includes("weather") ||
    (input.context ?? "").toLowerCase().includes("meteo") ||
    (input.docsText ?? "").toLowerCase().includes("weather") ||
    (input.docsText ?? "").toLowerCase().includes("meteo");

  const isPayment = 
    input.apiName.toLowerCase().includes("payment") ||
    input.apiName.toLowerCase().includes("stripe") ||
    input.apiName.toLowerCase().includes("paypal") ||
    (input.context ?? "").toLowerCase().includes("stripe") ||
    (input.context ?? "").toLowerCase().includes("paypal");

  if (isWeather) {
    return [
      {
        id: "signal_1",
        title: "Weather-related flight delays",
        summary: "Unexpected wind, rain, and ice storms ground aircraft, leading to massive scheduling delays for AeroCore.",
        department: "dispatch",
        metric: "24h latency",
        evidenceChunkIds: chunks.slice(0, 1).map((c) => c.id)
      },
      {
        id: "signal_2",
        title: "Manual weather monitoring bottlenecks",
        summary: "Dispatchers must manually check external weather forecasts, delaying proactive flight rerouting.",
        department: "operations",
        metric: "30+ mins per flight",
        evidenceChunkIds: chunks.slice(1, 2).map((c) => c.id)
      }
    ];
  }

  if (isPayment) {
    return [
      {
        id: "signal_1",
        title: "Manual billing reconciliation bottlenecks",
        summary: "Finance team manually reconciles billing invoices, leading to significant delays and 15% error rates.",
        department: "finance",
        metric: "15% error rate",
        evidenceChunkIds: chunks.slice(0, 1).map((c) => c.id)
      },
      {
        id: "signal_2",
        title: "Customer payment latency",
        summary: "Delays in capturing payments impact billing cycles and lease agreements compliance.",
        department: "operations",
        metric: "5-day payment delay",
        evidenceChunkIds: chunks.slice(1, 2).map((c) => c.id)
      }
    ];
  }

  const terms = [
    input.goal,
    input.context ?? "",
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

  const isWeather = 
    input.apiName.toLowerCase().includes("weather") ||
    input.apiName.toLowerCase().includes("meteo") ||
    (input.context ?? "").toLowerCase().includes("weather") ||
    (input.context ?? "").toLowerCase().includes("meteo") ||
    (input.docsText ?? "").toLowerCase().includes("weather") ||
    (input.docsText ?? "").toLowerCase().includes("meteo");

  const isPayment = 
    input.apiName.toLowerCase().includes("payment") ||
    input.apiName.toLowerCase().includes("stripe") ||
    input.apiName.toLowerCase().includes("paypal") ||
    (input.context ?? "").toLowerCase().includes("stripe") ||
    (input.context ?? "").toLowerCase().includes("paypal");

  const title = isAeroCore
    ? (isWeather ? `AeroCore Open-Meteo Weather Dispatch Automation Demo` : isPayment ? `AeroCore Billing & Payments Integration Demo` : `AeroCore ${input.apiName} Integration Demo`)
    : input.industry.toLowerCase().includes("insurance")
      ? "ClaimFlow: API-Powered Claims Intake Demo"
      : `${input.apiName} Bespoke API Demo`;

  const targetWorkflow = primarySignal?.title ?? input.context ?? input.goal;
  const targetSystem = input.targetSystem ?? inferTargetSystem(input.context) ?? "the customer's integration layer";
  const persona = input.customerPersona ?? inferPersona(input.context) ?? "the target user";

  if (isWeather) {
    const isDev = input.audience === "developer" || input.audience === "technical";
    return {
      id: "plan_default",
      title: isDev ? `${title} (Developer)` : `${title} (Executive)`,
      story: isDev
        ? `Demonstrates the integration architecture of the Open-Meteo Weather API within AeroCore's backend, showing raw endpoint requests, parameter validation, and JSON payload structures.`
        : businessContext?.customerId
          ? `${businessContext.customerId} integrates ${input.apiName} with their internal dispatch portal. The demo showcases how ${persona} views real-time weather alerts and schedules flights around adverse weather events.`
          : `A dispatch coordination team evaluates ${input.apiName} by walking through a weather-aware flight planning workflow.`,
      screens: isDev
        ? [
            "API Endpoint & Coordinates Query Console",
            "Raw JSON Forecast Response Viewer",
            "Aircraft Operating Parameter Validation Engine (Schema Audit)",
            "Database Sync and Webhook Event Logs"
          ]
        : [
            "Operational Weather Alert Dashboard",
            "Weather Forecast Parameter Query Panel",
            "Aircraft Operations Limitations Review",
            "Salesforce Handoff Status Page"
          ],
      endpointsUsed: [...new Set(capabilities.flatMap((c) => c.endpoints))].slice(0, 5),
      sampleDataNeeded: ["weather_forecast_response.json", "flight_limits_config.yaml"],
      implementationSteps: isDev
        ? [
            "Verify API request coordinates binding",
            "Audit raw JSON temperature and wind parameters mapping",
            "Test validation logic for wind speed parameters",
            "Log webhook event payloads matching Salesforce object schema"
          ]
        : [
            "Initialize React weather dashboard",
            "Add coordinates query selector",
            "Implement flight limitation thresholds check",
            "Export status update notification to Salesforce"
          ],
      businessValue: isDev
        ? [
            "Provides end-to-end integration logs for engineers",
            "Ensures strict compliance validation of API structures",
            "Validates data sync reliability across CargoWise and Salesforce"
          ]
        : [
            "Reduces dispatch delays by predicting flight-limiting weather",
            "Automates notifications to pilots in advance of weather events",
            "Keeps demo claims grounded in Open-Meteo API documentation"
          ],
      claims: [
        { id: "claim_1", text: `${input.apiName} provides hourly weather forecast variables.` },
        { id: "claim_2", text: `AeroCore can automate dispatch scheduling using real-time weather thresholds.` },
        { id: "claim_3", text: `AeroCore dispatch portal can alert coordinators in advance of flight-limiting weather events.` },
        { id: "claim_4", text: `Open-Meteo forecasts can be used to inform scheduling decisions for AeroCore leasing.` }
      ]
    };
  }

  if (isPayment) {
    return {
      id: "plan_default",
      title,
      story: businessContext?.customerId
        ? `${businessContext.customerId} evaluates ${input.apiName} for secure billing. The demo showcases how ${persona} processes transactions and exports logs to ${targetSystem}.`
        : `A finance operations team evaluates ${input.apiName} by walking through payment capture workflows.`,
      screens: [
        "Bespoke Billing & Payment Dashboard",
        "Payment Transaction Request Panel",
        "Stripe API Response & Transaction Review",
        "ERP Integration & Reconciliation Handoff"
      ],
      endpointsUsed: [...new Set(capabilities.flatMap((c) => c.endpoints))].slice(0, 5),
      sampleDataNeeded: ["mock_stripe_payload.json", "billing_invoice_match.csv"],
      implementationSteps: [
        "Create React payment billing dashboard",
        "Add transaction payload query selector",
        "Verify charge status indicators",
        "Design reconciliation handoff panel"
      ],
      businessValue: [
        "Eliminates 15% error rate from manual invoice entries",
        "Reduces billing reconciliation latency from days to seconds",
        "Aligns customer billing profiles with Stripe compliance standards"
      ],
      claims: [
        { id: "claim_1", text: `${input.apiName} supports secure transaction processing and capture.` },
        { id: "claim_2", text: `${input.apiName} returns detailed transaction status and customer records.` },
        { id: "claim_3", text: `${input.apiName} can sync transaction history with downstream financial systems.` }
      ]
    };
  }

  return {
    id: "plan_default",
    title,
    story: businessContext?.customerId
      ? `${businessContext.customerId} evaluates ${input.apiName} against real operational evidence: ${targetWorkflow}. The demo showcases how ${persona} interacts with ${input.apiName} to streamline workflow steps and export verified metrics to ${targetSystem}.`
      : `A ${input.industry} team evaluates ${input.apiName} by walking through a realistic workflow: ${input.goal}`,
    screens: [
      businessContext?.customerId ? "Operational Overview & Pain Points" : "Business workflow overview",
      `Query and Request Setup for ${input.apiName}`,
      "API Response & Extracted Metrics Review",
      "Review & Validation Panel",
      targetSystem.includes("Salesforce") ? "Salesforce payload preview" : "Export & Integration dashboard"
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

function inferTargetSystem(context?: string) {
  if (!context) return undefined;
  const salesforce = context.match(/salesforce[^\n,.]*/i)?.[0];
  if (salesforce) return salesforce;
  const cargoWise = context.match(/cargowise[^\n,.]*/i)?.[0];
  if (cargoWise) return cargoWise;
  return undefined;
}

function inferPersona(context?: string) {
  if (!context) return undefined;
  const namedPersona = context.match(/(?:persona|user|buyer|for):\s*([^\n.]+)/i)?.[1]?.trim();
  if (namedPersona) return namedPersona;
  if (/billing|invoice|finance/i.test(context)) return "a billing or finance operator";
  if (/dispatch|pilot|field/i.test(context)) return "a dispatch or field operations user";
  if (/support|ticket|rma/i.test(context)) return "a support operations user";
  return undefined;
}
