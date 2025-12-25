import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { dynamoDb, DeleteCommand } from '/opt/nodejs/dynamodb-client';
import { successResponse, errorResponse, logger, metrics, MetricUnit, captureAsync } from '/opt/nodejs/utils';
import { publishTodoEvent } from '/opt/nodejs/eventbridge-client';

const TABLE_NAME = process.env.TABLE_NAME || 'todos';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = (event.requestContext as any).authorizer?.claims?.sub || 'anonymous';
  const todoId = event.pathParameters?.id;

  logger.info('DeleteTodo invoked', { userId, todoId });

  try {
    if (!todoId) {
      return errorResponse('Todo ID is required', 400);
    }

    await captureAsync('deleteItem', async () =>
      dynamoDb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            userId,
            todoId,
          },
        })
      )
    );

    // Publish event
    await publishTodoEvent('Todo Deleted', { todoId, userId });

    metrics.addMetric('TodoDeleted', MetricUnit.Count, 1);
    logger.info('Todo deleted successfully', { todoId });

    return successResponse({ message: 'Todo deleted successfully' });
  } catch (error) {
    logger.error('Error deleting todo', { error });
    metrics.addMetric('DeleteTodoError', MetricUnit.Count, 1);
    return errorResponse(error instanceof Error ? error : 'Failed to delete todo');
  }
};
