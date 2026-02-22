import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AuthFunction } from '../lambdas/auth';
import { AuthApi } from '../api/auth';

export interface AuthServiceProps extends cdk.StackProps {
  readonly stage?: string;
}

export class AuthService extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: AuthServiceProps) {
    super(scope, id, props);

    const lambdaCodePath = process.env.LAMBDA_CODE_PATH
      ? path.join(process.cwd(), '..', process.env.LAMBDA_CODE_PATH)
      : path.join(process.cwd(), '..', 'dist', 'lambda');
    const stage = props?.stage ?? 'dev';

    const authFunction = new AuthFunction(this, 'AuthFunction', {
      codePath: lambdaCodePath,
      stage,
    });

    const authApi = new AuthApi(this, 'AuthApi', {
      authFunction: authFunction.function,
      stageName: stage,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: authApi.api.url,
      description: 'Auth API Gateway endpoint URL',
      exportName: 'AuthApiUrl',
    });

    new cdk.CfnOutput(this, 'AuthFunctionName', {
      value: authFunction.function.functionName,
      description: 'Auth Lambda function name',
      exportName: 'AuthFunctionName',
    });
  }
}
