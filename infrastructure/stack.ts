import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface TodoStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
}

export class TodoApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TodoStackProps) {
    super(scope, id, props);

    const env = props.environment;
    const stackNamePrefix = `todo-api-${env}`;

    // ============================================
    // 1. DynamoDB Table with Streams
    // ============================================
    const todosTable = new dynamodb.Table(this, 'TodosTable', {
      tableName: `${stackNamePrefix}-todos`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'todoId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand billing
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: env === 'prod',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt',
    });

    // Global Secondary Indexes for common queries
    todosTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    todosTable.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'category', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ============================================
    // 2. Lambda Layer for Shared Code
    // ============================================
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('lib/layers/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'Shared utilities and dependencies',
    });

    // ============================================
    // 3. Lambda Execution Role with Permissions
    // ============================================
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for Todo API Lambda functions',
    });

    // DynamoDB permissions
    todosTable.grantReadWriteData(lambdaRole);
    todosTable.grantStreamRead(lambdaRole);

    // CloudWatch Logs
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'));

    // Bedrock access for AI features
    lambdaRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          'arn:aws:bedrock:*:*:foundation-model/*',
          'arn:aws:bedrock:*:*:inference-profile/*',
          'arn:aws:bedrock:*::foundation-model/*',
        ],
      })
    );

    // EventBridge put events
    lambdaRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: ['*'],
      })
    );

    // X-Ray write access for distributed tracing
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));

    // Secrets Manager access
    lambdaRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:${stackNamePrefix}/*`],
      })
    );

    // ============================================
    // 4. Lambda Functions
    // ============================================

    // Create Todo
    const createTodoLambda = new lambda.Function(this, 'CreateTodoFunction', {
      functionName: `${stackNamePrefix}-create-todo`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64, // Cost optimization
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/lambdas/create-todo'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: todosTable.tableName,
        ENVIRONMENT: env,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      description: 'Create a new todo with optional AI-powered suggestions',
    });

    // Get Todo
    const getTodoLambda = new lambda.Function(this, 'GetTodoFunction', {
      functionName: `${stackNamePrefix}-get-todo`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/lambdas/get-todo'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: todosTable.tableName,
        ENVIRONMENT: env,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      description: 'Get a single todo item',
    });

    // List Todos
    const listTodosLambda = new lambda.Function(this, 'ListTodosFunction', {
      functionName: `${stackNamePrefix}-list-todos`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/lambdas/list-todos'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: todosTable.tableName,
        ENVIRONMENT: env,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      description: 'List todos with filtering and pagination',
    });

    // Update Todo
    const updateTodoLambda = new lambda.Function(this, 'UpdateTodoFunction', {
      functionName: `${stackNamePrefix}-update-todo`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/lambdas/update-todo'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: todosTable.tableName,
        ENVIRONMENT: env,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      description: 'Update an existing todo',
    });

    // Delete Todo
    const deleteTodoLambda = new lambda.Function(this, 'DeleteTodoFunction', {
      functionName: `${stackNamePrefix}-delete-todo`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/lambdas/delete-todo'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: todosTable.tableName,
        ENVIRONMENT: env,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      description: 'Delete a todo item',
    });

    // AI Task Processor
    const aiTaskProcessorLambda = new lambda.Function(this, 'AITaskProcessorFunction', {
      functionName: `${stackNamePrefix}-ai-task-processor`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/lambdas/ai-task-processor'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: todosTable.tableName,
        ENVIRONMENT: env,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      description: 'AI-powered task suggestion and categorization',
    });

    // Stream Consumer (Event-driven processing)
    const streamConsumerLambda = new lambda.Function(this, 'StreamConsumerFunction', {
      functionName: `${stackNamePrefix}-stream-consumer`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/lambdas/stream-consumer'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: todosTable.tableName,
        ENVIRONMENT: env,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      layers: [sharedLayer],
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      description: 'Process DynamoDB stream events',
    });

    // ============================================
    // 5. DynamoDB Stream Trigger
    // ============================================
    streamConsumerLambda.addEventSourceMapping('DynamoDBStream', {
      eventSourceArn: todosTable.tableStreamArn!,
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 100,
      parallelizationFactor: 10,
      bisectBatchOnError: true,
      maxRecordAge: cdk.Duration.minutes(5),
      retryAttempts: 2,
    });

    // ============================================
    // 6. EventBridge Bus
    // ============================================
    const eventBus = new events.EventBus(this, 'TodoEventBus', {
      eventBusName: `${stackNamePrefix}-event-bus`,
    });

    // Rule: Route todo created events to AI processor
    new events.Rule(this, 'TodoCreatedRule', {
      eventBus,
      eventPattern: {
        source: ['todo.api'],
        detailType: ['Todo Created'],
      },
      targets: [new eventsTargets.LambdaFunction(aiTaskProcessorLambda)],
    });

    // Rule: Route stream events to EventBridge
    new events.Rule(this, 'StreamEventsRule', {
      eventBus,
      eventPattern: {
        source: ['dynamodb.stream'],
        detailType: ['Stream Record'],
      },
      targets: [new eventsTargets.LambdaFunction(streamConsumerLambda)],
    });

    // ============================================
    // 7. HTTP API Gateway (cheaper than REST)
    // ============================================
    const httpApi = new apigateway.HttpApi(this, 'TodoHttpApi', {
      apiName: `${stackNamePrefix}-http-api`,
      description: 'Todo API with AI Integration',
      createDefaultStage: true,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigateway.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Add routes
    httpApi.addRoutes({
      path: '/todos',
      methods: [apigateway.HttpMethod.POST],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('CreateTodoIntegration', createTodoLambda),
    });

    httpApi.addRoutes({
      path: '/todos/{id}',
      methods: [apigateway.HttpMethod.GET],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('GetTodoIntegration', getTodoLambda),
    });

    httpApi.addRoutes({
      path: '/todos',
      methods: [apigateway.HttpMethod.GET],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('ListTodosIntegration', listTodosLambda),
    });

    httpApi.addRoutes({
      path: '/todos/{id}',
      methods: [apigateway.HttpMethod.PUT],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('UpdateTodoIntegration', updateTodoLambda),
    });

    httpApi.addRoutes({
      path: '/todos/{id}',
      methods: [apigateway.HttpMethod.DELETE],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('DeleteTodoIntegration', deleteTodoLambda),
    });

    // NLP endpoint for AI task creation
    httpApi.addRoutes({
      path: '/todos/ai/suggest',
      methods: [apigateway.HttpMethod.POST],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('AISuggestIntegration', aiTaskProcessorLambda),
    });

    // ============================================
    // 8. CloudWatch Log Groups
    // ============================================
    new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/apigateway/${stackNamePrefix}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // ============================================
    // 9. Outputs
    // ============================================
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'HTTP API Gateway URL',
      exportName: `${stackNamePrefix}-api-url`,
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: todosTable.tableName,
      description: 'DynamoDB Table Name',
      exportName: `${stackNamePrefix}-table`,
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: eventBus.eventBusName,
      description: 'EventBridge Bus Name',
      exportName: `${stackNamePrefix}-event-bus`,
    });
  }
}
