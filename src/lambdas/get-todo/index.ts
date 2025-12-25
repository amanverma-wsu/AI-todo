import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { dynamoDb, GetCommand } from '/opt/nodejs/dynamodb-client';
import { successResponse, errorResponse, logger, metrics, MetricUnit, captureAsync } from '/opt/nodejs/utils';

const TABLE_NAME = process.env.TABLE_NAME || 'todos';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = (event.requestContext as any).authorizer?.claims?.sub || 'anonymous';
  const todoId = event.pathParameters?.id;

  logger.info('GetTodo invoked', { userId, todoId });

  try {
    if (!todoId) {
      return errorResponse('Todo ID is required', 400);
    }

    const result = await captureAsync('getItem', async () =>
      dynamoDb.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            userId,
            todoId,
          },
        })
      )
    );

    if (!result.Item) {
      metrics.addMetric('TodoNotFound', MetricUnit.Count, 1);
      return errorResponse('Todo not found', 404);
    }

    metrics.addMetric('TodoRetrieved', MetricUnit.Count, 1);
    logger.info('Todo retrieved successfully', { todoId });

    return successResponse(result.Item);
  } catch (error) {
    logger.error('Error retrieving todo', { error });
    metrics.addMetric('GetTodoError', MetricUnit.Count, 1);
    return errorResponse(error instanceof Error ? error : 'Failed to retrieve todo');
  }
};
