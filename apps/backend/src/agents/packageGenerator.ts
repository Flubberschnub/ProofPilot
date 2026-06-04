import { generateJSON } from '../utils/llm.js';

/**
 * PackageGeneratorAgent: Translates the technical plan into actual React (frontend) and Express (backend) code files.
 */
export async function runPackageGeneratorAgent(validatedPlan: any): Promise<any> {
  const systemInstruction = `
You are the PackageGeneratorAgent. Your job is to generate the concrete React and Node.js code files needed to execute the custom API demo specified by the validated plan.
You must output a file list containing the relative path and full text contents of each file.

Rules for generated code:
1. React frontend files: Use standard React (JS/JSX). Assume React 18+ is used. Imports must be correct. Make the code complete, beautiful (using inline CSS or modern simple CSS), and robust.
2. Backend files: Use standard CommonJS Node.js syntax (require). Integrate API requests properly using standard fetch or libraries. Do not hardcode secret keys; read them from process.env.
3. Write clean, complete code. Do not use comments like "// implement here" or placeholders.
4. The output must compile and run.

You MUST respond strictly with a valid JSON matching this schema:
{
  "files": [
    {
      "path": "Relative file path (e.g. frontend/src/components/PaymentForm.jsx or backend/routes/stripe.js)",
      "content": "Full string content of the code file"
    }
  ]
}
`;

  const prompt = `
Generate the code files for the following validated plan:
${JSON.stringify(validatedPlan, null, 2)}
`;

  try {
    const result = await generateJSON<any>('gemini-1.5-flash', prompt, systemInstruction);
    return result;
  } catch (error) {
    console.error('[Package Generator Agent] Error generating code package:', error);
    throw error;
  }
}
