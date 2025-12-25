import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

const logger = new Logger({ serviceName: 'todo-api' });
const tracer = new Tracer({ serviceName: 'todo-api' });
const metrics = new Metrics();

/**
 * Wrapper for tracing async functions with Powertools v2
 * @param name - Segment/subsegment name for tracing
 * @param fn - Async function to trace
 */
export const captureAsync = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const segment = tracer.getSegment();
  if (!segment) {
    // If no active segment (e.g., in tests), just run the function
    return fn();
  }
  const subsegment = segment.addNewSubsegment(name);
  tracer.setSegment(subsegment);
  try {
    const result = await fn();
    subsegment.close();
    tracer.setSegment(segment);
    return result;
  } catch (error) {
    subsegment.addError(error as Error);
    subsegment.close();
    tracer.setSegment(segment);
    throw error;
  }
};

export interface ApiResponse<T = unknown> {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

export interface TodoItem {
  userId: string;
  todoId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: string;
  tags?: string[];
  aiSuggestion?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: number;
}

export const successResponse = <T>(data: T, statusCode = 200): ApiResponse<T> => {
  metrics.addMetric('SuccessResponse', MetricUnit.Count, 1);
  return {
    statusCode,
    body: JSON.stringify({ success: true, data }),
    headers: { 'Content-Type': 'application/json' },
  };
};

export const errorResponse = (error: Error | string, statusCode = 500): ApiResponse<never> => {
  const message = error instanceof Error ? error.message : error;
  logger.error('API Error', { error: message, statusCode });
  metrics.addMetric('ErrorResponse', MetricUnit.Count, 1);

  return {
    statusCode,
    body: JSON.stringify({ success: false, error: message }),
    headers: { 'Content-Type': 'application/json' },
  };
};

export const validateEvent = (event: Record<string, unknown>, requiredFields: string[]): boolean => {
  for (const field of requiredFields) {
    if (!event[field]) {
      logger.warn(`Missing required field: ${field}`);
      return false;
    }
  }
  return true;
};

export { logger, tracer, metrics, MetricUnit };
