const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const distLambda = path.join(repoRoot, 'dist', 'lambda');
const endpoint = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
const endpointS3 = process.env.AWS_ENDPOINT_URL_S3 || (endpoint.includes('localhost') ? endpoint.replace('localhost', 's3.localhost') : endpoint.replace('://', '://s3.'));
const region = process.env.LOCALSTACK_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';
const useHotReload = process.env.LOCALSTACK_HOT_RELOAD !== undefined && process.env.LOCALSTACK_HOT_RELOAD !== '0';
const hotReloadPath = process.env.LAMBDA_HOT_RELOAD_PATH || '/opt/project/dist/lambda';

const env = {
  ...process.env,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'test',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  AWS_DEFAULT_REGION: region,
  AWS_REGION: region,
  CDK_DEFAULT_ACCOUNT: process.env.CDK_DEFAULT_ACCOUNT || '000000000000',
  CDK_DEFAULT_REGION: region,
  AWS_ENDPOINT_URL: endpoint,
  AWS_ENDPOINT_URL_S3: endpointS3,
  AWS_ENDPOINT_URL_HTTP: endpoint,
};
if (useHotReload) {
  env.LOCALSTACK_HOT_RELOAD = '1';
  env.LAMBDA_HOT_RELOAD_PATH = hotReloadPath;
  env.LAMBDA_MOUNT_CODE = '1';
  env.BUCKET_MARKER_LOCAL = 'hot-reload';
}

const args = process.argv.slice(2);
const cmd = args[0];
const rest = args.slice(1);

const needsAsset = cmd === 'cdklocal' && rest.length > 0 && ['deploy', 'synth', 'diff', 'watch'].includes(rest[0]);
if (needsAsset && !fs.existsSync(distLambda)) {
  console.log('Lambda asset dist/lambda missing; running build:lambda...');
  const build = spawnSync('node', ['scripts/build-lambda.js'], { cwd: repoRoot, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const result = spawnSync(
  cmd === 'cdklocal' ? 'npx' : cmd,
  cmd === 'cdklocal' ? ['cdklocal', ...rest] : rest,
  {
    env,
    cwd: cmd === 'cdklocal' || (cmd === 'npx' && rest[0] === 'cdklocal') ? path.join(repoRoot, 'infrastructure') : repoRoot,
    stdio: 'inherit',
    shell: false,
  }
);

process.exit(result.status ?? 1);
