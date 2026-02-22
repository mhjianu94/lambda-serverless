import 'source-map-support/register';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as cdk from 'aws-cdk-lib';
import { HelloService } from '../lib/stacks/hello';
import { AuthService } from '../lib/stacks/auth';
import { VpcService } from '../lib/stacks/vpc';
import { DatabaseService } from '../lib/stacks/database';
import { ApiDbService } from '../lib/stacks/api-db';

const projectRoot = fs.existsSync(path.join(__dirname, '../../.env'))
  ? path.join(__dirname, '../..')
  : path.join(__dirname, '..');

const envPath = path.join(projectRoot, '.env');

const envResult = dotenv.config({ path: envPath, override: true });

const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

if (process.env.CDK_DEBUG || envResult.error) {
  if (envResult.error) {
    console.warn(`Warning: Could not load .env file from ${envPath}:`, envResult.error.message);
  } else {
    console.log(`Loaded .env from: ${envPath}`);
  }
  console.log(`CDK_DEFAULT_REGION: ${process.env.CDK_DEFAULT_REGION || 'not set'}`);
  console.log(`Deploying to region: ${region}`);
}

const app = new cdk.App();

const stackEnv = { account, region };
const useLocalStack = !!process.env.AWS_ENDPOINT_URL;

new HelloService(app, 'HelloService', {
  env: stackEnv,
  description: 'Hello Lambda and API Gateway',
});

new AuthService(app, 'AuthService', {
  env: stackEnv,
  description: 'Auth Lambda and API Gateway',
});

if (!useLocalStack) {
  const vpcStack = new VpcService(app, 'VpcService', {
    env: stackEnv,
    description: 'VPC and networking for RDS and Lambda',
  });

  const databaseStack = new DatabaseService(app, 'DatabaseService', {
    env: stackEnv,
    description: 'RDS PostgreSQL, Secrets Manager, and RDS Proxy',
    vpc: vpcStack.vpc,
    lambdaSecurityGroup: vpcStack.lambdaSecurityGroup,
  });

  new ApiDbService(app, 'ApiDbService', {
    env: stackEnv,
    description: 'Lambda in VPC and API Gateway (DB via RDS Proxy)',
    vpcStack,
    databaseStack,
  });
}
