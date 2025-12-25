import * as cdk from 'aws-cdk-lib';
import { TodoApiStack } from './stack';

const app = new cdk.App();

const environment = (app.node.tryGetContext('environment') || 'dev') as 'dev' | 'staging' | 'prod';

new TodoApiStack(app, `TodoApiStack-${environment}`, {
  environment,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  stackName: `todo-api-${environment}-stack`,
});

app.synth();
