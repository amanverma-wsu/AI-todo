import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({});

export interface BedrockModelConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
}

export const invokeBedrockModel = async (
  prompt: string,
  config: BedrockModelConfig = { modelId: 'amazon.titan-text-express-v1' }
): Promise<string> => {
  const { modelId, maxTokens = 1024, temperature = 0.7 } = config;

  // Amazon Titan Text format
  const payload = {
    inputText: prompt,
    textGenerationConfig: {
      maxTokenCount: maxTokens,
      temperature,
      topP: 0.9,
    },
  };

  const command = new InvokeModelCommand({
    modelId,
    body: JSON.stringify(payload),
    contentType: 'application/json',
    accept: 'application/json',
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    // Titan response format
    return responseBody.results?.[0]?.outputText || '';
  } catch (error) {
    console.error('Bedrock invocation error:', error);
    throw error;
  }
};

export const generateTaskSuggestion = async (taskDescription: string): Promise<string> => {
  const prompt = `Based on the following task description, provide a concise categorization and any suggestions for improvement:
  
Task: "${taskDescription}"

Please provide:
1. Suggested category (Work, Personal, Shopping, Health, Learning, etc.)
2. Recommended priority (low, medium, high)
3. Any helpful subtasks or tips

Keep your response brief and actionable.`;

  return invokeBedrockModel(prompt);
};

export const parseNaturalLanguageTask = async (naturalLanguageInput: string): Promise<{ title: string; description: string; category: string }> => {
  const prompt = `Parse the following natural language task input and extract the title, description, and category. Respond in JSON format.

Input: "${naturalLanguageInput}"

Response format: {"title": "...", "description": "...", "category": "..."}`;

  const response = await invokeBedrockModel(prompt);
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('JSON parse error:', error);
  }

  return {
    title: naturalLanguageInput,
    description: '',
    category: 'General',
  };
};
