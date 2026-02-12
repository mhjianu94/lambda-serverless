import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class LambdaServerlessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create CloudWatch Log Group for Lambda
    const logGroup = new logs.LogGroup(this, 'HelloLambdaLogGroup', {
      logGroupName: `/aws/lambda/hello-function`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Lambda function
    const helloFunction = new lambda.Function(this, 'HelloFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler.hello',
      code: lambda.Code.fromAsset('lambda'),
      description: 'A simple hello world Lambda function',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: 'dev',
      },
      logGroup: logGroup,
    });

    // Create API Gateway REST API
    const api = new apigateway.RestApi(this, 'HelloApi', {
      restApiName: 'Hello Service',
      description: 'API Gateway for Hello Lambda function',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      deployOptions: {
        stageName: 'dev',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // Create Lambda integration
    const helloIntegration = new apigateway.LambdaIntegration(helloFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // Add GET method
    const helloResource = api.root.addResource('hello');
    helloResource.addMethod('GET', helloIntegration);
    helloResource.addMethod('POST', helloIntegration);

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'HelloApiUrl',
    });

    // Output the Lambda function name
    new cdk.CfnOutput(this, 'HelloFunctionName', {
      value: helloFunction.functionName,
      description: 'Hello Lambda function name',
      exportName: 'HelloFunctionName',
    });
  }
}

