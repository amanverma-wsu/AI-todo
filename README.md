# Serverless Todo API with GitOps & AI Integration 🚀

Modern serverless architecture built with AWS Lambda, DynamoDB, and AI-powered features using 2025's latest tech stack.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      API Gateway (HTTP)                 │
│              Cheaper than REST, CORS enabled            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬────────────┐
        │            │            │            │
    ┌───▼──┐    ┌───▼──┐    ┌───▼──┐    ┌───▼──┐
    │Create│    │ List │    │Update│    │Delete│
    │ Todo │    │Todos │    │ Todo │    │ Todo │
    └───┬──┘    └───┬──┘    └───┬──┘    └───┬──┘
        │            │            │            │
        └────────────┼────────────┴────────────┘
                     │
        ┌────────────▼────────────┐
        │   DynamoDB Table        │
        │  • On-demand billing    │
        │  • TTL enabled          │
        │  • Streams enabled      │
        │  • GSI (Status/Category)│
        └───────┬──────┬──────────┘
                │      │
         ┌──────▼──┐   │
         │ Streams │   │
         └──────┬──┘   │
                │      │
        ┌───────▼──────▼────┐
        │   EventBridge     │
        │  Event-driven     │
        │  architecture     │
        └────────┬──────────┘
                 │
        ┌────────▼────────┐
        │  Lambda Funcs   │
        │ • AI Processor  │
        │ • Stream Consumer│
        └─────────────────┘
```

## Key Features

### ✨ Core Capabilities
- **CRUD Operations**: Create, read, update, delete todos with full validation
- **Filtering & Pagination**: Filter by status/category, paginated results
- **Tagging System**: Organize todos with multiple tags
- **TTL Support**: Auto-delete old todos after 1 year

### 🤖 AI Integration (Amazon Bedrock)
- **NLP Task Parsing**: "Remind me to buy groceries tomorrow" → structured task
- **Smart Suggestions**: AI recommends priority, category, and subtasks
- **Auto-Categorization**: ML-powered task categorization
- **Custom Models**: Claude 3 Sonnet (default), Nova, or custom models

### 🔄 Event-Driven Architecture
- **DynamoDB Streams**: Capture all data changes in real-time
- **EventBridge Integration**: Route events to downstream processors
- **Async Processing**: Offload heavy workloads asynchronously
- **Multi-target**: Events can trigger multiple Lambda functions

### 🚀 Deployment & GitOps
- **GitHub Actions**: Complete CI/CD pipeline with automated deployments
- **Multi-environment**: Dev, Staging, Prod with separate AWS accounts
- **GitOps Principles**: Git as single source of truth
- **Canary Deployments**: Gradual rollout with automatic rollback
- **Lambda Aliases**: Control traffic distribution during deployments

### 🔐 Security & Compliance
- **OWASP Dependency Checks**: npm audit in CI/CD
- **Vulnerability Scanning**: Snyk + Trivy for container images
- **AWS Secrets Manager**: Secure credential management
- **RBAC**: Fine-grained IAM permissions per Lambda
- **X-Ray Tracing**: Distributed tracing for security auditing

### 📊 Observability
- **CloudWatch Logs Insights**: Structured logging with PowerTools
- **OpenTelemetry**: Distributed tracing and metrics collection
- **Custom Dashboards**: Pre-built CloudWatch dashboards
- **Alarms & Alerts**: Automated alerts for errors and throttling
- **Optional Prometheus/Grafana**: Enterprise monitoring

### 💰 Cost Optimization
- **Lambda Arm64**: 19% cheaper than x86 (all functions use ARM)
- **On-demand DynamoDB**: Pay only for what you use
- **HTTP APIs**: 60% cheaper than REST APIs
- **1-year TTL**: Auto-cleanup of old todos
- **Connection Reuse**: AWS SDK connection pooling enabled

## Technology Stack

### Backend (Serverless)
- **AWS Lambda** - Node.js 22 with ARM64 architecture
- **DynamoDB** - Fully managed NoSQL with on-demand billing
- **API Gateway** - HTTP APIs (v2) for better performance
- **EventBridge** - Event-driven architecture
- **AWS Bedrock** - AI/ML inference (Claude/Nova)
- **CloudWatch** - Logs, metrics, alarms

### Infrastructure as Code
- **AWS CDK** (TypeScript) - Define infrastructure as code
- **Constructs** - Reusable infrastructure components
- **CloudFormation** - Stack management

### CI/CD & GitOps
- **GitHub Actions** - Workflow automation
- **AWS OIDC** - Secure credential-less authentication
- **Canary Deployments** - Progressive rollout
- **Automated Testing** - Pre-deployment validation

### Monitoring & Observability
- **OpenTelemetry** - Distributed tracing
- **CloudWatch Logs Insights** - Log aggregation
- **Prometheus/Grafana** - Optional time-series metrics
- **X-Ray** - AWS-native distributed tracing

### Development Tools
- **TypeScript** - Type-safe development
- **ESLint** - Code quality
- **Prettier** - Code formatting
- **Jest** - Unit testing
- **aws-lambda-powertools** - Lambda utilities

## Project Structure

```
.
├── infrastructure/          # AWS CDK stacks
│   ├── app.ts             # CDK app entry point
│   └── stack.ts           # Todo API stack definition
├── src/
│   ├── lambdas/           # Lambda function handlers
│   │   ├── create-todo/
│   │   ├── get-todo/
│   │   ├── list-todos/
│   │   ├── update-todo/
│   │   ├── delete-todo/
│   │   ├── ai-task-processor/
│   │   └── stream-consumer/
│   └── layers/            # Lambda layers (shared code)
│       └── shared/nodejs/
│           ├── utils.ts
│           ├── dynamodb-client.ts
│           ├── bedrock-client.ts
│           └── eventbridge-client.ts
├── .github/workflows/      # GitHub Actions
│   ├── ci.yml            # CI pipeline
│   ├── deploy.yml        # CD/deployment pipeline
│   └── observability.yml # Observability setup
├── tests/                 # Jest test files
├── package.json
├── tsconfig.json
└── README.md
```

## Setup & Deployment

### Prerequisites
```bash
# Node.js 22.x
node --version

# AWS CLI v2 with credentials configured
aws configure

# AWS CDK
npm install -g aws-cdk
```

### Local Development
```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Run tests
npm run test:coverage

# Build TypeScript
npm run build

# View infrastructure changes
npm run diff -- --context environment=dev
```

### Deploy to AWS

#### Development Environment
```bash
npm run deploy:dev
```

#### Staging Environment
```bash
npm run deploy:staging
```

#### Production Environment
```bash
npm run deploy:prod
```

### Deploy via GitHub Actions
Just push to the repository:
- `develop` branch → Deploy to Dev
- `main` branch → Deploy to Prod (with approval)

## API Endpoints

### Create Todo
```bash
POST /todos
Content-Type: application/json

{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "priority": "high",
  "dueDate": "2025-12-25",
  "tags": ["shopping", "urgent"],
  "generateSuggestions": true
}
```

### List Todos
```bash
GET /todos?status=pending&limit=20
```

### Get Todo
```bash
GET /todos/{todoId}
```

### Update Todo
```bash
PUT /todos/{todoId}
Content-Type: application/json

{
  "status": "completed",
  "priority": "low"
}
```

### Delete Todo
```bash
DELETE /todos/{todoId}
```

### AI Task Processing
```bash
POST /todos/ai/suggest
Content-Type: application/json

{
  "task": "Remind me to prepare presentation for tomorrow meeting",
  "mode": "parse"
}
```

## AI Features

### Natural Language Task Creation
```bash
# Input
"Remind me to buy groceries tomorrow and pay bills"

# AI Processing
{
  "title": "Buy groceries",
  "description": "Buy groceries and pay bills",
  "category": "Shopping",
  "priority": "medium",
  "dueDate": "2025-12-24"
}
```

### Smart Task Suggestions
```bash
# System analyzes task and suggests:
{
  "category": "Work",
  "priority": "high",
  "subtasks": [
    "Research topic",
    "Create slides",
    "Practice presentation"
  ],
  "estimatedTime": "3 hours"
}
```

## Event-Driven Workflows

### Todo Creation Flow
```
1. POST /todos
2. CreateTodo Lambda → DynamoDB
3. DynamoDB Stream → EventBridge
4. "Todo Created" Event
5. AI Processor: Generate suggestions
6. Stream Consumer: Log/metrics
```

### Update Flow
```
1. PUT /todos/{id}
2. UpdateTodo Lambda → DynamoDB
3. DynamoDB Stream triggers
4. Stream → EventBridge
5. Downstream processing (async)
```

## Monitoring & Observability

### CloudWatch Dashboard
```
Metrics:
- Lambda Invocations & Errors
- DynamoDB RCUs & WCUs
- API latency & errors
- Bedrock invocation count
- EventBridge events processed
```

### Log Insights Queries
```
# Find errors in last hour
fields @timestamp, @message
| filter @message like /Error/
| stats count() by @message

# Lambda cold start analysis
fields @initDuration
| filter @initDuration > 0
| stats avg(@initDuration), max(@initDuration)

# DynamoDB performance
fields @duration, @key
| filter @duration > 100
| stats avg(@duration) by @key
```

### Alarms
- Lambda error rate > 1%
- DynamoDB throttling
- API latency > 5s
- EventBridge failed events

## Security Best Practices

1. **Authentication**: Use AWS Cognito or API keys (add before prod)
2. **Authorization**: Fine-grained IAM roles per Lambda
3. **Secrets**: Store API keys in AWS Secrets Manager
4. **HTTPS**: API Gateway enforces HTTPS
5. **CORS**: Configured per environment
6. **Encryption**: DynamoDB encryption at rest
7. **Audit Logging**: CloudTrail enabled for all API calls
8. **Dependency Management**: Regular updates via Dependabot

## Cost Estimation (Monthly, US East)

| Service | Estimate | Notes |
|---------|----------|-------|
| Lambda | $1-5 | 1M free requests/month + free tier |
| DynamoDB | $5-10 | On-demand billing, per million RU/WU |
| API Gateway | $0.50-2 | $0.30/million HTTP requests |
| Bedrock | $3-20 | Claude 3 Sonnet at scale |
| CloudWatch | $0-5 | Logs retention, dashboards |
| **Total** | **~$10-40** | Scales with usage |

## Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Write tests for new functionality
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## CI/CD Checks
- ✅ Linting (ESLint)
- ✅ Formatting (Prettier)
- ✅ Unit tests (Jest, 80%+ coverage)
- ✅ Dependency audit (npm audit)
- ✅ Security scan (Snyk)
- ✅ Container scan (Trivy)
- ✅ CDK synthesis
- ✅ Infrastructure preview (PRs)

## Troubleshooting

### Lambda cold starts
- Increase memory allocation
- Use Provisioned Concurrency for critical endpoints
- Check initialization code

### DynamoDB throttling
- Increase on-demand capacity
- Add DynamoDB auto-scaling
- Optimize queries to reduce RCU

### Bedrock rate limits
- Implement exponential backoff
- Add queue with SQS for processing
- Request higher limits from AWS

### Deployment failures
- Check CloudFormation events: `aws cloudformation describe-stack-events`
- Review Lambda logs: `aws logs tail /aws/lambda/todo-api-prod`
- Run CDK diff to preview changes

## Resources

- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/latest/developerguide/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/)
- [EventBridge Patterns](https://serverlessland.com/eventbridge)
- [Amazon Bedrock API](https://docs.aws.amazon.com/bedrock/latest/userguide/)
- [OpenTelemetry](https://opentelemetry.io/)

## License

MIT License - see LICENSE file for details

---

Built with ❤️ for modern serverless applications in 2025
