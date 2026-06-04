import type {
  ApiCapability,
  ClaimReport,
  DemoPlan,
  DemoRequest,
  GeneratedFile,
  GeneratedPackageCheck,
  GitLabExportResult,
  SourceChunk,
  WorkflowRequest
} from "../types.js";
import { resolveWorkflowDocs } from "../services/docs.js";
import { extractCapabilities, generateDemoPlan, validateClaims } from "../services/agent.js";
import { indexDocs } from "../services/elastic.js";
import { exportToGitLab } from "../services/gitlab.js";
import { generateDemoFiles } from "../services/generator.js";
import { validateGeneratedPackage } from "./package-check.js";
import { verificationAgent } from "./verification.js";
export { verificationAgent };
import type { ProofPilotAgent } from "./runtime.js";

export type IntakeOutput = {
  input: DemoRequest;
};

export type SourceCapabilityOutput = {
  sourceId: string;
  chunks: SourceChunk[];
  capabilities: ApiCapability[];
};

export type PackageOutput = {
  files: GeneratedFile[];
  packageCheck: GeneratedPackageCheck;
};

export type ExportInput = {
  repoName: string;
  files: GeneratedFile[];
};

export const intakeAgent: ProofPilotAgent<WorkflowRequest, IntakeOutput> = {
  id: "mvp-01-intake",
  name: "Intake Agent",
  description: "Accepts API documentation or a docs URL and the buyer scenario, then normalizes the workflow request.",
  tools: ["request-schema", "docs.fetchUrl", "docs.extractText", "scenario-normalizer"],
  async run(input) {
    const resolved = await resolveWorkflowDocs(input);
    return {
      input: {
        ...resolved,
        apiName: resolved.apiName.trim(),
        docsText: resolved.docsText.trim(),
        industry: resolved.industry.trim(),
        goal: resolved.goal.trim(),
        preferredStack: resolved.preferredStack?.trim()
      }
    };
  },
  summarizeInput: (input) => `${input.apiName} for ${input.industry}; docs=${input.docsText?.length ?? 0} chars; url=${input.docsUrl ?? "none"}`,
  summarizeOutput: (output) => `${output.input.apiName}; docs=${output.input.docsText.length} chars; source=${output.input.docsSourceUrl ?? "pasted text"}`
};

export const sourceCapabilityAgent: ProofPilotAgent<{ sourceId: string; input: DemoRequest }, SourceCapabilityOutput> = {
  id: "mvp-02-source-capability",
  name: "Source Capability Agent",
  description: "Indexes source docs and extracts evidence-linked API capabilities.",
  tools: ["elastic.indexDocs", "model.extractCapabilities"],
  async run({ sourceId, input }) {
    const chunks = await indexDocs(sourceId, input.apiName, input.docsText);
    const capabilities = await extractCapabilities(input, chunks);
    return { sourceId, chunks, capabilities };
  },
  summarizeInput: ({ sourceId, input }) => `${sourceId}; ${input.docsText.length} docs chars`,
  summarizeOutput: (output) => `${output.chunks.length} chunks, ${output.capabilities.length} capabilities`
};

export const demoPlannerAgent: ProofPilotAgent<{ input: DemoRequest; capabilities: ApiCapability[] }, DemoPlan> = {
  id: "mvp-03-demo-planner",
  name: "Demo Planner Agent",
  description: "Generates a tailored demo plan from retrieved capabilities.",
  tools: ["model.generateDemoPlan"],
  run: ({ input, capabilities }) => generateDemoPlan(input, capabilities),
  summarizeInput: ({ input, capabilities }) => `${input.apiName}; ${capabilities.length} capabilities`,
  summarizeOutput: (plan) => `${plan.title}; ${plan.screens.length} screens, ${plan.claims.length} claims`
};

export const claimCheckerAgent: ProofPilotAgent<{ sourceId: string; claims: DemoPlan["claims"] }, ClaimReport> = {
  id: "mvp-04-claim-checker",
  name: "Claim Checker Agent",
  description: "Validates generated claims against retrieved source evidence.",
  tools: ["elastic.retrieveEvidence", "model.validateClaims"],
  run: ({ sourceId, claims }) => validateClaims(sourceId, claims),
  summarizeInput: ({ sourceId, claims }) => `${sourceId}; ${claims.length} claims`,
  summarizeOutput: (report) => `${report.summary.supported} supported, ${report.summary.unsupported} unsupported, ${report.summary.marketing} marketing`
};

export const packageGeneratorAgent: ProofPilotAgent<
  { input: DemoRequest; plan: DemoPlan; claimReport: ClaimReport },
  PackageOutput
> = {
  id: "mvp-05-package-generator",
  name: "Package Generator Agent",
  description: "Creates the React and Node demo package and validates required generated files.",
  tools: ["template.generateDemoFiles", "package.validateGeneratedPackage"],
  async run({ input, plan, claimReport }) {
    const files = await generateDemoFiles(input, plan, claimReport);
    return { files, packageCheck: validateGeneratedPackage(files) };
  },
  summarizeInput: ({ plan, claimReport }) => `${plan.title}; ${claimReport.claims.length} checked claims`,
  summarizeOutput: (output) => `${output.files.length} files; package check ${output.packageCheck.status}`
};

export const exportAgent: ProofPilotAgent<ExportInput, GitLabExportResult> = {
  id: "mvp-06-export",
  name: "Export Agent",
  description: "Exports generated artifacts to GitLab or returns a local mock export summary.",
  tools: ["gitlab.exportToGitLab"],
  run: ({ repoName, files }) => exportToGitLab(repoName, files),
  summarizeInput: ({ repoName, files }) => `${repoName}; ${files.length} files`,
  summarizeOutput: (result) => `${result.mode}; ${result.filesCommitted} committed; ${result.url ?? "no URL"}`
};

export function listWorkflowAgents() {
  return [
    intakeAgent,
    sourceCapabilityAgent,
    demoPlannerAgent,
    claimCheckerAgent,
    packageGeneratorAgent,
    verificationAgent,
    exportAgent
  ].map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tools: agent.tools
  }));
}
