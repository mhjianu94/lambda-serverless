import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DbBackedFunctionProps {
  readonly codePath: string;
  readonly vpc: ec2.IVpc;
  readonly securityGroups: ec2.ISecurityGroup[];
  readonly dbProxyEndpoint: string;
  readonly secret: secretsmanager.ISecret;
  readonly handler?: string;
  readonly logGroupName?: string;
  readonly memorySize?: number;
  readonly timeout?: cdk.Duration;
  readonly stage?: string;
  readonly description?: string;
}

const useLocalStack = !!process.env.AWS_ENDPOINT_URL;
const lambdaSubnetType = useLocalStack ? ec2.SubnetType.PRIVATE_ISOLATED : ec2.SubnetType.PRIVATE_WITH_EGRESS;

export class DbBackedFunction extends Construct {
  readonly function: lambda.Function;
  readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: DbBackedFunctionProps) {
    super(scope, id);

    const logGroupName = props.logGroupName ?? '/aws/lambda/db-backed-function';
    const handler = props.handler ?? 'handlers/users-read.handler';

    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.function = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler,
      code: lambda.Code.fromAsset(props.codePath),
      description: props.description ?? 'Lambda in VPC that connects to RDS via Proxy',
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? cdk.Duration.seconds(30),
      vpc: props.vpc,
      vpcSubnets: { subnetType: lambdaSubnetType },
      securityGroups: props.securityGroups,
      environment: {
        STAGE: props.stage ?? 'dev',
        DB_PROXY_ENDPOINT: props.dbProxyEndpoint,
        DB_SECRET_ARN: props.secret.secretArn,
      },
      logGroup: this.logGroup,
    });

    props.secret.grantRead(this.function);
  }
}
