import { generateJSON } from '../utils/llm.js';

/**
 * IntakeAgent: Parses user intent, discovers target API, and outlines required API keys.
 */
export async function runIntakeAgent(userPrompt: string): Promise<any> {
  const systemInstruction = `
You are the IntakeAgent, the first step in an agentic demo generation pipeline.
Your job is to parse the user's prompt and extract:
1. The target API they want to showcase (e.g. Stripe, SendGrid, Twilio, OpenAI, GitHub, etc.).
2. If they didn't specify one, determine 2-3 optimal APIs that fit their requirements.
3. List the API key environmental variables they will need to run the demo (e.g. STRIPE_SECRET_KEY).
4. Provide step-by-step instructions on how the user can obtain these API keys.
5. Create a concise summary of the goal of the demo.

You MUST respond strictly with a valid JSON object matching the following structure.

{
  "targetApi": "Name of the target API",
  "hasSpecifiedApi": true,
  "discoveredApis": ["Optional list of recommended APIs if none specified"],
  "requiredApiKeys": [
    {
      "name": "API_KEY_ENV_NAME",
      "purpose": "What this key is used for",
      "instruction": "Detailed markdown step-by-step guide on how to register and get this key from the provider"
    }
  ],
  "userGoalSummary": "Clear summary of what the demo should build"
}
`;

  const prompt = `Analyze this user request: "${userPrompt}"`;
  
  try {
    const result = await generateJSON<any>('gemini-2.5-flash', prompt, systemInstruction);
    return result;
  } catch (error) {
    console.error('[Intake Agent] Error running agent:', error);
    throw error;
  }
}
