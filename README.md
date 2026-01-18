# Serverless Todo API with AI Integration

Serverless todo application built with AWS Lambda, DynamoDB, and Amazon Bedrock for AI features.

## Features

- CRUD operations for todos with validation
- Filtering by status/category with pagination
- AI-powered task parsing and suggestions (Amazon Bedrock)
- Event-driven architecture with DynamoDB Streams and EventBridge
- Auto-delete old todos with TTL

## Tech Stack

- **Runtime**: AWS Lambda (Node.js 22, ARM64)
- **Database**: DynamoDB (on-demand)
- **API**: API Gateway HTTP APIs
- **AI**: Amazon Bedrock (Claude 3 Sonnet)
- **IaC**: AWS CDK (TypeScript)
- **CI/CD**: GitHub Actions

## Project Structure

```
infrastructure/     # AWS CDK stacks
src/
  lambdas/          # Lambda handlers (create, get, list, update, delete, ai-processor, stream-consumer)
  layers/shared/    # Shared code (DynamoDB, Bedrock, EventBridge clients)
tests/              # Jest tests
```

## Setup

```bash
npm install
npm run build
npm run deploy:dev    # Deploy to dev
npm run deploy:prod   # Deploy to production
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /todos | Create todo |
| GET | /todos | List todos |
| GET | /todos/{id} | Get todo |
| PUT | /todos/{id} | Update todo |
| DELETE | /todos/{id} | Delete todo |
| POST | /todos/ai/suggest | AI task processing |
