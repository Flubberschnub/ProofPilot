import { nanoid } from "nanoid";
import type { DemoRequest } from "./types.js";
import { extractCapabilities, generateDemoPlan, validateClaims } from "./services/agent.js";
import { indexDocs } from "./services/elastic.js";
import { generateDemoFiles } from "./services/generator.js";
import { exportToGitLab } from "./services/gitlab.js";

export async function runProofPilotWorkflow(input: DemoRequest) {
  const sourceId = `src_${nanoid(8)}`;
  const chunks = await indexDocs(sourceId, input.apiName, input.docsText);

  const capabilities = await extractCapabilities(input, chunks);
  const plan = await generateDemoPlan(input, capabilities);
  const claimReport = await validateClaims(sourceId, plan.claims);
  const files = await generateDemoFiles(input, plan, claimReport);
  const gitlab = await exportToGitLab(`${slugify(plan.title)}-demo`, files);

  return {
    sourceId,
    chunksIndexed: chunks.length,
    capabilities,
    plan,
    claimReport,
    files,
    gitlab
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
