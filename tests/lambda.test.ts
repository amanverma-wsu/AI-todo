import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { handler as createTodoHandler } from '../src/lambdas/create-todo';
import { handler as getTodoHandler } from '../src/lambdas/get-todo';
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
  generateTaskSuggestion: jest.fn().mockResolvedValue('AI suggestion'),
  parseNaturalLanguageTask: jest.fn().mockResolvedValue({ title: 'Parsed task' }),
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
});
