import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiDbProps {
  readonly readFunction: IFunction;
  readonly writeFunction: IFunction;
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

    const readIntegration = new apigateway.LambdaIntegration(props.readFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });
    const writeIntegration = new apigateway.LambdaIntegration(props.writeFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    const dbResource = this.api.root.addResource('db');
    dbResource.addMethod('GET', readIntegration);
    dbResource.addMethod('POST', writeIntegration);

    const usersResource = this.api.root.addResource('users');
    usersResource.addMethod('GET', readIntegration);
    usersResource.addMethod('POST', writeIntegration);

    const userByIdResource = usersResource.addResource('{id}');
    userByIdResource.addMethod('GET', readIntegration);
    userByIdResource.addMethod('PUT', writeIntegration);
  }
}
