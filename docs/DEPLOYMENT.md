# Deployment & GitOps Guide

## Overview

Complete guide to deploying the Todo API across Dev, Staging, and Production environments using GitOps principles.

## GitOps Principles

### Single Source of Truth
- Git repository is the single source of truth
- All changes go through pull requests
- Code review required before deployment
- Infrastructure defined as code (IaC)

### Infrastructure as Code (IaC)
```typescript
// Everything defined in CDK - git versioned
const table = new dynamodb.Table(this, 'TodosTable', {
  tableName: `todo-api-${env}-todos`,
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  // ... fully auditable configuration
});
```

### Automated Deployments
```yaml
# Triggered by git push
on:
  push:
    branches:
      - main      # Deploy to Prod
      - develop   # Deploy to Dev
```

## Multi-Environment Setup

### Environment Structure

```
AWS Account: DEV (123456789012)
└── Region: us-east-1
    └── todo-api-dev-stack
        ├── Lambda functions (dev)
        ├── DynamoDB (dev)
        └── API Gateway (dev)

AWS Account: STAGING (123456789013)
└── Region: us-east-1
    └── todo-api-staging-stack
        ├── Lambda functions (staging)
        ├── DynamoDB (staging)
        └── API Gateway (staging)

AWS Account: PROD (123456789014)
└── Region: us-east-1
    └── todo-api-prod-stack
        ├── Lambda functions (prod)
        ├── DynamoDB (prod)
        └── API Gateway (prod)
```

### Environment Variables
```bash
# .env.dev
ENVIRONMENT=dev
TABLE_NAME=todo-api-dev-todos
LOG_LEVEL=DEBUG

# .env.staging
ENVIRONMENT=staging
TABLE_NAME=todo-api-staging-todos
LOG_LEVEL=INFO

# .env.prod
ENVIRONMENT=prod
TABLE_NAME=todo-api-prod-todos
LOG_LEVEL=WARN
```

## AWS OIDC Configuration

### Setup GitHub OIDC Trust
```bash
# Create IAM role for GitHub Actions
aws iam create-role \
  --role-name GitHubActionsRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": "repo:myorg/todo-api:ref:refs/heads/main"
          }
        }
      }
    ]
  }'

# Add CDK deployment policy
aws iam attach-role-policy \
  --role-name GitHubActionsRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### GitHub OIDC in Actions
```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::ACCOUNT:role/GitHubActionsRole
    aws-region: us-east-1
    role-session-name: github-actions
```

## Local Development Deployment

### Deploy to Dev
```bash
# Install dependencies
npm install

# Build infrastructure
npm run build

# Preview changes
npm run diff -- --context environment=dev

# Deploy
npm run deploy:dev
```

### SAM Local Testing
```bash
# Start local API
sam local start-api --template lib/stack.json

# Test endpoint
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","priority":"high"}'
```

## Automated Deployment Pipeline

### CI Pipeline (GitHub Actions)

```
1. Lint & Format
   └─ ESLint
   └─ Prettier
   
2. Security Scanning
   └─ npm audit
   └─ Snyk
   └─ Trivy
   
3. Tests
   └─ Unit tests
   └─ Coverage report
   
4. Build
   └─ TypeScript compilation
   └─ CDK synthesis
   
5. Preview (PRs only)
   └─ CDK diff
   └─ Comment on PR
```

### CD Pipeline (GitHub Actions)

```
Main Branch (Prod)        Develop Branch (Dev)
      │                          │
      ├─ Approval Gate           │
      │                          │
      ├─ Deploy Infrastructure   ├─ Deploy Infrastructure
      │                          │
      ├─ Lambda Deployment       ├─ Lambda Deployment
      │                          │
      ├─ Canary Tests            └─ Smoke Tests
      │
      ├─ Monitor (5 mins)
      │
      └─ Automated Rollback (if issues)
```

### Deploy from Git
```bash
# Development: Just push to develop
git push origin feature/amazing-feature
# → Auto-deploys to dev after merge

# Staging: Create release branch
git checkout -b release/v1.2.0
git push origin release/v1.2.0
# → Manually trigger staging deployment

# Production: Merge to main
git checkout main
git merge release/v1.2.0
git push origin main
# → Requires approval, deploys to prod
```

## Progressive Deployment

### Canary Deployment Strategy
```typescript
// Lambda alias for traffic shifting
const liveAlias = new lambda.Alias(this, 'LiveAlias', {
  aliasName: 'live',
  version: currentVersion,
  routingConfig: {
    additionalVersionWeight: 0.1, // 10% to new version
    additionalVersion: newVersion,
  },
});
```

### Blue-Green Deployment
```bash
# Blue environment (current)
api-blue.example.com → Production

# Green environment (new)
api-green.example.com → Testing

# After validation, switch traffic
aws apigateway update-base-path-mapping \
  --domain-name api.example.com \
  --base-path-mapping-id abc123 \
  --stage-name green
```

## Rollback Strategies

### Automatic Rollback on Error
```yaml
- name: Automatic Rollback
  if: failure()
  run: |
    aws cloudformation cancel-update-stack \
      --stack-name todo-api-prod-stack
```

### Manual Rollback
```bash
# Get previous stack version
aws cloudformation describe-stack-resources \
  --stack-name todo-api-prod-stack

# Rollback to previous version
aws cloudformation update-stack \
  --stack-name todo-api-prod-stack \
  --use-previous-template

# Or delete failed update and retry
aws cloudformation continue-update-rollback \
  --stack-name todo-api-prod-stack
```

## Database Migrations

### DynamoDB Schema Changes
```typescript
// Add new GSI
todosTable.addGlobalSecondaryIndex({
  indexName: 'PriorityIndex',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'priority', type: dynamodb.AttributeType.STRING },
});

// Deploy with CDK
npm run deploy:prod
// → Automatically creates new GSI without downtime
```

### Data Backfill
```typescript
// Lambda function for backfill
export const handler = async (): Promise<void> => {
  const todos = await scanAllTodos();
  for (const todo of todos) {
    // Add new field
    todo.aiSuggestion = await generateSuggestion(todo.title);
    await updateTodo(todo);
  }
};

// Execute after deployment
aws lambda invoke \
  --function-name todo-api-prod-backfill \
  response.json
```

## Monitoring Deployments

### Deployment Health Checks
```bash
# Check stack events
aws cloudformation describe-stack-events \
  --stack-name todo-api-prod-stack \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`]'

# Check Lambda functions
aws lambda list-functions \
  --query 'Functions[?Runtime==`nodejs22.x`]'

# Monitor API
curl -X GET https://api.example.com/health
```

### Metrics During Deployment
```bash
# Lambda error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Release Management

### Semantic Versioning
```bash
# Create release
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin v1.2.0

# Trigger automated deployment
# → GitHub Actions sees tag and deploys
```

### Release Notes
Create `CHANGELOG.md`:
```markdown
## [1.2.0] - 2025-01-15

### Added
- AI-powered task suggestions
- New category filtering
- Performance optimizations

### Fixed
- DynamoDB throttling issues
- API latency spikes

### Breaking Changes
- Removed deprecated `/v1/` endpoints
```

## Cost Management

### Environment-Specific Costs
```bash
# Get cost per environment
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=ENVIRONMENT
```

### Cost Alerts
```bash
# Alert on spending
aws budgets create-budget \
  --account-id 123456789012 \
  --budget BudgetName=todo-api-monthly,BudgetLimit=Value=100,Unit=USD,TimeUnit=MONTHLY
```

## Disaster Recovery

### Backup Strategy
```bash
# DynamoDB backup
aws dynamodb create-backup \
  --table-name todo-api-prod-todos \
  --backup-name todo-api-prod-$(date +%Y%m%d)

# List backups
aws dynamodb list-backups --table-name todo-api-prod-todos
```

### Recovery Time Objective (RTO)
- **Dev**: 1 hour (low priority)
- **Staging**: 4 hours (medium priority)
- **Prod**: 15 minutes (critical)

### Recovery Point Objective (RPO)
- **Dev**: 24 hours (daily backups)
- **Staging**: 6 hours (6-hourly backups)
- **Prod**: 1 hour (hourly backups)

## Deployment Checklist

- [ ] All tests passing
- [ ] Code review approved
- [ ] Security scanning passed
- [ ] No critical vulnerabilities
- [ ] Changelog updated
- [ ] Documentation updated
- [ ] Database migrations ready
- [ ] Feature flags configured
- [ ] Monitoring/alarms in place
- [ ] Team notified of deployment
- [ ] Rollback procedure documented
- [ ] Post-deployment validation plan

---

Next: [AI Integration Guide](./AI.md)
