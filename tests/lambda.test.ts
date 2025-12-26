import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { handler as createTodoHandler } from '../src/lambdas/create-todo';
import { handler as getTodoHandler } from '../src/lambdas/get-todo';
import { handler as aiTaskProcessorHandler } from '../src/lambdas/ai-task-processor';
import { APIGatewayProxyEventV2, Context } from 'aws-lambda';

// Mock DynamoDB client
jest.mock('../src/layers/shared/nodejs/dynamodb-client', () => ({
  dynamoDb: {
    send: jest.fn().mockResolvedValue({}),
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  QueryCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
}));

// Mock EventBridge client
jest.mock('../src/layers/shared/nodejs/eventbridge-client', () => ({
  publishTodoEvent: jest.fn().mockResolvedValue(undefined),
}));

// Mock Bedrock client
jest.mock('../src/layers/shared/nodejs/bedrock-client', () => ({
  generateTaskSuggestion: jest.fn().mockResolvedValue('Category: Work\nPriority: high\nSubtasks:\n1. Research\n2. Implement'),
  parseNaturalLanguageTask: jest.fn().mockResolvedValue({ 
    title: 'Call John about the project', 
    description: 'Discuss project details',
    category: 'Work' 
  }),
  invokeBedrockModel: jest.fn().mockResolvedValue('AI model response'),
}));

// Mock context object for Lambda handlers
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

describe('Todo API Lambda Functions', () => {
  let mockEvent: Partial<APIGatewayProxyEventV2>;

  beforeEach(() => {
    mockEvent = {
      requestContext: {
        authorizer: {
          claims: {
            sub: 'test-user-123',
          },
        },
      },
      body: '',
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTodoHandler', () => {
    it('should create a todo with valid input', async () => {
      mockEvent.body = JSON.stringify({
        title: 'Test Todo',
        description: 'Test Description',
        priority: 'high',
      });

      const response = await createTodoHandler(mockEvent as APIGatewayProxyEventV2, mockContext, () => {});

      expect(response).toBeDefined();
      expect((response as any).statusCode).toBe(201);
      expect((response as any).body).toBeDefined();
    });

    it('should return 400 for missing title', async () => {
      mockEvent.body = JSON.stringify({
        description: 'No title',
      });

      const response = await createTodoHandler(mockEvent as APIGatewayProxyEventV2, mockContext, () => {});

      expect(response).toBeDefined();
      expect((response as any).statusCode).toBe(400);
    });
  });

  describe('getTodoHandler', () => {
    it('should return 400 when todo ID is missing', async () => {
      mockEvent.pathParameters = {};

      const response = await getTodoHandler(mockEvent as APIGatewayProxyEventV2, mockContext, () => {});

      expect(response).toBeDefined();
      expect((response as any).statusCode).toBe(400);
    });
  });

  describe('aiTaskProcessorHandler', () => {
    it('should generate task suggestions in suggest mode', async () => {
      mockEvent.body = JSON.stringify({
        task: 'I need to prepare for the quarterly review meeting',
        mode: 'suggest',
      });

      const response = await aiTaskProcessorHandler(mockEvent as APIGatewayProxyEventV2, mockContext, () => {});

      expect(response).toBeDefined();
      expect((response as any).statusCode).toBe(200);
      const body = JSON.parse((response as any).body);
      expect(body.data).toContain('Category');
    });

    it('should parse natural language task in parse mode', async () => {
      mockEvent.body = JSON.stringify({
        task: 'Remind me to call John tomorrow at 2 PM about the project',
        mode: 'parse',
      });

      const response = await aiTaskProcessorHandler(mockEvent as APIGatewayProxyEventV2, mockContext, () => {});

      expect(response).toBeDefined();
      expect((response as any).statusCode).toBe(200);
      const body = JSON.parse((response as any).body);
      expect(body.data).toHaveProperty('title');
      expect(body.data).toHaveProperty('category');
    });

    it('should return 400 when task is missing', async () => {
      mockEvent.body = JSON.stringify({
        mode: 'suggest',
      });

      const response = await aiTaskProcessorHandler(mockEvent as APIGatewayProxyEventV2, mockContext, () => {});

      expect(response).toBeDefined();
      expect((response as any).statusCode).toBe(400);
    });

    it('should return 400 when task is empty', async () => {
      mockEvent.body = JSON.stringify({
        task: '   ',
        mode: 'suggest',
      });

      const response = await aiTaskProcessorHandler(mockEvent as APIGatewayProxyEventV2, mockContext, () => {});

      expect(response).toBeDefined();
      expect((response as any).statusCode).toBe(400);
    });

    it('should default to suggest mode when mode is not specified', async () => {
      mockEvent.body = JSON.stringify({
        task: 'Complete the documentation for the API',
      });

      const response = await aiTaskProcessorHandler(mockEvent as APIGatewayProxyEventV2, mockContext, () => {});

      expect(response).toBeDefined();
      expect((response as any).statusCode).toBe(200);
    });
  });
});
