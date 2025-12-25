import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { dynamoDb, UpdateCommand } from '/opt/nodejs/dynamodb-client';
import { successResponse, errorResponse, logger, metrics, MetricUnit, captureAsync } from '/opt/nodejs/utils';
import { publishTodoEvent } from '/opt/nodejs/eventbridge-client';

const TABLE_NAME = process.env.TABLE_NAME || 'todos';

interface UpdateTodoRequest {
  title?: string;
  description?: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'archived';
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: string;
  tags?: string[];
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = (event.requestContext as any).authorizer?.claims?.sub || 'anonymous';
  const todoId = event.pathParameters?.id;

  logger.info('UpdateTodo invoked', { userId, todoId });

  try {
    if (!todoId) {
      return errorResponse('Todo ID is required', 400);
    }

    const body = JSON.parse(event.body || '{}') as UpdateTodoRequest;
    const now = new Date().toISOString();

    const updateExpressions: string[] = ['#u = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = { '#u': 'updatedAt' };
    const expressionAttributeValues: Record<string, unknown> = { ':updatedAt': now };

    if (body.title !== undefined) {
      updateExpressions.push('title = :title');
      expressionAttributeValues[':title'] = body.title;
    }
    if (body.description !== undefined) {
      updateExpressions.push('description = :description');
      expressionAttributeValues[':description'] = body.description;
    }
    if (body.status !== undefined) {
      updateExpressions.push('#s = :status');
      expressionAttributeNames['#s'] = 'status';
      expressionAttributeValues[':status'] = body.status;
    }
    if (body.priority !== undefined) {
      updateExpressions.push('priority = :priority');
      expressionAttributeValues[':priority'] = body.priority;
    }
    if (body.category !== undefined) {
      updateExpressions.push('category = :category');
      expressionAttributeValues[':category'] = body.category;
    }
    if (body.dueDate !== undefined) {
      updateExpressions.push('dueDate = :dueDate');
      expressionAttributeValues[':dueDate'] = body.dueDate;
    }
    if (body.tags !== undefined) {
      updateExpressions.push('tags = :tags');
      expressionAttributeValues[':tags'] = body.tags;
    }

    const result = await captureAsync('updateItem', async () =>
      dynamoDb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { userId, todoId },
          UpdateExpression: 'SET ' + updateExpressions.join(', '),
          ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        })
      )
    );

    // Publish event
    await publishTodoEvent('Todo Updated', { todoId, userId, updates: body });

    metrics.addMetric('TodoUpdated', MetricUnit.Count, 1);
    logger.info('Todo updated successfully', { todoId });

    return successResponse(result.Attributes);
  } catch (error) {
    logger.error('Error updating todo', { error });
    metrics.addMetric('UpdateTodoError', MetricUnit.Count, 1);
    return errorResponse(error instanceof Error ? error : 'Failed to update todo');
  }
};
