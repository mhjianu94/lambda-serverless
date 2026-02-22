import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface AuthFuncionProps {
  readonly codePath: string;
  readonly memorySize?: number;
  readonly timeout?: cdk.Duration;
  readonly stage?: string;
}

export class AuthFunction extends Construct {
  readonly function: lambda.Function;
  readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: AuthFuncionProps) {
    super(scope, id);

    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: '/aws/lambda/auth-function',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.function = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handlers/auth.handler',
      code: lambda.Code.fromAsset(props.codePath),
      description: 'Auth Lambda function',
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? cdk.Duration.seconds(30),
      environment: {
        STAGE: props.stage ?? 'dev',
      },
      logGroup: this.logGroup,
    });
  }
}
