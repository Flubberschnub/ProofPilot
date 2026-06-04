import { describe, expect, it } from "vitest";
import { runProofPilotWorkflow } from "./workflow.js";

const docsText = `# Acme Document Extraction API

The Acme Document Extraction API lets applications upload business documents and extract structured fields from them.

## POST /documents/extract

Uploads a document for extraction. Supported file types include PDF, PNG, and JPG.

## GET /documents/{document_id}

Returns extraction status and extracted fields. Fields include a name, value, and confidence score.

## POST /documents/{document_id}/approve

Approves a reviewed extraction result.

## POST /exports

Exports approved structured data to a downstream system as JSON.`;

describe("runProofPilotWorkflow", () => {
  it("runs the MVP as named agents and exports a local generated package in mock mode", async () => {
    process.env.MOCK_MODE = "true";
    process.env.PROOFPILOT_MODEL_PROVIDER = "mock";
    process.env.PROOFPILOT_ELASTIC_PROVIDER = "memory";
    delete process.env.PROOFPILOT_EXPORT_BUCKET;
    const result = await runProofPilotWorkflow({
      apiName: "Acme Document Extraction API",
      docsText,
      industry: "Insurance",
      audience: "executive",
      goal: "Show a regional insurance company how claim intake can move from document upload to reviewed export.",
      preferredStack: "React + Node",
      liveApiAllowed: false
    });

    expect(result.agentRuntime.mode).toBe("bespoke");
    expect(result.agents.map((agent) => agent.id)).toEqual([
      "mvp-01-intake",
      "mvp-02-source-capability",
      "mvp-03-demo-planner",
      "mvp-04-claim-checker",
      "mvp-05-package-generator",
      "mvp-07-verification",
      "mvp-06-export"
    ]);
    expect(result.agents.every((agent) => agent.status === "passed")).toBe(true);
    expect(result.capabilities.length).toBeGreaterThan(0);
    expect(result.packageCheck.status).toBe("passed");
    expect(result.gitlab.mode).toBe("mock");
    expect(result.gitlab.localPath).toContain(".generated");
    expect(result.gitlab.artifact?.mode).toBe("local");
  });
});
