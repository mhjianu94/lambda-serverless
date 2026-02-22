import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcStack } from './vpc-stack';
import { DatabaseStack } from './database-stack';
import { DbBackedFunction } from '../lambdas/db-backed-function';
import { ApiDb } from '../api/api-db';

export interface ApiDbStackProps extends cdk.StackProps {
  readonly vpcStack: VpcStack;
  readonly databaseStack: DatabaseStack;
  readonly stage?: string;
}

export class ApiDbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiDbStackProps) {
    super(scope, id, props);

    const { vpcStack, databaseStack } = props;
    const lambdaCodePath = process.env.LAMBDA_CODE_PATH
      ? path.join(process.cwd(), '..', process.env.LAMBDA_CODE_PATH)
      : path.join(process.cwd(), '..', 'server', 'lambda');
    const stage = props.stage ?? 'dev';

    const dbFunction = new DbBackedFunction(this, 'DbBackedFunction', {
      codePath: lambdaCodePath,
      vpc: vpcStack.vpc,
      securityGroups: [vpcStack.lambdaSecurityGroup],
      dbProxyEndpoint: databaseStack.dbProxy.endpoint,
      secret: databaseStack.secret,
      stage,
    });

    const apiDb = new ApiDb(this, 'ApiDb', {
      dbFunction: dbFunction.function,
      stageName: stage,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: apiDb.api.url,
      description: 'API DB Gateway endpoint URL',
      exportName: 'ApiDbUrl',
    });

    new cdk.CfnOutput(this, 'DbFunctionName', {
      value: dbFunction.function.functionName,
      description: 'DB-backed Lambda function name',
      exportName: 'DbFunctionName',
    });
  }
}
