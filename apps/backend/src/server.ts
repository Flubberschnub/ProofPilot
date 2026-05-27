import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { runProofPilotWorkflow } from "./workflow.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

const requestSchema = z.object({
  apiName: z.string().min(1),
  docsText: z.string().min(50),
  industry: z.string().min(1),
  audience: z.enum(["executive", "technical", "sales", "developer"]),
  goal: z.string().min(10),
  preferredStack: z.string().optional(),
  liveApiAllowed: z.boolean().default(false)
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "proofpilot-backend" });
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

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(400).json({ error: message });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`ProofPilot backend listening on http://localhost:${port}`);
});
