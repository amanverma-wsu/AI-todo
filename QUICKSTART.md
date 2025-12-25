# Quick Start Guide

## Project Summary

A production-ready **Serverless Todo API** built with the latest 2025 tech stack, featuring:
- ✅ AWS Lambda (Node.js 22, ARM64) + DynamoDB + API Gateway
- ✅ Amazon Bedrock AI integration for smart task management
- ✅ Event-driven architecture with EventBridge & DynamoDB Streams
- ✅ GitHub Actions CI/CD with GitOps principles
- ✅ Multi-environment setup (Dev/Staging/Prod)
- ✅ Enterprise-grade observability & security

## 5-Minute Setup

### 1. Prerequisites
```bash
# Node 22.x
node --version

# AWS CLI
aws --version

# AWS credentials
aws configure
```

### 2. Install & Build
```bash
cd /Users/aman/Devops\ proj

npm install
npm run build
```

### 3. Deploy to AWS
```bash
# Development environment
npm run deploy:dev

# Production environment
npm run deploy:prod
```

### 4. Test the API
```bash
# Get API endpoint
API_URL=$(aws cloudformation describe-stacks \
  --stack-name todo-api-dev-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text)

# Create todo
curl -X POST $API_URL/todos \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries",
    "priority": "high",
    "generateSuggestions": true
  }'

# List todos
curl $API_URL/todos
```

## Project Structure

```
.
├── infrastructure/              # AWS CDK (IaC)
│   ├── app.ts                 # Stack entry point
│   └── stack.ts               # Complete infrastructure
│
├── src/
│   ├── lambdas/               # 7 Lambda functions
│   │   ├── create-todo/       # POST /todos
│   │   ├── get-todo/          # GET /todos/{id}
│   │   ├── list-todos/        # GET /todos
│   │   ├── update-todo/       # PUT /todos/{id}
│   │   ├── delete-todo/       # DELETE /todos/{id}
│   │   ├── ai-task-processor/ # AI suggestions
│   │   └── stream-consumer/   # Event processing
│   │
│   └── layers/                # Shared code layer
│       └── shared/nodejs/
│           ├── utils.ts
│           ├── dynamodb-client.ts
│           ├── bedrock-client.ts
│           └── eventbridge-client.ts
│
├── .github/workflows/          # CI/CD Pipelines
│   ├── ci.yml                 # Lint, test, build
│   ├── deploy.yml             # Deploy + canary
│   └── observability.yml      # Dashboards
│
├── docs/                       # Comprehensive guides
│   ├── OBSERVABILITY.md       # Logging & monitoring
│   ├── SECURITY.md            # DevSecOps & secrets
│   ├── DEPLOYMENT.md          # GitOps & releases
│   └── AI.md                  # Bedrock integration
│
├── tests/                      # Jest unit tests
├── observability/             # CloudWatch dashboard
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── jest.config.js             # Test config
├── .eslintrc.json             # Linting rules
├── Dockerfile                 # Container image
└── README.md                  # Full documentation
```

## Key Features Explained

### API Endpoints
```bash
# CREATE todo with AI suggestions
POST /todos
{
  "title": "Buy groceries",
  "priority": "high",
  "generateSuggestions": true
}
→ Returns: Todo with AI-generated suggestions

# LIST todos with filtering
GET /todos?status=pending&category=Shopping&limit=20
→ Returns: Paginated list

# GET single todo
GET /todos/{todoId}
→ Returns: Complete todo with metadata

# UPDATE todo
PUT /todos/{todoId}
{
  "status": "completed",
  "priority": "low"
}

# DELETE todo
DELETE /todos/{todoId}

# AI PROCESSING (NLP)
POST /todos/ai/suggest
{
  "task": "Remind me to call John tomorrow at 2 PM",
  "mode": "parse"
}
→ Returns: Structured task from natural language
```

### Event-Driven Flow
```
User POST /todos
    ↓
CreateTodo Lambda
    ↓
Save to DynamoDB
    ↓
DynamoDB Stream
    ↓
EventBridge (automatic)
    ↓
Two paths:
1. AI Processor Lambda → Generate suggestions → Update DB
2. Stream Consumer Lambda → Log metrics → Archive
```

### AI Features
1. **NLP Parsing**: "Remind me..." → Structured task
2. **Smart Suggestions**: Category, priority, subtasks
3. **Auto-categorization**: ML assigns category
4. **Priority Assessment**: Urgency-based scoring
5. **Task Summaries**: Overview of all todos
6. **Productivity Insights**: Work pattern analysis

## Git Repository Structure

### Branches
- `develop` → Auto-deploys to Dev after merge
- `main` → Requires approval, deploys to Prod
- `feature/*` → Create PRs for review

### Example Workflow
```bash
# Create feature
git checkout -b feature/ai-suggestions

# Make changes, commit
git commit -m "Add AI task suggestions"

# Push and create PR
git push origin feature/ai-suggestions

# PR triggers:
# ✅ Linting (ESLint)
# ✅ Tests (Jest)
# ✅ Security (Snyk, Trivy)
# ✅ Build (CDK)
# ✅ CDK Diff preview

# After approval, merge
git merge feature/ai-suggestions

# Auto-deploys to Dev environment
```

## Configuration

### Environment Variables
```bash
cp .env.example .env

# Edit .env with your values
ENVIRONMENT=dev
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
```

### GitHub Secrets (for CI/CD)
Set in GitHub repository settings:
```
AWS_ROLE_DEV=arn:aws:iam::123456789012:role/GitHubActionsRole
AWS_ROLE_PROD=arn:aws:iam::123456789014:role/GitHubActionsRole
SNYK_TOKEN=your-snyk-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

### AWS Bedrock Setup
```bash
# Enable Bedrock in your region
aws bedrock list-foundation-models --region us-east-1

# Request model access (if not available)
# Takes ~5 minutes to enable
```

## Development Workflow

### Local Testing
```bash
# Build Lambda layer
npm run build

# Run unit tests
npm run test

# Run linter
npm run lint

# Preview infrastructure changes
npm run diff -- --context environment=dev
```

### Local Lambda Execution
```bash
# Use SAM for local execution
npm install -g aws-sam-cli

sam local start-api --template lib/stack.json
curl http://localhost:3000/todos
```

## Monitoring & Observability

### CloudWatch Dashboards
```bash
# View dashboard in AWS Console
aws cloudwatch get-dashboard --dashboard-name TodoAPIDashboard
```

### Log Insights Queries
```bash
# Lambda performance
fields @duration, @memory, @maxMemoryUsed
| stats avg(@duration), max(@memory)

# Error analysis
fields @message, @errorCode
| filter @message like /Error/
| stats count() by @errorCode
```

### Alarms
Automatically configured for:
- Lambda error rate
- DynamoDB throttling
- API latency
- Bedrock failures

## Cost Estimation

| Service | Dev/Month | Prod/Month |
|---------|-----------|-----------|
| Lambda | $0.20 | $1-5 |
| DynamoDB | $1-2 | $5-10 |
| API Gateway | $0.10 | $0.50-2 |
| Bedrock | $1-3 | $5-20 |
| **Total** | **$2-6** | **$12-37** |

Free tier covers: 1M Lambda requests, 25GB storage, daily backups

## Troubleshooting

### Lambda Cold Starts
```bash
# Check initialization time
aws logs tail /aws/lambda/todo-api-dev-create-todo --grep "@initDuration"

# Solution: Increase memory allocation or use provisioned concurrency
```

### DynamoDB Throttling
```bash
# Check consumed capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --table-name todo-api-dev-todos

# Solution: Already on on-demand billing, so auto-scales
```

### Bedrock Errors
```bash
# Check available models
aws bedrock list-foundation-models --region us-east-1

# Check rate limits
aws bedrock get-foundation-model-availability-in-region \
  --model-identifier anthropic.claude-3-sonnet-20240229-v1:0 \
  --region us-east-1
```

## Next Steps

1. **Setup GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial serverless todo API"
   git remote add origin https://github.com/yourusername/todo-api
   git push -u origin main
   ```

2. **Configure GitHub Actions**
   - Add AWS OIDC secrets
   - Enable branch protection for main
   - Set up Slack notifications

3. **Deploy to AWS**
   ```bash
   npm run deploy:dev
   npm run deploy:staging
   npm run deploy:prod
   ```

4. **Setup Monitoring**
   - Configure CloudWatch alarms
   - Create Grafana dashboards
   - Enable X-Ray tracing

5. **Add Authentication**
   - Configure AWS Cognito
   - Add API Gateway authorizer
   - Implement JWT validation

## Documentation

- [Full README](./README.md) - Complete guide
- [Observability](./docs/OBSERVABILITY.md) - Logging & metrics
- [Security](./docs/SECURITY.md) - DevSecOps & compliance
- [Deployment](./docs/DEPLOYMENT.md) - GitOps & releases
- [AI Integration](./docs/AI.md) - Bedrock features

## Support & Resources

- [AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/)
- [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [OpenTelemetry](https://opentelemetry.io/)

---

**Built with modern DevOps best practices for 2025** 🚀

Start deploying: `npm run deploy:dev`
