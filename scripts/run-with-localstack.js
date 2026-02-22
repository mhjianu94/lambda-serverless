const dns = require('dns');
const fs = require('fs');
const { spawnSync } = require('child_process');

const EDGE_PORT = process.env.EDGE_PORT || '4566';
const LOCALSTACK_REGION = process.env.LOCALSTACK_REGION || 'eu-central-1';
const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || `http://localhost:${EDGE_PORT}`;
// For deploy/bootstrap with cdklocal: either .localhost (if endpoints set) or localstack.cloud (if cdklocal sets them).
const CDK_ASSET_BUCKET_HOST = `cdk-hnb659fds-assets-000000000000-${LOCALSTACK_REGION}.localhost`;
const LOCALSTACK_CLOUD_HOST = 'localhost.localstack.cloud';
const S3_LOCALSTACK_CLOUD_HOST = 's3.localhost.localstack.cloud';

Object.assign(process.env, {
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  AWS_DEFAULT_REGION: LOCALSTACK_REGION,
  AWS_REGION: LOCALSTACK_REGION,
  CDK_DEFAULT_ACCOUNT: '000000000000',
  CDK_DEFAULT_REGION: LOCALSTACK_REGION,
  EDGE_PORT,
  AWS_ENDPOINT_URL: LOCALSTACK_ENDPOINT,
  AWS_ENDPOINT_URL_HTTP: LOCALSTACK_ENDPOINT,
  AWS_ENDPOINT_URL_S3: LOCALSTACK_ENDPOINT,
});

function checkHost(host) {
  return new Promise((resolve) => {
    dns.lookup(host, (err) => resolve(!err));
  });
}

function checkHostsForDeploy() {
  return Promise.all([
    checkHost(LOCALSTACK_CLOUD_HOST),
    checkHost(S3_LOCALSTACK_CLOUD_HOST),
  ]).then(([a, b]) => a && b);
}

function printHostsInstruction() {
  const lines = [
    `127.0.0.1 ${LOCALSTACK_CLOUD_HOST}`,
    `127.0.0.1 ${S3_LOCALSTACK_CLOUD_HOST}`,
  ];
  console.error('');
  console.error('cdklocal needs these hostnames to resolve to 127.0.0.1.');
  console.error('Add these lines to /etc/hosts (one-time setup):');
  console.error('');
  lines.forEach((l) => console.error('  ' + l));
  console.error('');
  console.error('Or run: npm run localstack:setup-hosts');
  console.error('');
}

function setupHosts() {
  const lines = [
    `127.0.0.1 ${LOCALSTACK_CLOUD_HOST}`,
    `127.0.0.1 ${S3_LOCALSTACK_CLOUD_HOST}`,
  ];
  const hostsPath = '/etc/hosts';
  let contents;
  try {
    contents = fs.readFileSync(hostsPath, 'utf8');
  } catch (e) {
    console.error('Could not read /etc/hosts:', e.message);
    console.error('Add these lines manually (with sudo):');
    lines.forEach((l) => console.error(l));
    process.exit(1);
  }
  const toAdd = lines.filter((line) => {
    const host = line.split(/\s+/)[1];
    return !contents.includes(host);
  });
  if (toAdd.length === 0) {
    console.log('Already configured:', LOCALSTACK_CLOUD_HOST, 'and', S3_LOCALSTACK_CLOUD_HOST);
    process.exit(0);
  }
  console.log('Adding to /etc/hosts (sudo may prompt for password):');
  toAdd.forEach((l) => console.log('  ' + l));
  const block = toAdd.join('\n');
  const result = spawnSync('sudo', ['tee', '-a', hostsPath], {
    input: block,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  process.exit(result.status === 0 ? 0 : 1);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'deploy';
  const cdkArgs = args.slice(1);

  if (command === 'setup-hosts') {
    setupHosts();
    return;
  }

  const needsPublish = command === 'deploy' || command === 'bootstrap';
  const useCdklocal = needsPublish;

  if (needsPublish) {
    // Let cdklocal set AWS_ENDPOINT_URL / AWS_ENDPOINT_URL_S3 so it can use path-style S3 (avoids LocalStack "invalid XML").
    delete process.env.AWS_ENDPOINT_URL;
    delete process.env.AWS_ENDPOINT_URL_S3;
    // Mount Lambda code from host path so LocalStack hot-reloads without redeploy (path must be absolute on host).
    process.env.LAMBDA_MOUNT_CODE = '1';
    const resolves = await checkHostsForDeploy();
    if (!resolves) {
      printHostsInstruction();
      process.exit(1);
    }
  }

  const bin = useCdklocal ? 'cdklocal' : 'cdk';
  const result = spawnSync('npx', [bin, command, ...cdkArgs], {
    stdio: 'inherit',
    shell: true,
  });

  process.exit(result.status ?? 1);
}

main();
