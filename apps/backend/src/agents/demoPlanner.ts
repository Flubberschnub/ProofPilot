import { generateJSON } from '../utils/llm.js';

/**
 * DemoPlannerAgent: Drafts a step-by-step technical plan outlining frontend/backend structures.
 */
export async function runDemoPlannerAgent(userPrompt: string, capabilities: any): Promise<any> {
  const systemInstruction = `
You are the DemoPlannerAgent. Your job is to design a complete technical specification for a mini custom API demo.
You will receive:
1. The user's goal prompt.
2. The target API capabilities (endpoints, parameters, etc.).

You must output a structured plan detailing:
1. Backend routes that need to be created in the demo backend to wrap the API calls.
2. Frontend components that need to be created in the demo frontend to capture user input, trigger the backend routes, and display outputs.
3. Steps for implementation.

You MUST respond strictly with a valid JSON matching this schema:
{
  "demoName": "A concise name for this demo",
  "architectureOverview": "Short summary of how the frontend and backend interact",
  "backendRoutes": [
    {
      "path": "/api/demo/...",
      "method": "POST | GET | PUT",
      "purpose": "What this route does in the demo backend",
      "upstreamEndpoint": "The actual endpoint path in the third-party API being called",
      "expectedPayload": {},
      "expectedResponse": {}
    }
  ],
  "frontendComponents": [
    {
      "name": "ComponentName",
      "purpose": "What this UI component does",
      "state": ["state_variable_1", "state_variable_2"],
      "props": ["prop_1"],
      "uiDescription": "Visual design summary of this component"
    }
  ],
  "steps": [
    {
      "step": 1,
      "title": "Step title",
      "description": "Details about what code is built in this step"
    }
  ]
}
`;

  const prompt = `
User Prompt: ${userPrompt}
API Capabilities: ${JSON.stringify(capabilities, null, 2)}
`;

  try {
    const result = await generateJSON<any>('gemini-2.5-flash', prompt, systemInstruction);
    return result;
  } catch (error) {
    console.error('[Demo Planner Agent] Error drafting plan:', error);
    throw error;
  }
}
