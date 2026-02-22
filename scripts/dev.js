const path = require('path');
const { execSync, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

execSync('node scripts/build-lambda.js', { cwd: repoRoot, stdio: 'inherit' });

const r = spawnSync('node', [
  'scripts/run-with-localstack.js',
  'cdklocal',
  'deploy',
  '--all',
  '--require-approval',
  'never',
], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, LOCALSTACK_HOT_RELOAD: '1' },
});
const deployOut = (r.stdout || '') + (r.stderr || '');
if (deployOut) process.stdout.write(deployOut);
if (r.status !== 0) process.exit(r.status ?? 1);

const urlLines = deployOut.split('\n').filter((line) => /\.ApiUrl\s*=\s*.+/.test(line));
if (urlLines.length > 0) {
  console.log('\n--- API endpoints (test with curl or your HTTP client) ---');
  urlLines.forEach((line) => {
    const m = line.match(/(\w+\.ApiUrl)\s*=\s*(.+)/);
    if (m) console.log(`  ${m[1].trim()}: ${m[2].trim()}`);
  });
  console.log('---\n');
} else {
  const localstackEnv = {
    ...process.env,
    AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_ENDPOINT || 'http://127.0.0.1:4566',
    AWS_REGION: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || process.env.LOCALSTACK_REGION || 'us-east-1',
  };
  spawnSync('node', ['scripts/echo-localstack-urls.js'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: localstackEnv,
  });
}
process.exit(0);
