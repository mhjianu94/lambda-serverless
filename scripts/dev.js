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
  stdio: 'inherit',
  env: { ...process.env, LOCALSTACK_HOT_RELOAD: '1' },
});
if (r.status !== 0) process.exit(r.status ?? 1);

spawnSync('node', ['scripts/echo-localstack-urls.js'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});
process.exit(0);
