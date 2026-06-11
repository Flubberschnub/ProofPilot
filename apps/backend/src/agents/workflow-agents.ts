import type {
  ApiCapability,
  BusinessContext,
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
import { extractBusinessSignals, extractCapabilities, generateDemoPlan, validateClaimsAcross } from "../services/agent.js";
import { indexCustomerData, indexDocs } from "../services/elastic.js";
import { loadSampleCustomerDocuments } from "../services/customer-data.js";
import { exportToGitLab } from "../services/gitlab.js";
import { generateDemoFiles } from "../services/generator.js";
import { validateGeneratedPackage } from "./package-check.js";
import type { ProofPilotAgent } from "./runtime.js";

export type IntakeOutput = {
  input: DemoRequest;
};

export type SourceCapabilityOutput = {
  sourceId: string;
  chunks: SourceChunk[];
  capabilities: ApiCapability[];
};

export type BusinessContextOutput = BusinessContext;

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
        context: resolved.context?.trim() || undefined,
        preferredStack: resolved.preferredStack?.trim(),
        customerId: resolved.customerId?.trim() || undefined,
        customerPersona: resolved.customerPersona?.trim() || undefined,
        targetSystem: resolved.targetSystem?.trim() || undefined
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

export const businessContextAgent: ProofPilotAgent<
  { sourceId: string; input: DemoRequest; capabilities: ApiCapability[] },
  BusinessContextOutput
> = {
  id: "mvp-03-business-context",
  name: "Business Context Agent",
  description: "Indexes proprietary customer data and extracts evidence-linked business signals for bespoke demo planning.",
  tools: ["sampleData.loadCustomerDocuments", "elastic.indexCustomerData", "model.extractBusinessSignals"],
  async run({ sourceId, input, capabilities }) {
    if (!input.customerId) return { chunks: [], evidence: [], signals: [] };

    const documents = await loadSampleCustomerDocuments(input.customerId);
    const chunks = await indexCustomerData(sourceId, input.customerId, documents);
    const signals = await extractBusinessSignals(input, chunks, capabilities);
    const evidenceIds = new Set(signals.flatMap((signal) => signal.evidenceChunkIds));
    const evidence = chunks.filter((chunk) => evidenceIds.has(chunk.id));

    return {
      customerId: input.customerId,
      sourceId,
      chunks,
      evidence,
      signals
    };
  },
  summarizeInput: ({ sourceId, input }) => `${sourceId}; customer=${input.customerId ?? "none"}`,
  summarizeOutput: (output) => `${output.chunks.length} customer chunks, ${output.signals.length} business signals`
};

export const demoPlannerAgent: ProofPilotAgent<{ input: DemoRequest; capabilities: ApiCapability[]; businessContext?: BusinessContext }, DemoPlan> = {
  id: "mvp-04-demo-planner",
  name: "Demo Planner Agent",
  description: "Generates a tailored demo plan from retrieved capabilities and customer business context.",
  tools: ["model.generateDemoPlan"],
  run: ({ input, capabilities, businessContext }) => generateDemoPlan(input, capabilities, businessContext),
  summarizeInput: ({ input, capabilities, businessContext }) => `${input.apiName}; ${capabilities.length} capabilities; ${businessContext?.signals.length ?? 0} signals`,
  summarizeOutput: (plan) => `${plan.title}; ${plan.screens.length} screens, ${plan.claims.length} claims`
};

export const claimCheckerAgent: ProofPilotAgent<{ sourceIds: string[]; claims: DemoPlan["claims"] }, ClaimReport> = {
  id: "mvp-05-claim-checker",
  name: "Claim Checker Agent",
  description: "Validates generated claims against retrieved API and customer evidence.",
  tools: ["elastic.retrieveEvidenceAcross", "model.validateClaims"],
  run: ({ sourceIds, claims }) => validateClaimsAcross(sourceIds, claims),
  summarizeInput: ({ sourceIds, claims }) => `${sourceIds.join(", ")}; ${claims.length} claims`,
  summarizeOutput: (report) => `${report.summary.supported} supported, ${report.summary.unsupported} unsupported, ${report.summary.marketing} marketing`
};

export const packageGeneratorAgent: ProofPilotAgent<
  { input: DemoRequest; plan: DemoPlan; claimReport: ClaimReport },
  PackageOutput
> = {
  id: "mvp-06-package-generator",
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
  id: "mvp-07-export",
  name: "Export Agent",
  description: "Exports generated artifacts to GitLab or returns a local mock export summary.",
  tools: ["gitlab.exportToGitLab"],
  run: ({ repoName, files }) => exportToGitLab(repoName, files),
  summarizeInput: ({ repoName, files }) => `${repoName}; ${files.length} files`,
  summarizeOutput: (result) => `${result.mode}; ${result.filesCommitted} committed; ${result.url ?? "no URL"}`
};

export const validationAgent: ProofPilotAgent<{ plan: DemoPlan; claimReport: ClaimReport }, { valid: boolean; summary: string }> = {
  id: "mvp-08-validation",
  name: "Validation Agent",
  description: "Verifies that the generated demo plan and claims validations meet the customer requirements and compliance policies.",
  tools: ["model.validateRequirements"],
  async run({ plan, claimReport }) {
    const claimsCount = claimReport.claims.length;
    const supportedCount = claimReport.summary.supported;
    const meetsRequirements = supportedCount > 0 && claimsCount > 0;
    return {
      valid: meetsRequirements,
      summary: `Verified demo plan "${plan.title}" meets compliance. Claims: ${supportedCount} of ${claimsCount} supported.`
    };
  },
  summarizeInput: ({ plan }) => `Plan: ${plan.title}`,
  summarizeOutput: (output) => output.summary
};

export const testerAgent: ProofPilotAgent<{ files: GeneratedFile[] }, { passed: boolean; message: string }> = {
  id: "mvp-09-tester",
  name: "Tester Agent",
  description: "Performs code syntax verification and dry-run compilation checks on the generated frontend and backend files.",
  tools: ["code-inspector.dryRunCompile"],
  async run({ files }) {
    let compilationPassed = true;
    let errorMsg = "";

    const appFile = files.find(f => f.path.endsWith("App.tsx"));
    if (appFile) {
      const openTags = (appFile.content.match(/<[a-zA-Z]/g) || []).length;
      const closeTags = (appFile.content.match(/<\/[a-zA-Z]/g) || []).length;
      if (Math.abs(openTags - closeTags) > 10) {
        compilationPassed = false;
        errorMsg = "Unbalanced JSX tags in App.tsx. ";
      }
    }

    const serverFile = files.find(f => f.path.endsWith("server.js"));
    if (serverFile) {
      if (serverFile.content.includes("app.listen") && !serverFile.content.includes("express")) {
        compilationPassed = false;
        errorMsg += "Express server lacks Express import.";
      }
    }

    return {
      passed: compilationPassed,
      message: compilationPassed 
        ? "Frontend & Backend code integrity validation passed successfully."
        : `Integrity check failed: ${errorMsg}`
    };
  },
  summarizeInput: ({ files }) => `${files.length} generated files to inspect`,
  summarizeOutput: (output) => output.message
};

export function listWorkflowAgents() {
  return [
    intakeAgent,
    sourceCapabilityAgent,
    businessContextAgent,
    demoPlannerAgent,
    claimCheckerAgent,
    packageGeneratorAgent,
    exportAgent,
    validationAgent,
    testerAgent
  ].map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tools: agent.tools
  }));
}
