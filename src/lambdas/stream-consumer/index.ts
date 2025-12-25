import { DynamoDBStreamHandler } from 'aws-lambda';
import { logger, metrics, MetricUnit } from '/opt/nodejs/utils';
import { publishEvent } from '/opt/nodejs/eventbridge-client';

export const handler: DynamoDBStreamHandler = async (event) => {
  logger.info('Stream consumer invoked', { recordCount: event.Records.length });

  let successCount = 0;
  let errorCount = 0;

  for (const record of event.Records) {
    try {
      const eventName = record.eventName;
      const dynamodb = record.dynamodb;
      const NewImage = dynamodb?.NewImage;
      const OldImage = dynamodb?.OldImage;
      const Keys = dynamodb?.Keys;

      if (!NewImage && !OldImage && !Keys) {
        logger.warn('Missing image or keys in stream record');
        continue;
      }

      // Publish to EventBridge for further processing
      await publishEvent({
        source: 'dynamodb.stream',
        detailType: 'Stream Record',
        detail: {
          eventName,
          eventSource: 'dynamodb',
          newImage: NewImage,
          oldImage: OldImage,
          keys: Keys,
          timestamp: dynamodb?.ApproximateCreationDateTime,
        },
      });

      successCount++;
    } catch (error) {
      errorCount++;
      logger.error('Error processing stream record', { error });
    }
  }

  metrics.addMetric('StreamRecordsProcessed', MetricUnit.Count, successCount);
  metrics.addMetric('StreamRecordsError', MetricUnit.Count, errorCount);

  logger.info('Stream processing completed', { successCount, errorCount });
};
