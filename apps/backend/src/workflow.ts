import { nanoid } from "nanoid";
import type { WorkflowRequest } from "./types.js";
import {
  businessContextAgent,
  claimCheckerAgent,
  demoPlannerAgent,
  exportAgent,
  intakeAgent,
  packageGeneratorAgent,
  sourceCapabilityAgent,
  validationAgent,
  testerAgent,
  codeRepairAgent
} from "./agents/workflow-agents.js";

export const previewCache = new Map<string, {
  apiName: string;
  appCode: string;
  cssCode: string;
}>();
import { createAgentContext, runAgent } from "./agents/runtime.js";
import { describeModelClient } from "./models/index.js";
import { saveDemoPreview } from "./services/previews.js";

export async function runProofPilotWorkflow(input: WorkflowRequest) {
  const model = describeModelClient();
  const agentContext = createAgentContext(model);
  const sourceId = `src_${nanoid(8)}`;
  const businessSourceId = `biz_${nanoid(8)}`;

  const intake = await runAgent(intakeAgent, input, agentContext);

  let capabilities: any[] = [];
  let businessContext: any = { chunks: [], evidence: [], signals: [] };
  let plan: any = null;
  let claimReport: any = null;

  if (process.env.PROOFPILOT_AGENT_RUNTIME?.toLowerCase() === "adk") {
    const adkUrl = process.env.PROOFPILOT_ADK_AGENT_URL || "http://localhost:8081";
    let adkToken = process.env.PROOFPILOT_ADK_AUTH_TOKEN;

    if (!adkToken && adkUrl.includes(".run.app")) {
      const gcpToken = await getIdentityToken(adkUrl);
      if (gcpToken) {
        adkToken = gcpToken;
      }
    }

    const payload = {
      apiName: intake.input.apiName,
      docsText: intake.input.docsText,
      customerId: intake.input.customerId,
      context: intake.input.context,
      goal: intake.input.goal,
      industry: intake.input.industry,
      audience: intake.input.audience,
      preferredStack: intake.input.preferredStack,
      customerPersona: intake.input.customerPersona,
      targetSystem: intake.input.targetSystem,
      sourceId,
      businessSourceId
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (adkToken) {
      headers["Authorization"] = `Bearer ${adkToken}`;
    }

    const res = await fetch(`${adkUrl}/api/run`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ADK remote agent returned error status ${res.status}: ${errText}`);
    }

    const result = await res.json() as any;

    capabilities = result.capabilities || [];
    businessContext = result.businessContext || { chunks: [], evidence: [], signals: [] };
    plan = result.plan;
    claimReport = result.claimReport;

    if (!businessContext.sourceId) {
      businessContext.sourceId = businessSourceId;
    }

    // Append the remote trace events from ADK execution to the main trace list
    if (Array.isArray(result.trace)) {
      agentContext.trace.push(...result.trace);
    }
  } else {
    const sourceCapability = await runAgent(sourceCapabilityAgent, { sourceId, input: intake.input }, agentContext);
    capabilities = sourceCapability.capabilities;

    const bizResult = await runAgent(businessContextAgent, {
      sourceId: businessSourceId,
      input: intake.input,
      capabilities
    }, agentContext);
    businessContext = bizResult;

    plan = await runAgent(demoPlannerAgent, {
      input: intake.input,
      capabilities,
      businessContext
    }, agentContext);

    const claimSourceIds = businessContext.sourceId ? [sourceId, businessContext.sourceId] : [sourceId];
    claimReport = await runAgent(claimCheckerAgent, { sourceIds: claimSourceIds, claims: plan.claims }, agentContext);
  }

  const generatedPackage = await runAgent(packageGeneratorAgent, {
    input: intake.input,
    plan,
    claimReport
  }, agentContext);

  const validation = await runAgent(validationAgent, {
    plan,
    claimReport
  }, agentContext);

  let files = generatedPackage.files;
  let tester = await runAgent(testerAgent, { files }, agentContext);

  let retryCount = 0;
  const maxRetries = 2;

  while (!tester.passed && retryCount < maxRetries) {
    retryCount++;
    console.log(`[Self-Healing] Code validation failed. Initiating repair attempt ${retryCount}/${maxRetries}...`);
    
    const repairResult = await runAgent(codeRepairAgent, {
      files,
      errorMsg: tester.message,
      plan,
      input: intake.input
    }, agentContext);

    files = repairResult.files;
    tester = await runAgent(testerAgent, { files }, agentContext);
  }

  // Update the package files with the repaired ones
  generatedPackage.files = files;

  const previewId = `${slugify(plan.title)}-${nanoid(4)}`;
  const appFile = generatedPackage.files.find(f => f.path.endsWith("App.tsx"));
  const cssFile = generatedPackage.files.find(f => f.path.endsWith("style.css"));
  if (appFile && cssFile) {
    await saveDemoPreview(previewId, {
      apiName: plan.title,
      appCode: appFile.content,
      cssCode: cssFile.content
    });
  }

  const gitlab = await runAgent(exportAgent, {
    repoName: `${slugify(plan.title)}-demo`,
    files: generatedPackage.files
  }, agentContext);

  return {
    model,
    agentRuntime: agentContext.runtime,
    agents: agentContext.trace,
    sourceId,
    businessSourceId: businessContext.sourceId,
    docsSourceUrl: intake.input.docsSourceUrl,
    docsCharacters: intake.input.docsText.length,
    chunksIndexed: capabilities.length,
    customerChunksIndexed: businessContext.chunks?.length || 0,
    businessContext,
    capabilities,
    plan,
    claimReport,
    files: generatedPackage.files,
    packageCheck: generatedPackage.packageCheck,
    gitlab,
    validationPassed: validation.valid && tester.passed,
    previewUrl: validation.valid && tester.passed ? `/api/preview/${previewId}` : null
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function getIdentityToken(audience: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1000);
  try {
    const res = await fetch(
      `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
      { 
        headers: { "Metadata-Flavor": "Google" },
        signal: controller.signal
      }
    );
    return res.ok ? await res.text() : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}
