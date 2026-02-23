const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const chokidar = require('chokidar');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const distLambda = path.join(repoRoot, 'dist', 'lambda');
const cdkOut = path.join(repoRoot, 'infrastructure', 'cdk.out');

function copyRecursive(src, dest) {
  let stat;
  try {
    stat = fs.statSync(src);
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const names = fs.readdirSync(src);
    for (const name of names) {
      const s = path.join(src, name);
      const d = path.join(dest, name);
      try {
        copyRecursive(s, d);
      } catch (err) {
        if (err.code === 'ENOENT') continue;
        throw err;
      }
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
    try {
      const srcStat = fs.statSync(src);
      if (srcStat.isDirectory()) {
        if (fs.existsSync(dest)) {
          try { fs.rmSync(dest, { recursive: true }); } catch (e) {}
        }
      } else if (fs.existsSync(dest)) {
        try {
          if (fs.statSync(dest).isFile()) fs.unlinkSync(dest);
        } catch (e) {}
      }
      copyRecursive(src, dest);
    } catch (e) {
      if (e.code === 'ENOENT') continue;
      console.warn('Sync skip', src, e.message);
    }
  }
}

function ensureLambdaSymlinks() {
  if (!fs.existsSync(cdkOut)) return;
  const templateFiles = fs.readdirSync(cdkOut).filter((n) => n.endsWith('.template.json'));
  for (const name of templateFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(cdkOut, name), 'utf8'));
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
}

function findLambdaAssetDirs() {
  if (!fs.existsSync(cdkOut)) return [];
  const hotReloadDir = path.join(cdkOut, 'hot-reload');
  if (fs.existsSync(hotReloadDir)) {
    const names = fs.readdirSync(hotReloadDir, { withFileTypes: true });
    const dirs = names.filter((e) => e.isDirectory()).map((e) => path.join(hotReloadDir, e.name));
    if (dirs.length > 0) return dirs;
  }
  const firstPass = [];
  const entries = fs.readdirSync(cdkOut, { withFileTypes: true });
  for (const e of entries) {
    if (e.isSymbolicLink() && e.name.startsWith('asset.lambda.')) {
      const linkPath = path.join(cdkOut, e.name);
      try {
        const target = fs.readlinkSync(linkPath);
        const resolved = path.resolve(cdkOut, target);
        if (fs.existsSync(resolved)) firstPass.push(resolved);
      } catch (err) {}
    }
  }
  if (firstPass.length > 0) return [...new Set(firstPass)];
  ensureLambdaSymlinks();
  const dirs = new Set();
  const entries2 = fs.readdirSync(cdkOut, { withFileTypes: true });
  for (const e of entries2) {
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

ensureLambdaSymlinks();
let assetDirs = findLambdaAssetDirs();
if (assetDirs.length === 0) {
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
  assetDirs = findLambdaAssetDirs();
} else {
  console.log('Using existing deploy (asset dirs found). No redeploy - same Lambda container will be used for hot reload.');
  spawnSync('node', ['scripts/echo-localstack-urls.js'], { cwd: repoRoot, stdio: 'inherit' });
}
if (assetDirs.length === 0) {
  console.warn('No Lambda asset dirs found in cdk.out; hot-reload sync may not work.');
  console.warn('Ensure you deployed with npm run dev (hot-reload) so asset.lambda.* symlinks exist.');
} else {
  console.log('Hot reload: will sync dist/lambda to', assetDirs.length, 'asset dir(s) on change (no redeploy).');
  assetDirs.forEach((d, i) => console.log('  [' + (i + 1) + ']', d));
  console.log('(Same path is mounted in Lambda container - verify with: docker inspect <lambda-container> --format "{{json .Mounts}}")');
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
      if (dirs.length === 0) {
        console.warn('No asset dirs to sync to; hot-reload may not work. Run initial deploy with hot reload (npm run dev) first.');
        return;
      }
      dirs.forEach(syncDistToAssetDir);
      console.log('Synced to', dirs.length, 'Lambda asset dir(s). Same container should pick up changes (no new deploy).');
    } else {
      console.warn('Build failed; skipping sync.');
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
