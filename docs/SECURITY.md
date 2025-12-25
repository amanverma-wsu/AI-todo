# Security & DevSecOps Guide

## Overview

Comprehensive security practices for the serverless Todo API including secrets management, vulnerability scanning, authentication, and compliance.

## AWS Secrets Manager Integration

### Store Secrets
```bash
# Store API keys
aws secretsmanager create-secret \
  --name todo-api-prod/api-keys \
  --secret-string '{"openai_key":"sk-...","slack_webhook":"https://..."}'

# Store database credentials
aws secretsmanager create-secret \
  --name todo-api-prod/db-credentials \
  --secret-string '{"username":"admin","password":"secure-password"}'
```

### Retrieve Secrets in Lambda
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({});

export async function getSecret(secretName: string): Promise<Record<string, unknown>> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString || '{}');
}

// Usage
const apiKeys = await getSecret('todo-api-prod/api-keys');
const dbCreds = await getSecret('todo-api-prod/db-credentials');
```

### Rotate Secrets
```bash
# Enable automatic rotation
aws secretsmanager rotate-secret \
  --secret-id todo-api-prod/api-keys \
  --rotation-rules AutomaticallyAfterDays=30
```

## IAM & Least Privilege

### Lambda Execution Role
```typescript
const lambdaRole = new iam.Role(this, 'LambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
});

// Only grant necessary permissions
todosTable.grantReadWriteData(lambdaRole); // Specific to table
lambdaRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'], // Specific action
    resources: ['arn:aws:bedrock:*:*:foundation-model/anthropic.claude-3-sonnet*'],
    effect: iam.Effect.ALLOW,
  })
);
```

### Resource-Based Policies
```bash
# Restrict API Gateway access
aws apigateway update-stage \
  --rest-api-id abc123 \
  --stage-name prod \
  --patch-operations \
    op=replace,path=/accessLogSettings/resourceArn,value=arn:aws:logs:region:account:log-group:name
```

## OWASP Dependency Management

### Automated Vulnerability Scanning
```bash
# Run npm audit
npm audit --audit-level=moderate

# Fix vulnerabilities
npm audit fix

# Generate audit report
npm audit --json > audit-report.json
```

### GitHub Dependabot
Add to `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'daily'
    open-pull-requests-limit: 10
    reviewers:
      - 'security-team'
    allow:
      - dependency-type: 'all'
```

### CI/CD Integration
```yaml
# In GitHub Actions workflow
- name: Run npm audit
  run: npm audit --audit-level=moderate
  
- name: Check for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
```

## Snyk Scanning

### Setup Snyk
```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test --json > snyk-report.json
```

### Snyk in CI/CD
```yaml
- name: Snyk scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: '--severity-threshold=high'
```

## Container Security (Trivy)

### Scan Docker Images
```bash
# Scan local Dockerfile
trivy fs .

# Scan container image
trivy image ghcr.io/myorg/todo-api:latest

# Generate JSON report
trivy image --format json --output trivy-report.json ghcr.io/myorg/todo-api:latest
```

### Fix Vulnerabilities
```bash
# Update base image
# FROM node:22.0 → FROM node:22.1

# Rebuild and rescan
docker build -t ghcr.io/myorg/todo-api:latest .
trivy image ghcr.io/myorg/todo-api:latest
```

## Authentication & Authorization

### AWS Cognito Integration (Recommended for production)
```typescript
// Add Cognito authorizer to API Gateway
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuth', {
  cognitoUserPools: [userPool],
});

api.addRoutes({
  path: '/todos',
  methods: [apigateway.HttpMethod.POST],
  integration: new apigatewayIntegrations.HttpLambdaIntegration('CreateTodo', createTodoLambda),
  authorizer, // Require authentication
});
```

### API Key (Development only)
```typescript
const apiKey = api.addApiKey('ApiKey');
api.grantManagedRuleGroupExecutionRolePermissions(
  apiKey.keyArn,
  new apigateway.PassthroughBehavior()
);
```

### Extract User from Token
```typescript
export const getUserFromRequest = (event: APIGatewayProxyEventV2): string => {
  // From Cognito
  const userId = event.requestContext.authorizer?.claims?.sub;
  if (userId) return userId;

  // From API Key header
  const apiKey = event.headers['x-api-key'];
  return apiKey || 'anonymous';
};
```

## Data Encryption

### Encryption at Rest
```typescript
// DynamoDB encryption
const todosTable = new dynamodb.Table(this, 'TodosTable', {
  encryption: dynamodb.TableEncryption.AWS_MANAGED, // or CUSTOMER_MANAGED
  // ... other config
});
```

### Encryption in Transit
```typescript
// HTTPS enforcement
api.defaultCorsPreflightOptions = {
  allowOrigins: ['https://example.com'], // HTTPS only
  allowMethods: [apigateway.HttpMethod.ANY],
};
```

### API Gateway TLS
```bash
# Enforce TLS 1.2 minimum
aws apigateway update-stage \
  --rest-api-id abc123 \
  --stage-name prod \
  --patch-operations op=replace,path=/minimumTlsVersion,value=TLS_1_2
```

## CloudTrail Audit Logging

### Enable CloudTrail
```bash
# Create CloudTrail trail
aws cloudtrail create-trail \
  --name todo-api-trail \
  --s3-bucket-name my-cloudtrail-bucket

# Start logging
aws cloudtrail start-logging --trail-name todo-api-trail
```

### Query Audit Logs
```bash
# Find all API calls by specific IAM user
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=github-actions \
  --max-items 50
```

## Static Application Security Testing (SAST)

### SonarQube Integration (Optional)
```bash
# Scan with SonarQube
npm install -g sonarqube-scanner

sonar-scanner \
  -Dsonar.projectKey=todo-api \
  -Dsonar.sources=src \
  -Dsonar.host.url=https://sonarqube.example.com \
  -Dsonar.login=$SONAR_TOKEN
```

### CodeQL (GitHub native)
```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v2
  with:
    languages: 'javascript'

- name: Autobuild
  uses: github/codeql-action/autobuild@v2

- name: Perform CodeQL analysis
  uses: github/codeql-action/analyze@v2
```

## Security Headers

### API Response Headers
```typescript
const successResponse = (data: unknown): ApiResponse => {
  return {
    statusCode: 200,
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  };
};
```

## Input Validation & Sanitization

### Request Validation
```typescript
export const validateTodoInput = (body: unknown): body is CreateTodoRequest => {
  if (typeof body !== 'object' || !body) return false;
  
  const todo = body as Record<string, unknown>;
  
  // Title: required, string, max 255 chars
  if (typeof todo.title !== 'string' || todo.title.length > 255) {
    return false;
  }
  
  // Priority: enum
  if (todo.priority && !['low', 'medium', 'high'].includes(todo.priority)) {
    return false;
  }
  
  return true;
};
```

### SQL Injection Prevention (DynamoDB)
```typescript
// Always use parameterized queries - DynamoDB is safe by default
const result = await dynamoDb.send(
  new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId', // Safe
    ExpressionAttributeValues: {
      ':userId': userId, // Properly parameterized
    },
  })
);
```

## Rate Limiting

### API Gateway Rate Limiting
```typescript
const api = new apigateway.HttpApi(this, 'TodoApi', {
  throttleSettings: {
    rateLimit: 10000, // 10,000 requests per second
    burstLimit: 5000,  // 5,000 concurrent requests
  },
});
```

### Lambda Concurrency Limits
```bash
# Set reserved concurrency
aws lambda put-function-concurrency \
  --function-name todo-api-prod-create-todo \
  --reserved-concurrent-executions 100
```

## Compliance & Standards

### HIPAA Compliance (if handling health data)
```typescript
// Enable encryption at rest and in transit
const table = new dynamodb.Table(this, 'TodosTable', {
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: true,
  // ... other HIPAA requirements
});
```

### GDPR Compliance
```typescript
// Data deletion (right to be forgotten)
export async function deleteUserData(userId: string): Promise<void> {
  const todos = await queryUserTodos(userId);
  for (const todo of todos) {
    await deleteItem(userId, todo.todoId);
  }
}

// Data export
export async function exportUserData(userId: string): Promise<string> {
  const todos = await queryUserTodos(userId);
  return JSON.stringify(todos);
}
```

## Security Checklist

- [ ] Enable MFA for AWS console access
- [ ] Use OIDC for GitHub Actions (no hardcoded credentials)
- [ ] Enable S3 bucket encryption and versioning
- [ ] Enable DynamoDB point-in-time recovery
- [ ] Enable CloudTrail logging
- [ ] Rotate secrets regularly
- [ ] Run OWASP dependency checks in CI/CD
- [ ] Scan container images with Trivy
- [ ] Use Snyk for vulnerability scanning
- [ ] Implement WAF rules on API Gateway
- [ ] Enable VPC endpoints for private APIs (if needed)
- [ ] Set up CloudWatch alarms for suspicious activity
- [ ] Document incident response procedures
- [ ] Conduct regular security audits
- [ ] Implement least privilege IAM policies

---

Next: [Deployment & GitOps Guide](./DEPLOYMENT.md)
