import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { dynamoDb, QueryCommand } from '/opt/nodejs/dynamodb-client';
import { successResponse, errorResponse, logger, metrics, MetricUnit, captureAsync } from '/opt/nodejs/utils';

const TABLE_NAME = process.env.TABLE_NAME || 'todos';

interface ListQuery {
  status?: string;
  category?: string;
  limit?: number;
  lastKey?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = (event.requestContext as any).authorizer?.claims?.sub || 'anonymous';
  const { status, category, limit = 20 } = event.queryStringParameters || {};

  logger.info('ListTodos invoked', { userId, status, category });

  try {
    let result;

    if (status) {
      // Use StatusIndex GSI
      result = await captureAsync('queryByStatus', async () =>
        dynamoDb.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'StatusIndex',
            KeyConditionExpression: 'userId = :userId AND #s = :status',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: {
              ':userId': userId,
              ':status': status,
            },
            Limit: Math.min(parseInt(limit as string, 10) || 20, 100),
          })
        )
      );
    } else if (category) {
      // Use CategoryIndex GSI
      result = await captureAsync('queryByCategory', async () =>
        dynamoDb.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'CategoryIndex',
            KeyConditionExpression: 'userId = :userId AND category = :category',
            ExpressionAttributeValues: {
              ':userId': userId,
              ':category': category,
            },
            Limit: Math.min(parseInt(limit as string, 10) || 20, 100),
          })
        )
      );
    } else {
      // Query main table
      result = await captureAsync('queryAll', async () =>
        dynamoDb.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
              ':userId': userId,
            },
            Limit: Math.min(parseInt(limit as string, 10) || 20, 100),
            ScanIndexForward: false, // Sort by createdAt descending
          })
        )
      );
    }

    metrics.addMetric('TodosListed', MetricUnit.Count, result.Items?.length || 0);
    logger.info('Todos listed successfully', { count: result.Items?.length });

    return successResponse({
      todos: result.Items || [],
      count: result.Items?.length || 0,
      lastKey: result.LastEvaluatedKey,
    });
  } catch (error) {
    logger.error('Error listing todos', { error });
    metrics.addMetric('ListTodosError', MetricUnit.Count, 1);
    return errorResponse(error instanceof Error ? error : 'Failed to list todos');
  }
};
