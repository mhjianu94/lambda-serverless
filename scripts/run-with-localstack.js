#!/usr/bin/env node
/**
 * Runs CDK commands with LocalStack endpoint and test credentials.
 * Usage: node scripts/run-with-localstack.js <cdk-command> [args...]
 * Example: node scripts/run-with-localstack.js deploy --require-approval never
 */

const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';

// LocalStack single gateway; set S3 endpoint for CDK 2.177+ compatibility.
Object.assign(process.env, {
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  AWS_DEFAULT_REGION: 'us-east-1',
  AWS_REGION: 'us-east-1',
  CDK_DEFAULT_ACCOUNT: '000000000000',
  CDK_DEFAULT_REGION: 'us-east-1',
  AWS_ENDPOINT_URL: LOCALSTACK_ENDPOINT,
  AWS_ENDPOINT_URL_HTTP: LOCALSTACK_ENDPOINT,
  AWS_ENDPOINT_URL_S3: LOCALSTACK_ENDPOINT,
});

const { spawnSync } = require('child_process');
const args = process.argv.slice(2);
const command = args[0] || 'deploy';
const cdkArgs = args.slice(1);

const result = spawnSync('npx', ['cdk', command, ...cdkArgs], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
