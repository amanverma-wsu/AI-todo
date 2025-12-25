import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb, PutCommand } from '/opt/nodejs/dynamodb-client';
import { successResponse, errorResponse, logger, metrics, TodoItem, MetricUnit, captureAsync } from '/opt/nodejs/utils';
import { publishTodoEvent } from '/opt/nodejs/eventbridge-client';
import { generateTaskSuggestion } from '/opt/nodejs/bedrock-client';

const TABLE_NAME = process.env.TABLE_NAME || 'todos';

interface CreateTodoRequest {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  tags?: string[];
  generateSuggestions?: boolean;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = (event.requestContext as any).authorizer?.claims?.sub || 'anonymous';
  logger.info('CreateTodo invoked', { userId });

  try {
    const body = JSON.parse(event.body || '{}') as CreateTodoRequest;

    if (!body.title || body.title.trim().length === 0) {
      return errorResponse('Title is required', 400);
    }

    const todoId = uuidv4();
    const now = new Date().toISOString();

    let aiSuggestion: string | undefined;
    if (body.generateSuggestions) {
      try {
        aiSuggestion = await captureAsync(
          'generateTaskSuggestion',
          async () => generateTaskSuggestion(body.title)
        );
      } catch (error) {
        logger.warn('Failed to generate AI suggestion', { error });
      }
    }

    const todo: TodoItem = {
      userId,
      todoId,
      title: body.title.trim(),
      description: body.description,
      status: 'pending',
      priority: body.priority || 'medium',
      dueDate: body.dueDate,
      tags: body.tags || [],
      aiSuggestion,
      createdAt: now,
      updatedAt: now,
      expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year TTL
    };

    await captureAsync('putItem', async () =>
      dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: todo,
        })
      )
    );

    // Publish event
    await publishTodoEvent('Todo Created', { todoId, userId, title: todo.title });

    metrics.addMetric('TodoCreated', MetricUnit.Count, 1);
    logger.info('Todo created successfully', { todoId, userId });

    return successResponse(todo, 201);
  } catch (error) {
    logger.error('Error creating todo', { error });
    metrics.addMetric('CreateTodoError', MetricUnit.Count, 1);
    return errorResponse(error instanceof Error ? error : 'Failed to create todo');
  }
};
