import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HelloFunction } from '../lambdas/hello';
import { HelloApi } from '../api/hello';

export interface HelloServiceProps extends cdk.StackProps {
  readonly stage?: string;
}

export class HelloService extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: HelloServiceProps) {
    super(scope, id, props);

    const lambdaCodePath = process.env.LAMBDA_CODE_PATH
      ? path.join(process.cwd(), '..', process.env.LAMBDA_CODE_PATH)
      : path.join(process.cwd(), '..', 'dist', 'lambda');
    const stage = props?.stage ?? 'dev';

    const helloFunction = new HelloFunction(this, 'HelloFunction', {
      codePath: lambdaCodePath,
      stage,
    });

    const helloApi = new HelloApi(this, 'HelloApi', {
      helloFunction: helloFunction.function,
      stageName: stage,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: helloApi.api.url,
      description: 'Hello API Gateway endpoint URL',
      exportName: 'HelloApiUrl',
    });

    new cdk.CfnOutput(this, 'HelloFunctionName', {
      value: helloFunction.function.functionName,
      description: 'Hello Lambda function name',
      exportName: 'HelloFunctionName',
    });
  }
}
