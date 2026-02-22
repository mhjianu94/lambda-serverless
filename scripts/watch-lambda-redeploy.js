/**
 * Watch server/lambda and on change: build then redeploy to LocalStack.
 * Use this when hot-reload (mount) does not pick up changes in your environment.
 * Slower (~15–30s per save) but guarantees the Lambda response updates.
 */
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const watchDir = path.join(root, 'server', 'lambda');
const DEBOUNCE_MS = 2500;

let busy = false;
let pending = false;

function runBuild(cb) {
  const child = spawn('node', [path.join(__dirname, 'build-lambda.js')], {
    stdio: 'inherit',
    cwd: root,
  });
  child.on('close', (code) => {
    if (code !== 0) {
      console.error('build-lambda exited with', code);
      if (cb) cb(code);
      return;
    }
    if (cb) cb(0);
  });
}

function runDeploy(cb) {
  console.log('[watch] Deploying to LocalStack...');
  const child = spawn('node', [path.join(__dirname, 'run-with-localstack.js'), 'deploy', '--all', '--require-approval', 'never'], {
    stdio: 'inherit',
    cwd: path.join(root, 'infrastructure'),
    env: { ...process.env, LAMBDA_CODE_PATH: 'dist/lambda' },
  });
  child.on('close', (code) => {
    if (code !== 0) console.error('deploy exited with', code);
    if (cb) cb(code);
  });
}

function buildAndDeploy() {
  if (busy) {
    pending = true;
    return;
  }
  busy = true;
  pending = false;
  console.log('[watch] Change detected, building...');
  runBuild((code) => {
    if (code !== 0) {
      busy = false;
      if (pending) setTimeout(buildAndDeploy, 100);
      return;
    }
    runDeploy(() => {
      busy = false;
      if (pending) setTimeout(buildAndDeploy, 100);
    });
  });
}

let debounce;
require('fs').watch(watchDir, { recursive: true }, (event, filename) => {
  if (!filename || filename.includes('node_modules')) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    buildAndDeploy();
  }, DEBOUNCE_MS);
});

console.log('Watching', watchDir, '(build + redeploy on change). Debounce:', DEBOUNCE_MS + 'ms');
runBuild((code) => {
  if (code === 0) {
    console.log('Initial build done. Edit a file and save to trigger deploy.');
  }
});
