import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { createAgentContext } from "./agents/runtime.js";
import { listWorkflowAgents } from "./agents/workflow-agents.js";
import { describeModelClient } from "./models/index.js";
import { downloadGeneratedArtifact } from "./services/artifacts.js";
import { runProofPilotWorkflow } from "./workflow.js";

// Import our custom demo generation agents
import { runIntakeAgent } from "./agents/intake.js";
import { runSourceCapabilityAgent } from "./agents/sourceCapability.js";
import { runDemoPlannerAgent } from "./agents/demoPlanner.js";
import { runClaimCheckerAgent } from "./agents/claimChecker.js";
import { runPackageGeneratorAgent } from "./agents/packageGenerator.js";
import { runGitHubExportAgent } from "./agents/githubExport.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Schema for ProofPilot workflow run
const requestSchema = z.object({
  apiName: z.string().min(1),
  docsText: z.string().optional(),
  docsUrl: z.string().url().optional(),
  industry: z.string().min(1),
  audience: z.enum(["executive", "technical", "sales", "developer"]),
  goal: z.string().min(10),
  preferredStack: z.string().optional(),
  liveApiAllowed: z.boolean().default(false)
}).refine((input) => Boolean(input.docsUrl || (input.docsText && input.docsText.trim().length >= 50)), {
  message: "Provide either a docs URL or at least 50 characters of pasted docs text.",
  path: ["docsUrl"]
});

app.get("/health", (_req, res) => {
  const model = describeModelClient();
  res.json({
    ok: true,
    service: "proofpilot-backend",
    model,
    agentRuntime: createAgentContext(model).runtime,
    artifactExport: {
      mode: process.env.PROOFPILOT_EXPORT_BUCKET ? "gcs" : "local",
      bucketConfigured: Boolean(process.env.PROOFPILOT_EXPORT_BUCKET),
      bucket: process.env.PROOFPILOT_EXPORT_BUCKET || null
    }
  });
});

app.get("/api/models/current", (_req, res) => {
  res.json(describeModelClient());
});

app.get("/api/agents", (_req, res) => {
  res.json({
    runtime: createAgentContext(describeModelClient()).runtime,
    agents: listWorkflowAgents()
  });
});

app.post("/api/workflow/run", async (req, res, next) => {
  try {
    const input = requestSchema.parse(req.body);
    const result = await runProofPilotWorkflow(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * SSE route to generate a custom API demo by chaining agents sequentially.
 */
app.get("/api/generate-demo", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendUpdate = (stage: string, status: string, data: any = null) => {
    res.write(`data: ${JSON.stringify({ stage, status, data })}\n\n`);
  };

  const prompt = req.query.prompt;
  if (!prompt || typeof prompt !== "string") {
    sendUpdate("error", "Error: Query parameter 'prompt' is required and must be a string.");
    res.end();
    return;
  }

  (async () => {
    try {
      // 1. Intake Agent
      sendUpdate("intake", "[Intake Agent] Parsing user prompt, discovering target APIs & required keys...");
      const intakeData = await runIntakeAgent(prompt);
      sendUpdate("intake_complete", "Intake completed.", intakeData);

      // 2. Source Capability Agent
      const targetApi = intakeData.targetApi || (intakeData.discoveredApis && intakeData.discoveredApis[0]) || "Stripe";
      sendUpdate("capability", `[Source Capability Agent] Fetching documentation & capability schema for: ${targetApi}...`);
      const capabilities = await runSourceCapabilityAgent(targetApi, intakeData.userGoalSummary);
      sendUpdate("capability_complete", "Capability schema retrieved.", capabilities);

      // 3. Demo Planner Agent
      sendUpdate("planner", "[Demo Planner Agent] Creating technical plan specifying endpoints & React components...");
      const demoPlan = await runDemoPlannerAgent(prompt, capabilities);
      sendUpdate("planner_complete", "Technical plan created.", demoPlan);

      // 4. Claim Checker Agent
      sendUpdate("claim", "[Claim Checker Agent] Validating technical details against documentation index to prevent hallucinations...");
      const auditResult = await runClaimCheckerAgent(demoPlan, capabilities);
      sendUpdate("claim_complete", "Technical plan verified and corrected.", auditResult);

      // 5. Package Generator Agent
      sendUpdate("generator", "[Package Generator Agent] Compiling final backend and frontend source code...");
      const generatedCode = await runPackageGeneratorAgent(auditResult.validatedPlan);
      sendUpdate("generator_complete", "Source files generated.", generatedCode);

      // 6. GitHub Export Agent
      sendUpdate("github", "[GitHub Export Agent] Creating repository and committing code files (excluding .env)...");
      const repoUrl = await runGitHubExportAgent(generatedCode.files, auditResult.validatedPlan.demoName);
      sendUpdate("github_complete", "GitHub repository created and populated.", { repoUrl });

      // Complete pipeline successfully
      sendUpdate("complete", "API Demo pipeline finished successfully!", { repoUrl });
      res.end();
    } catch (error: any) {
      console.error("[Server Error] Agent pipeline failed:", error);
      sendUpdate("error", `Agent workflow failed: ${error.message}`);
      res.end();
    }
  })();
});

// Configure static file serving for the React frontend
const pathsToTry = [
  path.join(__dirname, "../../../frontend/dist"),
  path.join(__dirname, "../../frontend/dist"),
  path.join(__dirname, "../frontend/dist")
];
let frontendBuildPath = pathsToTry[0];
for (const p of pathsToTry) {
  if (fs.existsSync(p)) {
    frontendBuildPath = p;
    break;
  }
}

app.use(express.static(frontendBuildPath));

app.get("/api/exports/:objectId/download", async (req, res, next) => {
  try {
    const artifact = await downloadGeneratedArtifact(req.params.objectId);
    res.setHeader("Content-Type", artifact.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${artifact.fileName}"`);
    res.send(artifact.data);
  } catch (err) {
    next(err);
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(400).json({ error: message });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`ProofPilot backend listening on http://localhost:${port}`);
});
