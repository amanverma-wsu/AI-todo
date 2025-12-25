# AI Integration Guide

## Overview

Complete guide to using Amazon Bedrock for AI-powered features in the Todo API.

## Bedrock Setup

### Enable Bedrock in Your Region
```bash
# Check available models
aws bedrock list-foundation-models --region us-east-1

# Request model access (if needed)
aws bedrock get-foundation-model-availability-in-region \
  --model-identifier anthropic.claude-3-sonnet-20240229-v1:0 \
  --region us-east-1
```

### Model Selection

| Model | Cost | Latency | Use Case |
|-------|------|---------|----------|
| Claude 3.5 Sonnet | $3/1M input, $15/1M output | 2-5s | Default, NLP |
| Claude 3 Haiku | $0.25/1M input, $1.25/1M output | 1-2s | Cost-sensitive |
| Nova | $0.3/1M input, $1.2/1M output | 1-3s | Fast inference |
| Llama 3.1 | $0.5/1M input, $2.5/1M output | 2-4s | Open source |

### Configuration
```typescript
export const BEDROCK_CONFIG = {
  dev: {
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0', // Cheaper
    maxTokens: 512,
    temperature: 0.5,
  },
  prod: {
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0', // Better
    maxTokens: 1024,
    temperature: 0.7,
  },
};
```

## AI Feature Implementations

### 1. Natural Language Task Parsing

Convert natural language to structured todo:

```bash
Input:  "Remind me to call John tomorrow at 2 PM about the project"
Output: {
  "title": "Call John about the project",
  "dueDate": "2025-01-25T14:00:00Z",
  "priority": "medium",
  "description": "Discuss project details"
}
```

**Implementation:**
```typescript
export const parseNaturalLanguageTask = async (input: string): Promise<ParsedTask> => {
  const prompt = `Parse this natural language task and extract:
- title (required)
- description (optional)
- dueDate (ISO format, optional)
- priority (low/medium/high, optional)
- tags (array, optional)

Input: "${input}"

Respond in JSON format only, no explanation.`;

  const response = await invokeBedrockModel(prompt, { maxTokens: 500 });
  return JSON.parse(response);
};
```

**API Endpoint:**
```bash
POST /todos/ai/parse
Content-Type: application/json

{
  "naturalLanguage": "Remind me to buy groceries tomorrow morning"
}

Response:
{
  "title": "Buy groceries",
  "dueDate": "2025-01-25T09:00:00Z",
  "priority": "medium",
  "category": "Shopping"
}
```

### 2. Smart Task Suggestions

AI recommends optimizations:

```bash
Input Task:  "Complete project"
AI Suggests:
{
  "category": "Work",
  "priority": "high",
  "estimatedHours": 8,
  "subtasks": [
    "Research requirements",
    "Design architecture",
    "Implement features",
    "Test and deploy"
  ],
  "relatedTasks": ["Review documentation", "Set up environment"]
}
```

**Implementation:**
```typescript
export const generateTaskSuggestion = async (title: string, description?: string): Promise<Suggestion> => {
  const prompt = `Analyze this task and provide suggestions:

Task: "${title}"
${description ? `Details: "${description}"` : ''}

Provide:
1. Optimal category
2. Recommended priority
3. Estimated time in hours
4. 3-5 actionable subtasks
5. Related common tasks

Return as JSON.`;

  const response = await invokeBedrockModel(prompt, { maxTokens: 1000 });
  return JSON.parse(response);
};
```

### 3. Auto-Categorization

Intelligent task categorization:

```bash
Input: "Schedule dentist appointment"
Output: "Health" (not "Shopping" or "Personal")

Input: "Review code for authentication module"
Output: "Work"
```

**Implementation:**
```typescript
const CATEGORIES = ['Work', 'Personal', 'Shopping', 'Health', 'Learning', 'Finance', 'Home'];

export const autoCategorizeTodo = async (title: string, description?: string): Promise<string> => {
  const prompt = `Categorize this todo into ONE of these categories:
${CATEGORIES.join(', ')}

Task: "${title}"
${description ? `Details: "${description}"` : ''}

Respond with only the category name, nothing else.`;

  const response = await invokeBedrockModel(prompt, { maxTokens: 50 });
  return response.trim();
};
```

### 4. Priority Assessment

ML-powered priority prediction:

```bash
Input: 
- "Submit project by Friday" (High priority - deadline)
- "Nice to have feature" (Low priority - non-urgent)
- "Fix bug in production" (High priority - impact)

Output: Recommended priority level
```

**Implementation:**
```typescript
export const predictPriority = async (
  title: string,
  description?: string,
  dueDate?: string
): Promise<'low' | 'medium' | 'high'> => {
  const prompt = `Based on urgency, impact, and deadline, recommend priority:

Task: "${title}"
${description ? `Details: "${description}"` : ''}
${dueDate ? `Due: "${dueDate}"` : 'No deadline'}

Consider:
- Is it time-sensitive?
- What's the impact if delayed?
- Dependencies on other tasks?

Respond with ONLY: low | medium | high`;

  const response = await invokeBedrockModel(prompt, { maxTokens: 10 });
  return response.trim().toLowerCase() as any;
};
```

### 5. Task Summary Generation

Create summaries of todo lists:

```bash
Input: 5 todos across categories
Output: "You have 5 tasks: 2 work (urgent), 1 health appointment, 2 personal"
```

**Implementation:**
```typescript
export const generateSummary = async (todos: TodoItem[]): Promise<string> => {
  const todosList = todos.map(t => `- ${t.title} (${t.priority})`).join('\n');

  const prompt = `Summarize this todo list in 1-2 sentences:
${todosList}

Focus on highlights, urgency, and balance across categories.`;

  return await invokeBedrockModel(prompt, { maxTokens: 200 });
};
```

### 6. Productivity Insights

Analyze work patterns and suggest improvements:

```typescript
export const generateProductivityInsights = async (todos: TodoItem[]): Promise<Insight[]> => {
  const completedPerDay = groupTodosByDay(todos);
  const categoryBreakdown = groupTodosByCategory(todos);

  const prompt = `Based on this productivity data, provide 3-5 actionable insights:

Completed per day: ${JSON.stringify(completedPerDay)}
Categories: ${JSON.stringify(categoryBreakdown)}

Suggest improvements to task management and prioritization.`;

  const response = await invokeBedrockModel(prompt, { maxTokens: 500 });
  return parseInsights(response);
};
```

## Cost Optimization

### Batch Processing

Group AI requests to reduce API calls:

```typescript
export const batchProcessTodos = async (todos: TodoItem[]): Promise<TodoItem[]> => {
  // Process 10 at a time
  const batchSize = 10;
  const results: TodoItem[] = [];

  for (let i = 0; i < todos.length; i += batchSize) {
    const batch = todos.slice(i, i + batchSize);
    
    // Single prompt for multiple todos
    const prompt = `Suggest priorities for these tasks:
${batch.map(t => `- ${t.title}`).join('\n')}

Return JSON array with title and priority.`;

    const suggestions = await invokeBedrockModel(prompt);
    // Apply suggestions to batch
    results.push(...applyToTodos(batch, suggestions));
  }

  return results;
};
```

### Caching Responses

Cache AI results to avoid redundant calls:

```typescript
const suggestionCache = new Map<string, string>();

export const getCachedSuggestion = async (taskTitle: string): Promise<string> => {
  // Check cache first
  if (suggestionCache.has(taskTitle)) {
    return suggestionCache.get(taskTitle)!;
  }

  // Call Bedrock
  const suggestion = await generateTaskSuggestion(taskTitle);

  // Cache for 1 hour
  suggestionCache.set(taskTitle, suggestion);
  setTimeout(() => suggestionCache.delete(taskTitle), 3600000);

  return suggestion;
};
```

### Prompt Optimization

Shorter prompts = lower cost:

```typescript
// ❌ Long prompt
const longPrompt = `You are an expert task management AI...
Analyze the following task carefully...
Provide detailed suggestions...`;

// ✅ Short prompt
const shortPrompt = `Categorize: "Buy groceries"`;
```

## Monitoring AI Usage

### Track Bedrock Calls
```bash
# Get invocation metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Bedrock \
  --metric-name Invocations \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

### Cost Analysis
```bash
# Estimate monthly cost
MONTHLY_INVOCATIONS=10000
INPUT_TOKENS_PER_CALL=200
OUTPUT_TOKENS_PER_CALL=100

INPUT_COST=$((MONTHLY_INVOCATIONS * INPUT_TOKENS_PER_CALL * 3 / 1000000))
OUTPUT_COST=$((MONTHLY_INVOCATIONS * OUTPUT_TOKENS_PER_CALL * 15 / 1000000))

echo "Estimated monthly cost: \$$(($INPUT_COST + $OUTPUT_COST))"
```

## Error Handling

### Timeout & Retry Logic
```typescript
export const invokeBedrockWithRetry = async (
  prompt: string,
  maxRetries = 3,
  timeoutMs = 30000
): Promise<string> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await Promise.race([
        invokeBedrockModel(prompt),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        ),
      ]);

      clearTimeout(timeoutId);
      return response as string;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
  throw new Error('Max retries exceeded');
};
```

### Fallback Strategies
```typescript
export const generateSuggestionWithFallback = async (title: string): Promise<string> => {
  try {
    return await generateTaskSuggestion(title);
  } catch (error) {
    logger.warn('Bedrock failed, using fallback', { error });
    
    // Fallback: Use simple heuristics
    if (title.includes('urgent') || title.includes('ASAP')) {
      return JSON.stringify({ priority: 'high', category: 'Work' });
    }
    
    return JSON.stringify({ priority: 'medium', category: 'Personal' });
  }
};
```

## Prompt Engineering Best Practices

### 1. Be Specific
```typescript
// ❌ Too vague
"Categorize this todo"

// ✅ Specific
"Categorize into: Work, Personal, Shopping, Health, Learning
Todo: 'Fix authentication bug in login page'
Respond with category only."
```

### 2. Use Structured Output
```typescript
// Request JSON for reliable parsing
const prompt = `Task: "${title}"
Respond in JSON: { "category": "...", "priority": "...", "subtasks": [...] }`;
```

### 3. Few-Shot Prompting
```typescript
const prompt = `
Examples:
"Call dentist" → {"category": "Health", "priority": "medium"}
"Fix bug" → {"category": "Work", "priority": "high"}

Now categorize:
"${title}" → `;
```

### 4. Context Window
```typescript
// Claude 3 Sonnet: 200K tokens
// Use for processing large documents or many todos at once

export const processLargeDataset = async (todos: TodoItem[]): Promise<void> => {
  // Process all at once (within token limit)
  const allTodosText = todos.map(t => `${t.title} - ${t.description}`).join('\n');
  
  const prompt = `Analyze these ${todos.length} todos...
${allTodosText}`;

  return await invokeBedrockModel(prompt);
};
```

## Advanced Features

### Conversational AI (Multi-turn)
```typescript
export interface Conversation {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export const chat = async (conversation: Conversation): Promise<string> => {
  const formattedMessages = conversation.messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const response = await invokeBedrockModel(formattedMessages);
  return response;
};
```

### Vision Capabilities (future)
```typescript
// When Claude adds vision
export const analyzeTaskImage = async (imageBase64: string): Promise<string> => {
  const prompt = `Analyze this image and extract todo items`;
  
  // Vision prompt (future implementation)
  return await invokeBedrockModel(prompt, { image: imageBase64 });
};
```

## Testing AI Features

### Mock Responses for Testing
```typescript
jest.mock('@aws-sdk/client-bedrock-runtime');

const mockBedrockClient = BedrockRuntimeClient as jest.Mocked<typeof BedrockRuntimeClient>;

mockBedrockClient.prototype.send.mockResolvedValue({
  body: new TextEncoder().encode(JSON.stringify({
    content: [{ text: '{"category":"Work","priority":"high"}' }]
  }))
});
```

## Resources

- [Bedrock API Docs](https://docs.aws.amazon.com/bedrock/latest/userguide/)
- [Claude 3 Models](https://docs.anthropic.com/claude/reference/)
- [Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)

---

Next: [Troubleshooting Guide](./TROUBLESHOOTING.md)
