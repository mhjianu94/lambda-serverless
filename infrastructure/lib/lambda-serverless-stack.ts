import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HelloFunction } from './lambdas/hello-function';
import { HelloApi } from './api/hello-api';

export class LambdaServerlessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaCodePath = path.join(process.cwd(), '..', 'server', 'lambda');

    const helloFunction = new HelloFunction(this, 'HelloFunction', {
      codePath: lambdaCodePath,
      stage: 'dev',
    });

    const helloApi = new HelloApi(this, 'HelloApi', {
      helloFunction: helloFunction.function,
      stageName: 'dev',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: helloApi.api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'HelloApiUrl',
    });

    new cdk.CfnOutput(this, 'HelloFunctionName', {
      value: helloFunction.function.functionName,
      description: 'Hello Lambda function name',
      exportName: 'HelloFunctionName',
    });
  }
}
