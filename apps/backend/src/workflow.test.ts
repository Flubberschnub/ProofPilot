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
      "mvp-03-business-context",
      "mvp-04-demo-planner",
      "mvp-05-claim-checker",
      "mvp-06-package-generator",
      "mvp-07-export"
    ]);
    expect(result.agents.every((agent) => agent.status === "passed")).toBe(true);
    expect(result.capabilities.length).toBeGreaterThan(0);
    expect(result.packageCheck.status).toBe("passed");
    expect(result.gitlab.mode).toBe("mock");
    expect(result.gitlab.localPath).toContain(".generated");
    expect(result.gitlab.artifact?.mode).toBe("local");
  });

  it("uses AeroCore sample data as customer business context for bespoke planning", async () => {
    process.env.MOCK_MODE = "true";
    process.env.PROOFPILOT_MODEL_PROVIDER = "mock";
    process.env.PROOFPILOT_ELASTIC_PROVIDER = "memory";
    delete process.env.PROOFPILOT_EXPORT_BUCKET;

    const result = await runProofPilotWorkflow({
      apiName: "Acme Document Extraction API",
      docsText,
      industry: "Industrial equipment leasing",
      audience: "sales",
      goal: "Show AeroCore how document extraction can reduce manual billing reconciliation and prepare reviewed lease data for Salesforce.",
      preferredStack: "React + Node",
      liveApiAllowed: false,
      customerId: "aerocore-leasing",
      customerPersona: "Sarah Jenkins, Billing & Finance Administrator",
      targetSystem: "Salesforce Lease_Agreement__c custom object"
    });

    expect(result.businessContext.customerId).toBe("aerocore-leasing");
    expect(result.customerChunksIndexed).toBeGreaterThan(0);
    expect(result.businessContext.signals.length).toBeGreaterThan(0);
    expect(result.plan.title).toContain("AeroCore");
    expect(result.plan.story).toContain("aerocore-leasing");
    expect(result.claimReport.claims.some((claim) => claim.text?.includes("documented workflow pain"))).toBe(true);
  });
});
