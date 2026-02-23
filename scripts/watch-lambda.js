const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const chokidar = require('chokidar');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const distLambda = path.join(repoRoot, 'dist', 'lambda');
const cdkOut = path.join(repoRoot, 'infrastructure', 'cdk.out');
const DEBOUNCE_MS = 600;

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

function findLambdaAssetDirs() {
  if (!fs.existsSync(cdkOut)) return [];
  const hotReloadDir = path.join(cdkOut, 'hot-reload');
  if (fs.existsSync(hotReloadDir)) {
    const names = fs.readdirSync(hotReloadDir, { withFileTypes: true });
    const dirs = names.filter((e) => e.isDirectory()).map((e) => path.join(hotReloadDir, e.name));
    if (dirs.length > 0) return dirs;
  }
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

function runBuild() {
  const child = spawn('node', ['scripts/build-lambda.js'], { cwd: repoRoot, stdio: 'inherit' });
  child.on('close', (code) => {
    if (code !== 0) {
      process.stderr.write(`build-lambda exited with ${code}\n`);
      return;
    }
    const assetDirs = findLambdaAssetDirs();
    if (assetDirs.length > 0) {
      assetDirs.forEach(syncDistToAssetDir);
      console.log('Synced to Lambda asset dir(s); call the API to see changes.');
    }
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
  console.log('Watching server/ (build + sync to Lambda asset dir for hot reload). Ignoring node_modules and dist.');
  const dirs = findLambdaAssetDirs();
  if (dirs.length > 0) console.log('Lambda asset dirs found; changes will be synced after each build.');
  else console.log('Run npm run dev once so Lambda has a mount, then save a file to test.');
  spawnSync('node', ['scripts/echo-localstack-urls.js'], { cwd: repoRoot, stdio: 'inherit' });
});
watcher.on('change', (p) => scheduleBuild(path.relative(repoRoot, p)));
watcher.on('add', (p) => scheduleBuild(path.relative(repoRoot, p)));
