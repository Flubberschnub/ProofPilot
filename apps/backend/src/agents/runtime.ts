import type { AgentRun, AgentRuntimeInfo, ModelRunInfo } from "../types.js";

export type AgentContext = {
  runtime: AgentRuntimeInfo;
  model: ModelRunInfo;
  trace: AgentRun[];
};

export type ProofPilotAgent<Input, Output> = {
  id: string;
  name: string;
  description: string;
  tools: string[];
  run(input: Input, context: AgentContext): Promise<Output>;
  summarizeInput(input: Input): string;
  summarizeOutput(output: Output): string;
};

export function createAgentContext(model: ModelRunInfo): AgentContext {
  return {
    model,
    runtime: resolveAgentRuntime(),
    trace: []
  };
}

export async function runAgent<Input, Output>(
  agent: ProofPilotAgent<Input, Output>,
  input: Input,
  context: AgentContext
): Promise<Output> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();

  try {
    const output = await agent.run(input, context);
    const completed = Date.now();
    context.trace.push({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      runtime: context.runtime,
      tools: agent.tools,
      status: "passed",
      startedAt,
      completedAt: new Date(completed).toISOString(),
      durationMs: completed - started,
      inputSummary: safeSummary(() => agent.summarizeInput(input)),
      outputSummary: safeSummary(() => agent.summarizeOutput(output))
    });
    return output;
  } catch (err) {
    const completed = Date.now();
    context.trace.push({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      runtime: context.runtime,
      tools: agent.tools,
      status: "failed",
      startedAt,
      completedAt: new Date(completed).toISOString(),
      durationMs: completed - started,
      inputSummary: safeSummary(() => agent.summarizeInput(input)),
      outputSummary: "",
      error: err instanceof Error ? err.message : "Unknown agent error"
    });
    throw err;
  }
}

function resolveAgentRuntime(): AgentRuntimeInfo {
  const runtime = (process.env.PROOFPILOT_AGENT_RUNTIME ?? "").toLowerCase();
  if (runtime === "adk") {
    return {
      mode: "adk-compatible",
      description: "Google Agent Development Kit (ADK) remote agent service."
    };
  }

  return {
    mode: "bespoke",
    description: "ProofPilot bespoke TypeScript agents using the configured model client."
  };
}

function safeSummary(read: () => string) {
  try {
    return read().slice(0, 500);
  } catch {
    return "";
  }
}
