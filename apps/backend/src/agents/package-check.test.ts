import { describe, expect, it } from "vitest";
import { validateCodeIntegrity } from "./package-check.js";
import type { GeneratedFile } from "../types.js";
import { codeRepairAgent } from "./workflow-agents.js";

describe("validateCodeIntegrity", () => {
  it("passes for valid App.tsx with balanced tags and defined/global functions", () => {
    const mockFiles: GeneratedFile[] = [
      {
        path: "frontend/src/App.tsx",
        content: `
          import { useState } from "react";
          
          export default function App() {
            const [step, setStep] = useState(0);
            const title = "Grounded Demo";
            
            const handleAction = () => {
              setStep(1);
            };

            return (
              <div>
                <h1>{title}</h1>
                <button onClick={handleAction}>Go</button>
              </div>
            );
          }
        `
      }
    ];

    const result = validateCodeIntegrity(mockFiles);
    expect(result.passed).toBe(true);
    expect(result.errorMsg).toBe("");
  });

  it("fails for unbalanced JSX tags", () => {
    const mockFiles: GeneratedFile[] = [
      {
        path: "frontend/src/App.tsx",
        content: `
          export default function App() {
            return (
              <div>
                <h1>Missing closing tag
              </div>
            );
          }
        `
      }
    ];

    const result = validateCodeIntegrity(mockFiles);
    expect(result.passed).toBe(false);
    expect(result.errorMsg).toContain("Unbalanced JSX");
  });

  it("fails for undefined function references like escapeForTemplate", () => {
    const mockFiles: GeneratedFile[] = [
      {
        path: "frontend/src/App.tsx",
        content: `
          export default function App() {
            return (
              <div>
                <h1>{escapeForTemplate("Title")}</h1>
              </div>
            );
          }
        `
      }
    ];

    const result = validateCodeIntegrity(mockFiles);
    expect(result.passed).toBe(false);
    expect(result.errorMsg).toContain("ReferenceError: escapeForTemplate is not defined");
  });

  it("runs the codeRepairAgent to correct an App.tsx", async () => {
    const mockFiles: GeneratedFile[] = [
      {
        path: "frontend/src/App.tsx",
        content: `export default function App() { return <div>{escapeForTemplate("Title")}</div>; }`
      }
    ];

    const result = await codeRepairAgent.run({
      files: mockFiles,
      errorMsg: "ReferenceError: escapeForTemplate is not defined",
      plan: { title: "Title", story: "Story", screens: ["Screen 1"], claims: [], endpointsUsed: [], sampleDataNeeded: [], implementationSteps: [], businessValue: [] },
      input: { apiName: "API", docsText: "Docs", industry: "Industry", goal: "Goal" }
    });

    const appFile = result.files.find(f => f.path.endsWith("App.tsx"));
    expect(appFile).toBeDefined();
    // Under vitest mock env, MockModelClient simply returns the prompt content
    expect(appFile?.content).toContain("Code Repair Agent");
  });
});
