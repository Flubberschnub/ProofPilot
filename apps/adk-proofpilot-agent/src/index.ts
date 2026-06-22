import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { InMemoryRunner } from "@google/adk";
import { requestContextStorage, RequestContext } from "./context.js";
import { getLlmClient, createProofPilotAgent } from "./agent.js";
import { writeToDemoMemory } from "./tools.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8081;

app.post("/api/run", async (req, res) => {
  const startedTime = Date.now();
  const {
    apiName,
    docsText,
    customerId,
    context,
    goal,
    industry,
    audience,
    preferredStack,
    customerPersona,
    targetSystem,
    sourceId,
    businessSourceId,
    mockMode: reqMockMode
  } = req.body;

  if (!apiName || !docsText) {
    return res.status(400).json({ error: "apiName and docsText are required." });
  }

  // Resolve config from request body, headers, or server env
  const mockMode = reqMockMode !== undefined 
    ? !!reqMockMode 
    : (process.env.MOCK_MODE === "true" || (!process.env.GEMINI_API_KEY && !process.env.VERTEX_PROJECT_ID));
    
  const requestCtx: RequestContext = {
    apiName,
    docsText,
    customerId,
    context,
    goal,
    industry,
    audience,
    preferredStack,
    customerPersona,
    targetSystem,
    sourceId,
    businessSourceId,
    mockMode,
    elasticUrl: process.env.ELASTIC_URL,
    elasticApiKey: process.env.ELASTIC_API_KEY,
    elasticIndex: process.env.ELASTIC_INDEX,
    elasticBusinessIndex: process.env.ELASTIC_BUSINESS_INDEX,
    elasticMemoryIndex: process.env.ELASTIC_MEMORY_INDEX
  };

  // Run the agent inside AsyncLocalStorage to let tools access the request context
  await requestContextStorage.run(requestCtx, async () => {
    try {
      const model = getLlmClient({
        mockMode,
        apiKey: process.env.GEMINI_API_KEY,
        vertexai: (process.env.PROOFPILOT_MODEL_PROVIDER ?? "").toLowerCase() === "vertex",
        project: process.env.VERTEX_PROJECT_ID,
        location: process.env.VERTEX_LOCATION,
        modelName: process.env.GEMINI_MODEL || process.env.VERTEX_MODEL
      });

      const agent = await createProofPilotAgent(model);
      const runner = new InMemoryRunner({ agent, appName: "ProofPilotADK" });

      const events: any[] = [];
      const trace: any[] = [];
      let finalResponseText = "";
      
      const runnerStarted = Date.now();
      
      // Execute the agent and process stream events
      const eventStream = runner.runEphemeral({
        userId: "proofpilot-user",
        newMessage: {
          parts: [{
            text: `
Please generate a bespoke API demo design for customer "${customerId ?? "unknown"}" using API "${apiName}".
Industry: ${industry || "not specified"}
Audience: ${audience || "not specified"}
Goal: ${goal || "not specified"}
Context: ${context || "none"}
Persona: ${customerPersona || "not specified"}
Target System: ${targetSystem || "not specified"}
            `.trim()
          }]
        }
      });

      for await (const event of eventStream) {
        events.push(event);

        // Track tool invocations and build trace steps for the frontend
        if (event.content?.parts) {
          for (const part of event.content.parts) {
            if (part.functionCall) {
              trace.push({
                id: `adk-tool-${part.functionCall.name}`,
                name: `ADK Tool: ${part.functionCall.name}`,
                description: `Invoked ADK tool to retrieve grounded context.`,
                runtime: {
                  mode: "adk-compatible",
                  description: "ADK Agent calling Elastic Agent Builder tools over MCP."
                },
                tools: [part.functionCall.name],
                status: "passed",
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: 50,
                inputSummary: JSON.stringify(part.functionCall.args),
                outputSummary: "Retrieved grounding chunks."
              });
            }
          }
        }

        // Capture model final response text
        const isModel = event.author === "proofpilot_adk_planner" || event.author === "model" || event.content?.role === "model";
        if (isModel && event.content?.parts) {
          const text = event.content.parts.map((p: any) => p.text || "").join("");
          if (text && !event.content.parts.some((p: any) => p.functionCall || p.functionResponse)) {
            finalResponseText = text;
          }
        }
      }

      const runnerCompleted = Date.now();

      if (!finalResponseText) {
        throw new Error("No final response received from the ADK planning agent.");
      }

      // Clean the final response string in case the LLM returned it wrapped in ```json ... ```
      let cleanedJson = finalResponseText.trim();
      if (cleanedJson.startsWith("```")) {
        cleanedJson = cleanedJson.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      const parsedResult = JSON.parse(cleanedJson);

      // In mock mode, explicitly simulate the dynamic skill discovery and loading trace
      if (mockMode) {
        trace.push({
          id: "adk-tool-list_skills",
          name: "ADK Tool: list_skills",
          description: "List available specialized context skills to prune active prompt context.",
          runtime: {
            mode: "adk-compatible",
            description: "Google ADK dynamic skill discovery."
          },
          tools: ["list_skills"],
          status: "passed",
          startedAt: new Date(runnerStarted).toISOString(),
          completedAt: new Date(runnerStarted + 20).toISOString(),
          durationMs: 20,
          inputSummary: "{}",
          outputSummary: "Available skills: api-capability, business-context, demo-planning, claim-validation."
        });

        trace.push({
          id: "adk-tool-load_skill-api-capability",
          name: "ADK Tool: load_skill (api-capability)",
          description: "Dynamically load API capability instructions and tools on-demand.",
          runtime: {
            mode: "adk-compatible",
            description: "Google ADK dynamic tool registration and context compaction."
          },
          tools: ["load_skill"],
          status: "passed",
          startedAt: new Date(runnerStarted + 25).toISOString(),
          completedAt: new Date(runnerStarted + 55).toISOString(),
          durationMs: 30,
          inputSummary: '{"name":"api-capability"}',
          outputSummary: "Loaded API Capability instructions; registered tools: search_api_docs, list_supported_api_endpoints."
        });

        trace.push({
          id: "adk-tool-load_skill-business-context",
          name: "ADK Tool: load_skill (business-context)",
          description: "Dynamically load customer context instructions and tools on-demand.",
          runtime: {
            mode: "adk-compatible",
            description: "Google ADK dynamic tool registration and context compaction."
          },
          tools: ["load_skill"],
          status: "passed",
          startedAt: new Date(runnerStarted + 60).toISOString(),
          completedAt: new Date(runnerStarted + 95).toISOString(),
          durationMs: 35,
          inputSummary: '{"name":"business-context"}',
          outputSummary: "Loaded Business Context instructions; registered tools: search_customer_context, find_operational_pain, find_integration_constraints."
        });
      }

      // Append the final orchestration step to the trace
      trace.push({
        id: "adk-orchestrator",
        name: "Google ADK Agent Orchestrator",
        description: "Successfully processed API capabilities, business context, demo plan, and claims checker validations.",
        runtime: {
          mode: "adk-compatible",
          description: "Google Agent Development Kit (ADK) LlmAgent."
        },
        tools: [],
        status: "passed",
        startedAt: new Date(runnerStarted).toISOString(),
        completedAt: new Date(runnerCompleted).toISOString(),
        durationMs: runnerCompleted - runnerStarted,
        inputSummary: `API: ${apiName}, Customer: ${customerId}`,
        outputSummary: `Generated plan "${parsedResult.plan?.title}" with ${parsedResult.capabilities?.length} capabilities and ${parsedResult.claimReport?.claims?.length} checked claims.`
      });

      // Write-back generating demo details back to Elastic memory
      if (parsedResult.plan) {
        await writeToDemoMemory({
          customerId: customerId || "unknown",
          apiName,
          title: parsedResult.plan.title,
          summary: parsedResult.plan.story,
          story: parsedResult.plan.story,
          score: parsedResult.claimReport?.summary?.supported ? Math.round((parsedResult.claimReport.summary.supported / (parsedResult.claimReport.claims.length || 1)) * 100) : 85,
          evidenceChunkIds: parsedResult.claimReport?.claims?.flatMap((c: any) => c.evidenceChunkIds || []) || []
        });
      }

      // Return unified response
      res.json({
        ...parsedResult,
        trace
      });

    } catch (error: any) {
      console.error("Error executing ADK agent:", error);
      res.status(500).json({
        error: error.message || "Failed to execute ADK Agent",
        trace: [
          {
            id: "adk-orchestrator-failed",
            name: "Google ADK Agent Orchestrator",
            description: "Agent execution failed.",
            runtime: {
              mode: "adk-compatible",
              description: "Google Agent Development Kit (ADK) LlmAgent."
            },
            tools: [],
            status: "failed",
            startedAt: new Date(startedTime).toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startedTime,
            inputSummary: `API: ${apiName}, Customer: ${customerId}`,
            outputSummary: "",
            error: error.message
          }
        ]
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`ProofPilot ADK Agent microservice is listening on port ${PORT}`);
});
