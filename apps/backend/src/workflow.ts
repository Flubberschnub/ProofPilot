import { nanoid } from "nanoid";
import type { DemoRequest } from "./types.js";
import {
  claimCheckerAgent,
  demoPlannerAgent,
  exportAgent,
  intakeAgent,
  packageGeneratorAgent,
  sourceCapabilityAgent
} from "./agents/workflow-agents.js";
import { createAgentContext, runAgent } from "./agents/runtime.js";
import { describeModelClient } from "./models/index.js";

export async function runProofPilotWorkflow(input: DemoRequest) {
  const model = describeModelClient();
  const agentContext = createAgentContext(model);
  const sourceId = `src_${nanoid(8)}`;

  const intake = await runAgent(intakeAgent, input, agentContext);
  const sourceCapability = await runAgent(sourceCapabilityAgent, { sourceId, input: intake.input }, agentContext);
  const plan = await runAgent(demoPlannerAgent, {
    input: intake.input,
    capabilities: sourceCapability.capabilities
  }, agentContext);
  const claimReport = await runAgent(claimCheckerAgent, { sourceId, claims: plan.claims }, agentContext);
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
    chunksIndexed: sourceCapability.chunks.length,
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
