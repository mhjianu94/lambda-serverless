import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

const POSTGRES_PORT = 5432;

export interface DatabaseStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly lambdaSecurityGroup: ec2.ISecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  readonly dbInstance: rds.DatabaseInstance;
  readonly dbProxy: rds.DatabaseProxy;
  readonly secret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc, lambdaSecurityGroup } = props;

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      vpc,
      description: 'Security group for RDS PostgreSQL instance',
      allowAllOutbound: false,
    });

    const proxySecurityGroup = new ec2.SecurityGroup(this, 'ProxySg', {
      vpc,
      description: 'Security group for RDS Proxy',
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      proxySecurityGroup,
      ec2.Port.tcp(POSTGRES_PORT),
      'Allow RDS Proxy to connect to database'
    );

    proxySecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(POSTGRES_PORT),
      'Allow Lambda to connect to RDS Proxy'
    );

    this.dbInstance = new rds.DatabaseInstance(this, 'DbInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
    });

    const secret = this.dbInstance.secret;
    if (!secret) {
      throw new Error('Database instance must have a secret when using generated credentials');
    }
    this.secret = secret;

    this.dbProxy = new rds.DatabaseProxy(this, 'DbProxy', {
      proxyTarget: rds.ProxyTarget.fromInstance(this.dbInstance),
      secrets: [this.secret],
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [proxySecurityGroup],
      requireTLS: false,
    });

    new cdk.CfnOutput(this, 'ProxyEndpoint', {
      value: this.dbProxy.endpoint,
      description: 'RDS Proxy endpoint hostname',
      exportName: `${this.stackName}-ProxyEndpoint`,
    });

    new cdk.CfnOutput(this, 'ProxyEndpointPort', {
      value: String(POSTGRES_PORT),
      description: 'RDS Proxy port',
      exportName: `${this.stackName}-ProxyEndpointPort`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.secret.secretArn,
      description: 'Secrets Manager secret ARN for DB credentials',
      exportName: `${this.stackName}-SecretArn`,
    });
  }
}
