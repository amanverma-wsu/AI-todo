# Observability & Monitoring Guide

## Overview

This guide covers distributed tracing, logging, metrics, and alarms for the Todo API.

## OpenTelemetry Setup

### Automatic Instrumentation

The Lambda Layer includes OpenTelemetry with auto-instrumentation:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const traceExporter = new OTLPTraceExporter({
  url: 'https://otel-collector.example.com/v1/traces',
});

const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

### CloudWatch Logs Insights

#### Query 1: Lambda Performance Analysis
```
fields @timestamp, @duration, @memory, @maxMemoryUsed, @initDuration
| filter @type = "REPORT"
| stats avg(@duration) as avg_duration, max(@duration) as max_duration, 
        avg(@memory) as avg_memory, max(@maxMemoryUsed) as peak_memory by bin(5m)
```

#### Query 2: Error Analysis
```
fields @timestamp, @message, @logStream, @errorCode
| filter @message like /Error|Exception|failed/
| stats count() as error_count by @errorCode, @logStream
| sort error_count desc
```

#### Query 3: API Latency Distribution
```
fields @timestamp, @duration, httpMethod, httpPath, statusCode
| filter ispresent(@duration)
| stats pct(@duration, 50) as p50, pct(@duration, 90) as p90, 
        pct(@duration, 99) as p99 by httpMethod, httpPath
```

#### Query 4: Cold Start Detection
```
fields @timestamp, @initDuration, @duration, @logStream
| filter ispresent(@initDuration)
| stats count() as cold_starts, avg(@initDuration) as avg_init_time by bin(1h)
```

## X-Ray Tracing

### Enable X-Ray in Lambda

```bash
aws lambda update-function-configuration \
  --function-name todo-api-prod-create-todo \
  --tracing-config Mode=Active
```

### View Traces
```bash
# Get service map
aws xray get-service-graph

# Get traces
aws xray get-trace-summaries --start-time 2025-01-01T00:00:00Z --end-time 2025-01-01T01:00:00Z
```

## CloudWatch Dashboards

### Create Custom Dashboard
```bash
aws cloudwatch put-dashboard \
  --dashboard-name TodoAPIDashboard \
  --dashboard-body file://observability/dashboard.json
```

### Key Metrics to Monitor
1. **Lambda Metrics**
   - Duration
   - Errors
   - Throttles
   - Concurrent Executions

2. **DynamoDB Metrics**
   - Consumed Read/Write Capacity
   - User Errors
   - System Errors
   - Latency

3. **API Gateway Metrics**
   - Request Count
   - 4XX/5XX Errors
   - Latency (p50, p90, p99)

4. **Bedrock Metrics**
   - Invocation Count
   - Error Rate
   - Latency

## Alarms & Notifications

### Lambda Error Alarm
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name todo-api-lambda-errors \
  --alarm-description "Alert when Lambda errors exceed 5 in 5 minutes" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:alerts
```

### DynamoDB Throttling Alarm
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name todo-api-dynamodb-throttle \
  --alarm-description "Alert on DynamoDB write throttling" \
  --metric-name ConsumedWriteCapacityUnits \
  --namespace AWS/DynamoDB \
  --table-name todo-api-prod-todos \
  --statistic Sum \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:alerts
```

### API Latency Alarm
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name todo-api-latency-high \
  --alarm-description "Alert when API latency exceeds 1 second" \
  --metric-name Latency \
  --namespace AWS/ApiGateway \
  --statistic Average \
  --period 300 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:alerts
```

## Prometheus + Grafana (Optional)

### Export Metrics to Prometheus
```typescript
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const prometheusExporter = new PrometheusExporter(
  { port: 8888 },
  () => {
    console.log('Prometheus metrics available at http://localhost:8888/metrics');
  }
);
```

### Grafana Dashboard
1. Add CloudWatch data source
2. Import dashboard JSON from `observability/grafana-dashboard.json`
3. Configure alert notifications

## Cost Optimization

### Log Retention
```bash
# Set retention to 7 days
aws logs put-retention-policy \
  --log-group-name /aws/lambda/todo-api-prod-create-todo \
  --retention-in-days 7
```

### Sampling
Enable CloudWatch Logs sampling to reduce costs:
```typescript
logger.info('Message', { samplingRate: 0.1 }); // Log 10% of messages
```

### Metric Filters
Create metric filters to avoid high-cardinality metrics:
```bash
aws logs put-metric-filter \
  --log-group-name /aws/lambda/todo-api-prod \
  --filter-name error-count \
  --filter-pattern "[time, request_id, level = ERROR*, ...]" \
  --metric-transformations metricName=ErrorCount,metricValue=1
```

## Debugging

### View Lambda Logs
```bash
# Real-time tail
aws logs tail /aws/lambda/todo-api-prod-create-todo --follow

# Last 100 lines
aws logs tail /aws/lambda/todo-api-prod-create-todo --max-items 100

# With grep filter
aws logs tail /aws/lambda/todo-api-prod-create-todo --grep "ERROR"
```

### Get Lambda Metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=todo-api-prod-create-todo \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T01:00:00Z \
  --period 300 \
  --statistics Average,Maximum,Minimum
```

### Lambda Insights (Optional)
```bash
# Enable Lambda Insights
aws lambda update-function-configuration \
  --function-name todo-api-prod-create-todo \
  --layers arn:aws:lambda:us-east-1:580254703988:layer:LambdaInsightsExtension-Arm64:11
```

## Performance Optimization

### Lambda Memory Tuning
```bash
# Find optimal memory allocation
aws lambda invoke \
  --function-name todo-api-prod-create-todo \
  --payload file://test-payload.json \
  --log-type Tail \
  response.json | jq '.LogResult' | base64 -d | grep MaxMemoryUsed
```

### DynamoDB Query Optimization
```
# Monitor consumed capacity
fields @timestamp, consumedWriteCapacityUnits
| stats avg(consumedWriteCapacityUnits) as avg_wcus, 
        max(consumedWriteCapacityUnits) as peak_wcus
| sort peak_wcus desc
```

## SLA Metrics

### Define SLIs (Service Level Indicators)
- **Availability**: (Total Requests - Errors) / Total Requests > 99.9%
- **Latency**: p99 latency < 1 second
- **Error Rate**: Error rate < 0.1%

### Define SLOs (Service Level Objectives)
- **Availability**: 99.9% uptime (8.76 hours downtime/month)
- **Latency**: p99 < 500ms
- **Throughput**: Support 1000 requests/second

## Incident Response

### Create Runbook Template
```markdown
## Incident: High Error Rate

### Detection
- CloudWatch Alarm: todo-api-lambda-errors
- Alert Time: 2025-01-01 10:00:00 UTC

### Investigation
1. Check Lambda logs for error patterns
2. Review DynamoDB metrics for throttling
3. Check recent deployments

### Resolution
1. Roll back to previous version if needed
2. Scale DynamoDB capacity
3. Clear Lambda concurrent execution limit

### Post-Incident
1. Update runbook
2. Schedule postmortem
3. Implement preventive measures
```

---

Next: [Security & DevSecOps Guide](./SECURITY.md)
