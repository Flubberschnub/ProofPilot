export type Audience = "executive" | "technical" | "sales" | "developer";

export type DemoRequest = {
  apiName: string;
  docsText: string;
  industry: string;
  audience: Audience;
  goal: string;
  preferredStack?: string;
  liveApiAllowed: boolean;
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

export type ModelRunInfo = {
  provider: "mock" | "gemini" | "vertex";
  model: string;
  configured: boolean;
  mode: "mock" | "live";
};
