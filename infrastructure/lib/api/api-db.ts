import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiDbProps {
  readonly dbFunction: IFunction;
  readonly stageName?: string;
}

export class ApiDb extends Construct {
  readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiDbProps) {
    super(scope, id);

    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: 'API DB Service',
      description: 'API Gateway for Lambda in VPC (RDS Proxy)',
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

    const dbIntegration = new apigateway.LambdaIntegration(props.dbFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    const dbResource = this.api.root.addResource('db');
    dbResource.addMethod('GET', dbIntegration);
    dbResource.addMethod('POST', dbIntegration);
  }
}
