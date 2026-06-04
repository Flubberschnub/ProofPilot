import ts from "typescript";
import type { DemoPlan, DemoRequest, GeneratedFile, VerificationOutput } from "../types.js";
import { getModelClient } from "../models/index.js";
import type { ProofPilotAgent } from "./runtime.js";

export async function verifyGeneratedDemo(
  input: DemoRequest,
  plan: DemoPlan,
  files: GeneratedFile[]
): Promise<VerificationOutput> {
  // 1. Programmatic syntax compilation checks
  const compilationErrors: string[] = [];
  let compiles = true;

  for (const file of files) {
    if (file.path.endsWith(".tsx") || file.path.endsWith(".ts")) {
      const sourceFile = ts.createSourceFile(
        file.path,
        file.content,
        ts.ScriptTarget.Latest,
        true
      );
      const diagnostics = (sourceFile as any).parseDiagnostics || [];
      if (diagnostics.length > 0) {
        compiles = false;
        diagnostics.forEach((diag: any) => {
          const message = typeof diag.messageText === "string" 
            ? diag.messageText 
            : JSON.stringify(diag.messageText);
          compilationErrors.push(`${file.path}: ${message}`);
        });
      }
    }
  }

  // 2. Expectations check via LLM or heuristic fallback
  const fallback = () => heuristicExpectationsCheck(input, plan, files, compiles, compilationErrors);

  const response = await getModelClient().generateJson<{
    satisfiesExpectations: boolean;
    expectationsReport: string;
    issuesFound: string[];
  }>({
    schemaName: "DemoVerification",
    system: "You are ProofPilot's quality verification agent. Compare the user's requested scenario/goal against the generated demo plan and the generated code. Check if the code satisfies the business scenario and only uses the target API for documented endpoints. Ensure no capabilities are hallucinated. Delineate custom application logic from target API endpoints.",
    prompt: [
      `User Goal Scenario: ${input.goal}`,
      `Industry: ${input.industry}`,
      `Target API: ${input.apiName}`,
      "",
      `Demo Plan:`,
      JSON.stringify(plan, null, 2),
      "",
      `Generated Files Outline:`,
      JSON.stringify(files.map(f => ({ path: f.path, size: f.content.length })), null, 2),
      "",
      "Review the files and plan against the user goal. Respond with verification status and details."
    ].join("\n"),
    schema: {
      satisfiesExpectations: true,
      expectationsReport: "Detailed verification summary...",
      issuesFound: ["Issue description"]
    },
    fallback
  });

  return {
    compiles,
    compilationErrors,
    satisfiesExpectations: response.satisfiesExpectations,
    expectationsReport: response.expectationsReport,
    issuesFound: response.issuesFound
  };
}

function heuristicExpectationsCheck(
  input: DemoRequest,
  plan: DemoPlan,
  files: GeneratedFile[],
  compiles: boolean,
  compilationErrors: string[]
): { satisfiesExpectations: boolean; expectationsReport: string; issuesFound: string[] } {
  const issuesFound: string[] = [];
  
  if (!compiles) {
    issuesFound.push(...compilationErrors);
  }

  const appFile = files.find(f => f.path.endsWith("App.tsx"));
  if (appFile) {
    const content = appFile.content;
    // Check if the API name is present
    if (!content.toLowerCase().includes(input.apiName.toLowerCase())) {
      issuesFound.push(`Generated App.tsx does not mention the target API: ${input.apiName}`);
    }
    // Check if the industry or goal keywords are present
    const goalKeywords = input.industry.toLowerCase().split(/\s+/);
    const hasKeyword = goalKeywords.some(kw => kw.length > 3 && content.toLowerCase().includes(kw));
    if (!hasKeyword) {
      issuesFound.push(`Generated App.tsx might not align with user industry/scenario: ${input.industry}`);
    }
  } else {
    issuesFound.push("Required file frontend/src/App.tsx was not found.");
  }

  const satisfiesExpectations = issuesFound.length === 0;

  return {
    satisfiesExpectations,
    expectationsReport: satisfiesExpectations
      ? `Heuristic verification passed. The generated code compiles and aligns with the ${input.apiName} target API and the ${input.industry} scenario.`
      : `Heuristic verification found issues: ${issuesFound.join("; ")}`,
    issuesFound
  };
}

export const verificationAgent: ProofPilotAgent<
  { input: DemoRequest; plan: DemoPlan; files: GeneratedFile[] },
  VerificationOutput
> = {
  id: "mvp-07-verification",
  name: "Verification Agent",
  description: "Verifies generated files for code syntax compilation and checks if the demo satisfies user expectations.",
  tools: ["typescript.parseSourceFile", "model.verifyGeneratedDemo"],
  run: ({ input, plan, files }) => verifyGeneratedDemo(input, plan, files),
  summarizeInput: ({ input, files }) => `${input.apiName}; ${files.length} generated files`,
  summarizeOutput: (output) => `Compiles=${output.compiles}; SatisfiesExpectations=${output.satisfiesExpectations}; ${output.issuesFound.length} issues`
};
