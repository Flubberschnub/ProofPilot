import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn('[LLM Wrapper] Warning: GEMINI_API_KEY is not defined in environmental variables.');
}

/**
 * Executes a Gemini API call with retries and exponential backoff on 429 errors.
 */
export async function generateContentWithRetry(modelName: string, contents: any): Promise<any> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is missing. Please set it in your backend environment variables.');
  }

  const model = genAI.getGenerativeModel({ model: modelName || 'gemini-2.5-flash' });
  let attempt = 0;
  let delayMs = 5000;

  while (true) {
    try {
      const response = await model.generateContent(contents);
      return response;
    } catch (error: any) {
      attempt++;
      
      const isRateLimit = 
        error.status === 429 ||
        (error.message && (
          error.message.includes('429') ||
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('Quota exceeded') ||
          error.message.includes('Too Many Requests')
        ));

      if (isRateLimit && attempt <= 5) {
        let waitSec = delayMs / 1000;

        if (error.response && error.response.headers) {
          const retryHeader = error.response.headers.get 
            ? error.response.headers.get('retry-after') 
            : error.response.headers['retry-after'];
          
          if (retryHeader) {
            const parsed = parseInt(retryHeader, 10);
            if (!isNaN(parsed)) {
              waitSec = parsed;
            }
          }
        } else if (error.errorDetails && Array.isArray(error.errorDetails)) {
          try {
            const retryInfo = error.errorDetails.find(
              (detail: any) => detail['@type'] && detail['@type'].includes('RetryInfo')
            );
            if (retryInfo && retryInfo.metadata && retryInfo.metadata.retryDelay) {
              const matches = retryInfo.metadata.retryDelay.match(/(\d+)s/);
              if (matches) {
                waitSec = parseInt(matches[1], 10);
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        console.warn(`[LLM Wrapper] 429 Rate Limit hit. Pausing for ${waitSec} seconds before retry (Attempt ${attempt}/5)...`);
        
        await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
        delayMs *= 2; 
      } else {
        console.error(`[LLM Wrapper] API execution failed: ${error.message}`);
        throw error;
      }
    }
  }
}

/**
 * High-level utility to get structured JSON outputs from Gemini model.
 */
export async function generateJSON<T>(modelName: string, prompt: string, systemInstruction = ''): Promise<T> {
  const contents: any = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  if (systemInstruction) {
    contents.systemInstruction = {
      role: 'system',
      parts: [{ text: systemInstruction }]
    };
  }

  const result = await generateContentWithRetry(modelName, contents);
  let text = result.response.text();
  
  try {
    return JSON.parse(text) as T;
  } catch (err: any) {
    // Attempt to repair JSON if it contains raw control characters in string literals
    try {
      // Find all double-quoted string literals in the JSON and escape raw newlines/carriage returns inside them
      const cleaned = text.replace(/"([^"\\]|\\.)*"/g, (match: string) => {
        return match
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
      });
      return JSON.parse(cleaned) as T;
    } catch (secondError) {
      // If regex replacement fails, attempt to strip out control characters or throw original
      try {
        const stripped = text.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
        return JSON.parse(stripped) as T;
      } catch (thirdError) {
        console.error('[LLM Wrapper] Failed to parse response as JSON. Raw response:', text);
        throw new Error('Model did not return valid JSON: ' + err.message);
      }
    }
  }
}
