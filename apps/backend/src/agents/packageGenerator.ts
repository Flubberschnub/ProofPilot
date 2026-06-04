import { generateJSON } from '../utils/llm.js';

/**
 * PackageGeneratorAgent: Translates the technical plan into a fully functional monorepo
 * containing backend package.json, frontend package.json, configurations, and a README.md.
 */
export async function runPackageGeneratorAgent(validatedPlan: any): Promise<any> {
  const systemInstruction = `
You are the PackageGeneratorAgent. Your job is to generate the concrete React and Node.js code files needed to execute the custom API demo specified by the validated plan.
You must output a file list containing the relative path and full text contents of each file.

To minimize user setup steps, you MUST generate the following files to ensure the demo is a fully functional monorepo out of the box:

Required Files:
1. Root "package.json": Setting up monorepo-wide scripts:
   - "install-all": "npm install && cd backend && npm install && cd ../frontend && npm install"
   - "dev": "npx concurrently \"cd backend && npm run dev\" \"cd frontend && npm run dev\""
   (Make sure to include "concurrently" in devDependencies).
2. Root "README.md": Containing dynamic step-by-step setup guides, explaining what is generated, and how to run it.
3. Backend configuration ("backend/package.json"): Specifying scripts ("dev": "node index.js", "start": "node index.js") and dependencies (e.g. express, cors, node-fetch, dotenv).
4. Backend entrypoint ("backend/index.js"): Express server wrapping the API.
5. Frontend configuration ("frontend/package.json"): Specifying scripts ("dev": "vite", "build": "vite build") and dependencies (e.g. react, react-dom, vite, @vitejs/plugin-react).
6. Frontend build config ("frontend/vite.config.js"): Configuring the Vite server and plugins.
7. Frontend HTML template ("frontend/index.html"): Directing the root div to the React entry point.
8. Frontend source files ("frontend/src/index.js", "frontend/src/App.js", "frontend/src/App.css", and custom components).

Rules for generated code:
1. Make sure all package.json files are syntactically valid JSON.
2. Ensure there are no placeholders or unwritten routines.
3. The output must compile and run.

You MUST respond strictly with a valid JSON matching this schema:
{
  "files": [
    {
      "path": "Relative file path (e.g. package.json, README.md, backend/package.json, frontend/src/App.jsx)",
      "content": "Full string content of the code file"
    }
  ]
}
`;

  const prompt = `
Generate the complete code package, package.json files, configurations, and README.md for the following validated plan:
${JSON.stringify(validatedPlan, null, 2)}
`;

  try {
    const result = await generateJSON<any>('gemini-2.5-flash', prompt, systemInstruction);
    return result;
  } catch (error) {
    console.error('[Package Generator Agent] Error generating code package:', error);
    throw error;
  }
}
