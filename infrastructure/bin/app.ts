import 'source-map-support/register';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as cdk from 'aws-cdk-lib';
import { HelloStack } from '../lib/stacks/hello-stack';
import { AuthStack } from '../lib/stacks/auth-stack';

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

new HelloStack(app, 'HelloStack', {
  env: stackEnv,
  description: 'Hello Lambda and API Gateway',
});

new AuthStack(app, 'AuthStack', {
  env: stackEnv,
  description: 'Auth Lambda and API Gateway',
});
