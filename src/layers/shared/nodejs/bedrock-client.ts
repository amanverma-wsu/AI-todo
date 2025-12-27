import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Explicitly set the region for Bedrock
const bedrockClient = new BedrockRuntimeClient({ 
  region: process.env.AWS_REGION || 'us-east-2' 
});

// Use Qwen3 32B - Alibaba's model
const DEFAULT_MODEL_ID = 'qwen.qwen3-32b-v1:0';

export interface BedrockModelConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
}

export const invokeBedrockModel = async (
  prompt: string,
  config: BedrockModelConfig = { modelId: DEFAULT_MODEL_ID }
): Promise<string> => {
  const { modelId, maxTokens = 1024, temperature = 0.7 } = config;

  // Qwen format (OpenAI-compatible messages format)
  const payload = {
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: maxTokens,
    temperature: temperature,
    top_p: 0.9
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
    // Qwen response format
    return responseBody.choices?.[0]?.message?.content || '';
  } catch (error: any) {
    console.error('Bedrock invocation error:', {
      error: error.message,
      code: error.name,
      modelId,
      region: process.env.AWS_REGION || 'us-east-2'
    });
    throw new Error(`AI service error: ${error.message || 'Model invocation failed'}`);
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

  try {
    return await invokeBedrockModel(prompt);
  } catch (error: any) {
    // Fallback response when Bedrock is unavailable (rate limits, etc.)
    console.warn('Bedrock unavailable, using fallback suggestion:', error.message);
    return generateFallbackSuggestion(taskDescription);
  }
};

// Smart rule-based fallback when AI is unavailable
const generateFallbackSuggestion = (task: string): string => {
  const taskLower = task.toLowerCase();
  const words = task.split(/\s+/);
  
  let category = 'General';
  let priority = 'medium';
  let tips: string[] = [];
  
  // Enhanced category detection with more keywords
  const categoryRules: { category: string; keywords: string[]; tips: string[] }[] = [
    {
      category: 'Shopping',
      keywords: ['buy', 'shop', 'groceries', 'purchase', 'order', 'pick up', 'store', 'market', 'amazon', 'online'],
      tips: ['Make a detailed list before shopping', 'Compare prices across stores', 'Check for coupons or deals']
    },
    {
      category: 'Work',
      keywords: ['work', 'meeting', 'report', 'email', 'project', 'presentation', 'deadline', 'client', 'office', 'boss', 'colleague', 'review', 'submit', 'send'],
      tips: ['Block focused time on your calendar', 'Prepare an outline first', 'Set a clear deadline']
    },
    {
      category: 'Health',
      keywords: ['exercise', 'gym', 'doctor', 'health', 'medicine', 'workout', 'run', 'yoga', 'dentist', 'appointment', 'vitamin', 'sleep', 'diet', 'walk'],
      tips: ['Schedule at a consistent time daily', 'Track your progress', 'Start small and build up']
    },
    {
      category: 'Learning',
      keywords: ['learn', 'study', 'read', 'course', 'tutorial', 'book', 'practice', 'skill', 'class', 'lesson', 'research', 'watch'],
      tips: ['Set aside 25-minute focused sessions', 'Take notes for better retention', 'Review what you learned yesterday']
    },
    {
      category: 'Finance',
      keywords: ['pay', 'bill', 'budget', 'bank', 'money', 'invoice', 'tax', 'expense', 'save', 'invest', 'transfer'],
      tips: ['Set up automatic payments if possible', 'Keep receipts organized', 'Review your spending weekly']
    },
    {
      category: 'Home',
      keywords: ['clean', 'fix', 'repair', 'organize', 'laundry', 'dishes', 'cook', 'garden', 'furniture', 'decorate', 'maintenance'],
      tips: ['Break into room-by-room tasks', 'Set a timer for focused cleaning', 'Gather supplies before starting']
    },
    {
      category: 'Social',
      keywords: ['call', 'family', 'friend', 'birthday', 'party', 'visit', 'dinner', 'lunch', 'coffee', 'meet', 'celebrate', 'gift'],
      tips: ['Add to your calendar with reminders', 'Prepare talking points if needed', 'Follow up after the event']
    },
    {
      category: 'Travel',
      keywords: ['travel', 'trip', 'flight', 'hotel', 'book', 'vacation', 'pack', 'passport', 'visa', 'reservation'],
      tips: ['Create a packing checklist', 'Book early for better prices', 'Save confirmation numbers']
    },
    {
      category: 'Creative',
      keywords: ['write', 'design', 'create', 'draw', 'paint', 'music', 'photo', 'video', 'blog', 'art'],
      tips: ['Start with a rough draft or sketch', 'Set a creative block in your schedule', 'Gather inspiration first']
    }
  ];
  
  // Find best matching category
  let bestMatch = { category: 'General', tips: ['Break this task into smaller steps', 'Set a specific deadline', 'Review progress regularly'] };
  let maxMatches = 0;
  
  for (const rule of categoryRules) {
    const matches = rule.keywords.filter(kw => taskLower.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = { category: rule.category, tips: rule.tips };
    }
  }
  
  category = bestMatch.category;
  tips = bestMatch.tips;
  
  // Enhanced priority detection
  const highPriorityWords = ['urgent', 'asap', 'important', 'deadline', 'today', 'now', 'critical', 'emergency', 'immediately', 'priority'];
  const lowPriorityWords = ['later', 'someday', 'maybe', 'eventually', 'when possible', 'no rush', 'whenever'];
  
  if (highPriorityWords.some(w => taskLower.includes(w))) {
    priority = 'high';
  } else if (lowPriorityWords.some(w => taskLower.includes(w))) {
    priority = 'low';
  }
  
  // Add task-specific tip based on the actual task content
  const taskSpecificTip = generateTaskSpecificTip(task, category);
  if (taskSpecificTip && !tips.includes(taskSpecificTip)) {
    tips = [taskSpecificTip, ...tips.slice(0, 2)];
  }
  
  return `1. Suggested category: ${category}
2. Recommended priority: ${priority}
3. Tips for "${task.substring(0, 30)}${task.length > 30 ? '...' : ''}":
${tips.map(t => `   - ${t}`).join('\n')}`;
};

// Generate a tip specific to the task content
const generateTaskSpecificTip = (task: string, category: string): string | null => {
  const taskLower = task.toLowerCase();
  
  // Time-based suggestions
  if (taskLower.includes('tomorrow') || taskLower.includes('today')) {
    return 'This is time-sensitive - prioritize it in your schedule';
  }
  if (taskLower.includes('weekly') || taskLower.includes('every')) {
    return 'Consider setting up a recurring reminder';
  }
  
  // Action-based suggestions
  if (taskLower.includes('finish') || taskLower.includes('complete')) {
    return 'Review what\'s already done before continuing';
  }
  if (taskLower.includes('start') || taskLower.includes('begin')) {
    return 'Spend 5 minutes planning before you start';
  }
  if (taskLower.includes('prepare') || taskLower.includes('plan')) {
    return 'Write down all the components you need';
  }
  
  return null;
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
