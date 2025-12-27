import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Explicitly set the region for Bedrock
const bedrockClient = new BedrockRuntimeClient({ 
  region: process.env.AWS_REGION || 'us-east-2' 
});

// Use smaller Meta Llama 3.2 1B model via inference profile for better throughput
const DEFAULT_MODEL_ID = 'us.meta.llama3-2-1b-instruct-v1:0';

// Reduced token limits to minimize throttling
const TOKEN_LIMITS = {
  suggestion: 200,  // Suggestions need ~200 tokens max
  parsing: 100,     // JSON parsing needs ~100 tokens max
  default: 256      // Conservative default
};

export interface BedrockModelConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
}

// Exponential backoff retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 4000
};

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Invoke with exponential backoff retry
export const invokeBedrockModel = async (
  prompt: string,
  config: BedrockModelConfig = { modelId: DEFAULT_MODEL_ID }
): Promise<string> => {
  const { modelId, maxTokens = TOKEN_LIMITS.default, temperature = 0.7 } = config;

  // Llama 3.2 format
  const payload = {
    prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
    max_gen_len: maxTokens,
    temperature: temperature,
    top_p: 0.9
  };

  const command = new InvokeModelCommand({
    modelId,
    body: JSON.stringify(payload),
    contentType: 'application/json',
    accept: 'application/json',
  });

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      // Llama response format
      return responseBody.generation || responseBody.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      lastError = error;
      
      // Only retry on throttling errors
      if (error.name === 'ThrottlingException' || error.message?.includes('throttl') || error.message?.includes('Too many tokens')) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelayMs
        );
        console.warn(`Throttled (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}), waiting ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      // Non-throttling errors fail immediately
      console.error('Bedrock invocation error:', {
        error: error.message,
        code: error.name,
        modelId,
        region: process.env.AWS_REGION || 'us-east-2'
      });
      throw new Error(`AI service error: ${error.message || 'Model invocation failed'}`);
    }
  }
  
  // All retries exhausted
  console.error('Bedrock throttling persisted after retries:', lastError?.message);
  throw new Error(`AI service throttled: ${lastError?.message || 'Rate limit exceeded'}`);
};

export const generateTaskSuggestion = async (taskDescription: string): Promise<string> => {
  // Shorter, more focused prompt to reduce token usage
  const prompt = `Task: "${taskDescription}"

Categorize this task briefly:
1. Category (Work/Personal/Shopping/Health/Learning)
2. Priority (low/medium/high)
3. One tip`;

  try {
    return await invokeBedrockModel(prompt, { 
      modelId: DEFAULT_MODEL_ID, 
      maxTokens: TOKEN_LIMITS.suggestion  // Only 200 tokens needed
    });
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
  // Minimal prompt for JSON extraction
  const prompt = `Extract from: "${naturalLanguageInput}"
Return only JSON: {"title":"...","description":"...","category":"..."}`;

  try {
    const response = await invokeBedrockModel(prompt, {
      modelId: DEFAULT_MODEL_ID,
      maxTokens: TOKEN_LIMITS.parsing  // Only 100 tokens for JSON
    });
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error: any) {
    console.warn('NL parsing failed, using input directly:', error.message);
  }

  // Fallback: use rule-based extraction
  return parseTaskFallback(naturalLanguageInput);
};

// Rule-based task parsing fallback
const parseTaskFallback = (input: string): { title: string; description: string; category: string } => {
  const inputLower = input.toLowerCase();
  
  // Detect category from keywords
  let category = 'General';
  if (inputLower.match(/buy|shop|groceries|order|purchase/)) category = 'Shopping';
  else if (inputLower.match(/work|meeting|report|email|project|deadline/)) category = 'Work';
  else if (inputLower.match(/exercise|gym|doctor|health|workout/)) category = 'Health';
  else if (inputLower.match(/learn|study|read|course|practice/)) category = 'Learning';
  else if (inputLower.match(/pay|bill|bank|money|budget/)) category = 'Finance';
  else if (inputLower.match(/clean|fix|organize|home|laundry/)) category = 'Home';
  else if (inputLower.match(/call|family|friend|meet|visit/)) category = 'Social';
  
  // Extract title (first sentence or phrase)
  const title = input.split(/[.!?\n]/)[0].trim() || input.substring(0, 50);
  
  return {
    title,
    description: input.length > title.length ? input.substring(title.length).trim() : '',
    category
  };
};
