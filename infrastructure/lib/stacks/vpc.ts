import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface VpcServiceProps extends cdk.StackProps {
  /** If set, create a new VPC. If not set, defaults to creating a new VPC. */
  readonly maxAzs?: number;
}

export class VpcService extends cdk.Stack {
  readonly vpc: ec2.IVpc;
  readonly lambdaSecurityGroup: ec2.ISecurityGroup;
  readonly privateSubnets: ec2.ISubnet[];

  constructor(scope: Construct, id: string, props?: VpcServiceProps) {
    super(scope, id, props);

    const maxAzs = props?.maxAzs ?? 2;

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs,
      natGateways: 1,
    });

    this.privateSubnets = this.vpc.privateSubnets;

    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions that connect to RDS Proxy',
      allowAllOutbound: true,
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.privateSubnets.map((s) => s.subnetId).join(','),
      description: 'Private subnet IDs (comma-separated)',
      exportName: `${this.stackName}-PrivateSubnetIds`,
    });

    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: this.lambdaSecurityGroup.securityGroupId,
      description: 'Security group ID for Lambda in VPC',
      exportName: `${this.stackName}-LambdaSecurityGroupId`,
    });
  }
}
