import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcService } from './vpc';
import { DatabaseService } from './database';
import { DbBackedFunction } from '../lambdas/db-backed';
import { ApiDb } from '../api/api-db';

export interface ApiDbServiceProps extends cdk.StackProps {
  readonly vpcStack: VpcService;
  readonly databaseStack: DatabaseService;
  readonly stage?: string;
}

export class ApiDbService extends cdk.Stack {
  readonly migrationFunctionName: string;

  constructor(scope: Construct, id: string, props: ApiDbServiceProps) {
    super(scope, id, props);

    const { vpcStack, databaseStack } = props;
    const lambdaCodePath = process.env.LAMBDA_CODE_PATH
      ? path.join(process.cwd(), '..', process.env.LAMBDA_CODE_PATH)
      : path.join(process.cwd(), '..', 'dist', 'lambda');
    const stage = props.stage ?? 'dev';

    const sharedProps = {
      codePath: lambdaCodePath,
      vpc: vpcStack.vpc,
      securityGroups: [vpcStack.lambdaSecurityGroup],
      dbProxyEndpoint: databaseStack.dbProxy.endpoint,
      secret: databaseStack.secret,
      stage,
    };

    const usersReadFunction = new DbBackedFunction(this, 'UsersReadFunction', {
      ...sharedProps,
      handler: 'handlers/users-read.handler',
      logGroupName: '/aws/lambda/users-read',
      description: 'Lambda in VPC: read users (list, get by id)',
    });

    const usersWriteFunction = new DbBackedFunction(this, 'UsersWriteFunction', {
      ...sharedProps,
      handler: 'handlers/users-write.handler',
      logGroupName: '/aws/lambda/users-write',
      description: 'Lambda in VPC: write users (create, update)',
    });

    const migrationFunction = new DbBackedFunction(this, 'MigrationFunction', {
      ...sharedProps,
      handler: 'handlers/migrate.handler',
      logGroupName: '/aws/lambda/db-migrate',
      description: 'Lambda in VPC: run TypeORM migrations',
      timeout: cdk.Duration.minutes(5),
    });

    this.migrationFunctionName = migrationFunction.function.functionName;

    const apiDb = new ApiDb(this, 'ApiDb', {
      readFunction: usersReadFunction.function,
      writeFunction: usersWriteFunction.function,
      stageName: stage,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: apiDb.api.url,
      description: 'API DB Gateway endpoint URL',
      exportName: 'ApiDbUrl',
    });

    new cdk.CfnOutput(this, 'UsersReadFunctionName', {
      value: usersReadFunction.function.functionName,
      description: 'Users read Lambda function name',
      exportName: 'UsersReadFunctionName',
    });

    new cdk.CfnOutput(this, 'UsersWriteFunctionName', {
      value: usersWriteFunction.function.functionName,
      description: 'Users write Lambda function name',
      exportName: 'UsersWriteFunctionName',
    });

    new cdk.CfnOutput(this, 'MigrationFunctionName', {
      value: this.migrationFunctionName,
      description: 'DB migration Lambda function name (invoke after deploy)',
      exportName: 'ApiDbService-MigrationFunctionName',
    });
  }
}
