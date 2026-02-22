const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const chokidar = require('chokidar');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const distLambda = path.join(repoRoot, 'dist', 'lambda');
const cdkOut = path.join(repoRoot, 'infrastructure', 'cdk.out');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function syncDistToAssetDir(assetDir) {
  if (!fs.existsSync(distLambda) || !fs.existsSync(assetDir)) return;
  const entries = fs.readdirSync(distLambda);
  for (const name of entries) {
    const src = path.join(distLambda, name);
    const dest = path.join(assetDir, name);
    if (fs.statSync(src).isDirectory()) {
      if (fs.existsSync(dest)) {
        try { fs.rmSync(dest, { recursive: true }); } catch (e) {}
      }
    } else if (fs.existsSync(dest) && fs.statSync(dest).isFile()) {
      try { fs.unlinkSync(dest); } catch (e) {}
    }
    copyRecursive(src, dest);
  }
}

function findLambdaAssetDirs() {
  if (!fs.existsSync(cdkOut)) return [];
  const dirs = new Set();
  const entries = fs.readdirSync(cdkOut, { withFileTypes: true });
  for (const e of entries) {
    if (e.isSymbolicLink() && e.name.startsWith('asset.lambda.')) {
      const linkPath = path.join(cdkOut, e.name);
      try {
        const target = fs.readlinkSync(linkPath);
        const resolved = path.resolve(cdkOut, target);
        if (fs.existsSync(resolved)) dirs.add(resolved);
      } catch (err) {}
    }
  }
  return Array.from(dirs);
}

console.log('Building Lambda...');
let build = spawnSync('node', ['scripts/build-lambda.js'], { cwd: repoRoot, stdio: 'inherit' });
if (build.status !== 0) {
  console.error('Initial build failed.');
  process.exit(build.status ?? 1);
}

console.log('Deploying to LocalStack (hot reload)...');
const deploy = spawnSync('node', ['scripts/run-with-localstack.js', 'cdklocal', 'deploy', '--all', '--require-approval', 'never'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env, LOCALSTACK_HOT_RELOAD: '1' },
});
if (deploy.status !== 0) {
  console.error('Deploy failed.');
  process.exit(deploy.status ?? 1);
}

spawnSync('node', ['scripts/echo-localstack-urls.js'], { cwd: repoRoot, stdio: 'inherit' });

const assetDirs = findLambdaAssetDirs();
if (assetDirs.length === 0) {
  console.warn('No Lambda asset dirs found in cdk.out; hot-reload sync may not work.');
} else {
  console.log('Hot reload: syncing dist/lambda to', assetDirs.length, 'asset dir(s).');
}

const DEBOUNCE_MS = 600;
let debounceTimer = null;
function scheduleBuildAndSync(relativePath) {
  console.log(`Change: ${relativePath}`);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const b = spawnSync('node', ['scripts/build-lambda.js'], { cwd: repoRoot, stdio: 'inherit' });
    if (b.status === 0) {
      const dirs = findLambdaAssetDirs();
      dirs.forEach(syncDistToAssetDir);
      if (dirs.length) console.log('Synced to Lambda asset dir(s).');
    }
  }, DEBOUNCE_MS);
}

const watcher = chokidar.watch(serverDir, {
  ignored: [/(^|[\/\\])(node_modules|dist)([\/\\]|$)/, /[\/\\]\./, /package-lock\.json$/],
  persistent: true,
});
watcher.on('ready', () => {
  console.log('Watching server/ source files (build + sync for hot reload). Ignoring node_modules and dist.');
});
watcher.on('change', (p) => scheduleBuildAndSync(path.relative(repoRoot, p)));
watcher.on('add', (p) => scheduleBuildAndSync(path.relative(repoRoot, p)));
