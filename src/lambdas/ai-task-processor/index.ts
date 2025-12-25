import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { successResponse, errorResponse, logger, metrics, MetricUnit, captureAsync } from '/opt/nodejs/utils';
import { parseNaturalLanguageTask, generateTaskSuggestion } from '/opt/nodejs/bedrock-client';

interface AIProcessRequest {
  task: string;
  mode: 'suggest' | 'parse';
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = (event.requestContext as any).authorizer?.claims?.sub || 'anonymous';
  logger.info('AITaskProcessor invoked', { userId });

  try {
    const body = JSON.parse(event.body || '{}') as AIProcessRequest;

    if (!body.task || body.task.trim().length === 0) {
      return errorResponse('Task is required', 400);
    }

    let result;

    if (body.mode === 'parse') {
      result = await captureAsync('parseNaturalLanguageTask', async () =>
        parseNaturalLanguageTask(body.task)
      );
    } else {
      result = await captureAsync('generateTaskSuggestion', async () =>
        generateTaskSuggestion(body.task)
      );
    }

    metrics.addMetric('AIProcessingSuccess', MetricUnit.Count, 1);
    logger.info('AI task processing completed', { userId });

    return successResponse(result);
  } catch (error) {
    logger.error('Error processing task with AI', { error });
    metrics.addMetric('AIProcessingError', MetricUnit.Count, 1);
    return errorResponse(error instanceof Error ? error : 'Failed to process task');
  }
};
