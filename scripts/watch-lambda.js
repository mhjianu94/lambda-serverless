const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const watchDir = path.join(root, 'server', 'lambda');

let building = false;
let runAgain = false;

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
    if (code !== 0) console.error('build-lambda exited with', code);
    if (runAgain) {
      runAgain = false;
      console.log('[watch] change detected, rebuilding...');
      runBuild();
    }
  });
}

let debounce;
function scheduleBuild() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    console.log('[watch] change detected, rebuilding...');
    runBuild();
  }, 800);
}

console.log('Watching', watchDir, '(build on change)');
runBuild();

require('fs').watch(watchDir, { recursive: true }, (event, filename) => {
  if (filename && !filename.includes('node_modules')) scheduleBuild();
});
