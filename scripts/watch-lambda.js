const path = require('path');
const { spawn, spawnSync } = require('child_process');
const chokidar = require('chokidar');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const DEBOUNCE_MS = 600;

function runBuild() {
  const child = spawn('node', ['scripts/build-lambda.js'], { cwd: repoRoot, stdio: 'inherit' });
  child.on('close', (code) => {
    if (code !== 0) process.stderr.write(`build-lambda exited with ${code}\n`);
  });
}

let debounceTimer = null;
function scheduleBuild(relativePath) {
  console.log(`Change: ${relativePath}`);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runBuild();
  }, DEBOUNCE_MS);
}

const watcher = chokidar.watch(serverDir, {
  ignored: [/(^|[\/\\])(node_modules|dist)([\/\\]|$)/, /[\/\\]\./, /package-lock\.json$/],
  persistent: true,
});
watcher.on('ready', () => {
  console.log('Watching server/ source files (build only, no deploy). Ignoring node_modules and dist.');
  spawnSync('node', ['scripts/echo-localstack-urls.js'], { cwd: repoRoot, stdio: 'inherit' });
});
watcher.on('change', (p) => scheduleBuild(path.relative(repoRoot, p)));
watcher.on('add', (p) => scheduleBuild(path.relative(repoRoot, p)));
