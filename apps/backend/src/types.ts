export type Audience = "executive" | "technical" | "sales" | "developer";

export type DemoRequest = {
  apiName: string;
  docsText: string;
  docsUrl?: string;
  docsSourceUrl?: string;
  industry: string;
  audience: Audience;
  goal: string;
  preferredStack?: string;
  liveApiAllowed: boolean;
};

export type WorkflowRequest = Omit<DemoRequest, "docsText"> & {
  docsText?: string;
  docsUrl?: string;
};

export type SourceChunk = {
  id: string;
  sourceId: string;
  title: string;
  text: string;
  sourceType: "markdown" | "openapi" | "example";
  metadata?: Record<string, unknown>;
};

export type ApiCapability = {
  name: string;
  description: string;
  endpoints: string[];
  businessUseCases: string[];
  evidenceChunkIds: string[];
};

export type DemoClaimStatus = "supported" | "inferred" | "unsupported" | "marketing" | "unknown";

export type DemoClaim = {
  id: string;
  text: string;
  status?: DemoClaimStatus;
  evidenceChunkIds?: string[];
  rewrite?: string;
};

export type DemoPlan = {
  id: string;
  title: string;
  story: string;
  screens: string[];
  endpointsUsed: string[];
  sampleDataNeeded: string[];
  implementationSteps: string[];
  businessValue: string[];
  claims: DemoClaim[];
};

export type ClaimReport = {
  claims: Required<Pick<DemoClaim, "id" | "text">> & Partial<DemoClaim>[];
  summary: {
    supported: number;
    inferred: number;
    unsupported: number;
    marketing: number;
    unknown: number;
  };
};

export type GeneratedFile = {
  path: string;
  content: string;
};

export type GeneratedPackageCheck = {
  status: "passed" | "warning" | "failed";
  checks: Array<{
    name: string;
    status: "passed" | "warning" | "failed";
    message: string;
  }>;
};

export type GitLabExportResult = {
  mode: "mock" | "live" | "not_configured" | "failed";
  repoName: string;
  filesCommitted: number;
  url: string | null;
  message: string;
  projectId?: number;
  localPath?: string;
  artifact?: GeneratedArtifact;
};

export type GeneratedArtifact = {
  mode: "gcs" | "local" | "disabled" | "failed";
  fileName: string;
  downloadUrl: string | null;
  message: string;
  bucket?: string;
  objectName?: string;
  localPath?: string;
  sizeBytes?: number;
};

export type ModelRunInfo = {
  provider: "mock" | "gemini" | "vertex";
  model: string;
  configured: boolean;
  mode: "mock" | "live";
};

export type AgentRuntimeInfo = {
  mode: "bespoke" | "adk-compatible";
  description: string;
};

export type AgentRunStatus = "passed" | "failed";

export type AgentRun = {
  id: string;
  name: string;
  description: string;
  runtime: AgentRuntimeInfo;
  tools: string[];
  status: AgentRunStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  inputSummary: string;
  outputSummary: string;
  error?: string;
};
