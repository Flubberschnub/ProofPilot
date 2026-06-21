import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { createAgentContext } from "./agents/runtime.js";
import { listWorkflowAgents } from "./agents/workflow-agents.js";
import { describeModelClient } from "./models/index.js";
import { downloadGeneratedArtifact } from "./services/artifacts.js";
import { runProofPilotWorkflow, previewCache } from "./workflow.js";
import { getDemoPreview } from "./services/previews.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

const requestSchema = z.object({
  apiName: z.string().min(1),
  docsText: z.string().optional(),
  docsUrl: z.string().url().optional(),
  industry: z.string().min(1).optional(),
  audience: z.enum(["executive", "technical", "sales", "developer"]).optional(),
  goal: z.string().min(10).optional(),
  context: z.string().optional(),
  preferredStack: z.string().optional(),
  liveApiAllowed: z.boolean().default(false),
  customerId: z.string().optional(),
  customerPersona: z.string().optional(),
  targetSystem: z.string().optional()
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

app.get("/api/preview/:demoId", async (req, res) => {
  const demo = await getDemoPreview(req.params.demoId);
  if (!demo) {
    return res.status(404).send("Demo preview not found or expired.");
  }

  // Strip all imports from App.tsx so it runs standalone in the browser
  let cleanCode = demo.appCode
    .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, "") // remove imports with 'from'
    .replace(/import\s+['"].*?['"];?/g, "") // remove bare imports
    .replace(/export\s+default\s+/g, ""); // remove export default

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${demo.apiName} - ProofPilot Live Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    ${demo.cssCode}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useMemo } = React;
    
    ${cleanCode}
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>
  `.trim();

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

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
