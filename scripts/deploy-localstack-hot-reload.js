'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const {
  CloudFormationClient,
  CreateStackCommand,
  UpdateStackCommand,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');
const repoRoot = path.resolve(__dirname, '..');
const infrastructureDir = path.join(repoRoot, 'infrastructure');
const cdkOut = path.join(infrastructureDir, 'cdk.out');
const distLambda = path.join(repoRoot, 'dist', 'lambda');
const rawEndpoint = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
const useLocalhost = rawEndpoint.includes('localhost') || rawEndpoint.includes('127.0.0.1');
const endpoint = useLocalhost ? rawEndpoint.replace(/localhost/, '127.0.0.1') : rawEndpoint;
const endpointS3 = process.env.AWS_ENDPOINT_URL_S3 || (useLocalhost ? endpoint : rawEndpoint.replace('://', '://s3.'));
const region = process.env.LOCALSTACK_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';
const env = { ...process.env, AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'test', AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'test', AWS_DEFAULT_REGION: region, AWS_REGION: region, CDK_DEFAULT_ACCOUNT: process.env.CDK_DEFAULT_ACCOUNT || '000000000000', CDK_DEFAULT_REGION: region, AWS_ENDPOINT_URL: endpoint, AWS_ENDPOINT_URL_S3: endpointS3, LOCALSTACK_HOT_RELOAD: '1', LAMBDA_MOUNT_CODE: '1', BUCKET_MARKER_LOCAL: 'hot-reload' };
if (!fs.existsSync(distLambda)) { const build = spawnSync('node', ['scripts/build-lambda.js'], { cwd: repoRoot, stdio: 'inherit' }); if (build.status !== 0) process.exit(build.status ?? 1); }
console.log('Synthing with hot-reload parameters...');
const synth = spawnSync('npx', ['cdklocal', 'synth', '--all'], { cwd: infrastructureDir, env, stdio: 'inherit' });
if (synth.status !== 0) process.exit(synth.status ?? 1);
if (!fs.existsSync(cdkOut)) { console.error('cdk.out not found after synth.'); process.exit(1); }
const templateFiles = fs.readdirSync(cdkOut).filter(function(n) { return n.endsWith('.template.json'); });
for (let t = 0; t < templateFiles.length; t++) {
  const data = JSON.parse(fs.readFileSync(path.join(cdkOut, templateFiles[t]), 'utf8'));
  const resources = data.Resources || {};
  for (const logicalId of Object.keys(resources)) {
    const res = resources[logicalId];
    if (res.Type !== 'AWS::Lambda::Function' || !res.Metadata || !res.Metadata['aws:asset:path']) continue;
    const assetPath = res.Metadata['aws:asset:path'];
    const linkPath = path.join(cdkOut, 'asset.lambda.' + logicalId);
    const targetDir = path.join(cdkOut, assetPath);
    if (!fs.existsSync(targetDir)) continue;
    try {
      if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
      fs.symlinkSync(assetPath, linkPath);
    } catch (e) {}
  }
}
for (let i = 0; i < templateFiles.length; i++) {
  const name = templateFiles[i];
  const filePath = path.join(cdkOut, name);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const resources = data.Resources || {};
  let changed = false;
  for (const logicalId of Object.keys(resources)) {
    const res = resources[logicalId];
    if (res.Type !== 'AWS::Lambda::Function' || !res.Properties || !res.Properties.Code) continue;
    const code = res.Properties.Code;
    if (code.S3Bucket !== undefined && code.S3Key !== undefined) {
      code.S3Bucket = 'hot-reload';
      code.S3Key = '$HOST_LAMBDA_DIR/infrastructure/cdk.out/asset.lambda.' + logicalId;
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(filePath, JSON.stringify(data, null, 1));
}
for (let t = 0; t < templateFiles.length; t++) {
  const filePath = path.join(cdkOut, templateFiles[t]);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (data.Parameters && data.Parameters.BootstrapVersion) {
    data.Parameters.BootstrapVersion.Type = 'String';
    data.Parameters.BootstrapVersion.Default = '6';
    fs.writeFileSync(filePath, JSON.stringify(data, null, 1));
  }
}
const manifestPath = path.join(cdkOut, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const stacks = Object.entries(manifest.artifacts || {}).filter(function(e) { return e[1].type === 'aws:cloudformation:stack'; }).map(function(e) { return e[0]; });
const cf = new CloudFormationClient({
  region,
  endpoint,
  credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID || 'test', secretAccessKey: env.AWS_SECRET_ACCESS_KEY || 'test' },
});
const capabilities = ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'];
async function deployStack(stackName) {
  const templateFile = path.join(cdkOut, stackName + '.template.json');
  if (!fs.existsSync(templateFile)) return;
  const templateBody = fs.readFileSync(templateFile, 'utf8');
  let exists = false;
  try {
    await cf.send(new DescribeStacksCommand({ StackName: stackName }));
    exists = true;
  } catch (e) {
    if (e.name !== 'ValidationError' && !e.message.includes('does not exist')) throw e;
  }
  if (exists) {
    try {
      await cf.send(new UpdateStackCommand({
        StackName: stackName,
        TemplateBody: templateBody,
        Capabilities: capabilities,
      }));
    } catch (e) {
      if (e.message && e.message.includes('No updates are to be performed')) return;
      throw e;
    }
  } else {
    await cf.send(new CreateStackCommand({
      StackName: stackName,
      TemplateBody: templateBody,
      Capabilities: capabilities,
    }));
  }
}
(async function () {
  for (let s = 0; s < stacks.length; s++) {
    const stackName = stacks[s];
    console.log('Deploying stack', stackName, '...');
    try {
      await deployStack(stackName);
    } catch (e) {
      console.error(stackName, 'failed:', e.message);
      process.exit(1);
    }
  }
  process.exit(0);
})();
