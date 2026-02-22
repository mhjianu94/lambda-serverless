import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface HelloApiProps {
  readonly helloFunction: IFunction;
  readonly stageName?: string;
}

export class HelloApi extends Construct {
  readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: HelloApiProps) {
    super(scope, id);

    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: 'Hello Service',
      description: 'API Gateway for Hello Lambda function',
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

    const helloIntegration = new apigateway.LambdaIntegration(props.helloFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    const helloResource = this.api.root.addResource('hello');
    helloResource.addMethod('GET', helloIntegration);
    helloResource.addMethod('POST', helloIntegration);
  }
}
