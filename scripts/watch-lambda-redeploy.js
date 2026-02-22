const path = require('path');
const { spawnSync } = require('child_process');
const chokidar = require('chokidar');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const DEBOUNCE_MS = 800;

function buildAndDeploy() {
  console.log('Building Lambda...');
  const b = spawnSync('node', ['scripts/build-lambda.js'], { cwd: repoRoot, stdio: 'inherit' });
  if (b.status !== 0) return;
  console.log('Deploying to LocalStack...');
  const d = spawnSync('node', ['scripts/run-with-localstack.js', 'cdklocal', 'deploy', '--all', '--require-approval', 'never'], { cwd: repoRoot, stdio: 'inherit' });
  if (d.status !== 0) return;
  spawnSync('node', ['scripts/echo-localstack-urls.js'], { cwd: repoRoot, stdio: 'inherit' });
}

let debounceTimer = null;
function scheduleBuildAndDeploy(relativePath) {
  console.log(`Change: ${relativePath}`);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    buildAndDeploy();
  }, DEBOUNCE_MS);
}

const watcher = chokidar.watch(serverDir, {
  ignored: [/(^|[\/\\])(node_modules|dist)([\/\\]|$)/, /[\/\\]\./, /package-lock\.json$/],
  persistent: true,
});
watcher.on('ready', () => {
  console.log('Watching server/ source files (build + deploy on save). Ignoring node_modules and dist.');
});
watcher.on('change', (p) => scheduleBuildAndDeploy(path.relative(repoRoot, p)));
watcher.on('add', (p) => scheduleBuildAndDeploy(path.relative(repoRoot, p)));
