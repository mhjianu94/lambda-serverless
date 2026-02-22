const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const watchDir = path.join(root, 'server');
const DEBOUNCE_MS = 1200;   // wait for save to settle (batches multiple fs events from one save)
const COOLDOWN_MS = 2500;   // after a run, ignore events so we only run once per save

let building = false;
let runAgain = false;
let lastRunTime = 0;

function runBuild() {
  if (building) {
    runAgain = true;
    return;
  }
  building = true;
  const child = spawn('node', [path.join(__dirname, 'build-lambda.js')], {
    stdio: 'inherit',
    cwd: root,
  });
  child.on('close', (code) => {
    building = false;
    lastRunTime = Date.now();
    if (code !== 0) console.error('build-lambda exited with', code);
    if (runAgain) {
      runAgain = false;
      console.log('[watch] save detected, rebuilding...');
      runBuild();
    }
  });
}

let debounce;
function scheduleBuild() {
  if (Date.now() - lastRunTime < COOLDOWN_MS) return; // ignore events right after a run (one run per save)
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    console.log('[watch] save detected, rebuilding...');
    runBuild();
  }, DEBOUNCE_MS);
}

console.log('Watching', watchDir, '(build on save only)');
runBuild();

require('fs').watch(watchDir, { recursive: true }, (event, filename) => {
  if (filename && !filename.includes('node_modules')) scheduleBuild();
});
