import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface AuthApiProps {
  readonly authFunction: IFunction;
  readonly stageName?: string;
}

export class AuthApi extends Construct {
  readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: AuthApiProps) {
    super(scope, id);

    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: 'Auth Service',
      description: 'API Gateway for Auth Lambda function',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      deployOptions: {
        stageName: props.stageName ?? 'dev',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    const authIntegration = new apigateway.LambdaIntegration(props.authFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    const authResource = this.api.root.addResource('auth');
    authResource.addMethod('POST', authIntegration);
  }
}
