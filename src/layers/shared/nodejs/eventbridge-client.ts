import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';

const eventBridgeClient = new EventBridgeClient({});

export interface TodoEvent {
  source: string;
  detailType: string;
  detail: Record<string, unknown>;
  busName?: string;
}

export const publishEvent = async (event: TodoEvent): Promise<void> => {
  const entry: PutEventsRequestEntry = {
    Source: event.source,
    DetailType: event.detailType,
    Detail: JSON.stringify(event.detail),
    EventBusName: event.busName || 'default',
  };

  const command = new PutEventsCommand({
    Entries: [entry],
  });

  try {
    const result = await eventBridgeClient.send(command);
    if (result.FailedEntryCount && result.FailedEntryCount > 0) {
      console.error('Failed to publish event:', result.Entries);
      throw new Error('Failed to publish event to EventBridge');
    }
  } catch (error) {
    console.error('EventBridge publish error:', error);
    throw error;
  }
};

export const publishTodoEvent = async (
  detailType: 'Todo Created' | 'Todo Updated' | 'Todo Deleted' | 'Todo Completed',
  detail: Record<string, unknown>,
  busName?: string
): Promise<void> => {
  await publishEvent({
    source: 'todo.api',
    detailType,
    detail,
    busName,
  });
};
