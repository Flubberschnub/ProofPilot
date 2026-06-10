import { nanoid } from "nanoid";
import type { WorkflowRequest } from "./types.js";
import {
  businessContextAgent,
  claimCheckerAgent,
  demoPlannerAgent,
  exportAgent,
  intakeAgent,
  packageGeneratorAgent,
  sourceCapabilityAgent
} from "./agents/workflow-agents.js";
import { createAgentContext, runAgent } from "./agents/runtime.js";
import { describeModelClient } from "./models/index.js";

export async function runProofPilotWorkflow(input: WorkflowRequest) {
  const model = describeModelClient();
  const agentContext = createAgentContext(model);
  const sourceId = `src_${nanoid(8)}`;
  const businessSourceId = `biz_${nanoid(8)}`;

  const intake = await runAgent(intakeAgent, input, agentContext);
  const sourceCapability = await runAgent(sourceCapabilityAgent, { sourceId, input: intake.input }, agentContext);
  const businessContext = await runAgent(businessContextAgent, {
    sourceId: businessSourceId,
    input: intake.input,
    capabilities: sourceCapability.capabilities
  }, agentContext);
  const plan = await runAgent(demoPlannerAgent, {
    input: intake.input,
    capabilities: sourceCapability.capabilities,
    businessContext
  }, agentContext);
  const claimSourceIds = businessContext.sourceId ? [sourceId, businessContext.sourceId] : [sourceId];
  const claimReport = await runAgent(claimCheckerAgent, { sourceIds: claimSourceIds, claims: plan.claims }, agentContext);
  const generatedPackage = await runAgent(packageGeneratorAgent, {
    input: intake.input,
    plan,
    claimReport
  }, agentContext);
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
    chunksIndexed: sourceCapability.chunks.length,
    customerChunksIndexed: businessContext.chunks.length,
    businessContext,
    capabilities: sourceCapability.capabilities,
    plan,
    claimReport,
    files: generatedPackage.files,
    packageCheck: generatedPackage.packageCheck,
    gitlab
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
