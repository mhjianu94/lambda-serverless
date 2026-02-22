const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'server', 'lambda');
const dest = path.join(root, 'dist', 'lambda');
const cdkOut = path.join(root, 'infrastructure', 'cdk.out');

if (!fs.existsSync(src)) {
  console.error('Source not found:', src);
  process.exit(1);
}

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      copyRecursive(path.join(from, name), path.join(to, name));
    }
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

/** Remove directory contents recursively (keeps the root dir to avoid ENOTEMPTY when dir is in use). Ignores ENOENT (race with another process). */
function emptyDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        fs.rmSync(p, { recursive: true });
      } else {
        fs.unlinkSync(p);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

/** Copy source dir contents into an existing target dir (merge/overwrite). */
function syncInto(from, to) {
  if (!fs.existsSync(to)) return;
  for (const name of fs.readdirSync(from)) {
    const fromPath = path.join(from, name);
    const toPath = path.join(to, name);
    const stat = fs.statSync(fromPath);
    if (stat.isDirectory()) {
      if (!fs.existsSync(toPath)) fs.mkdirSync(toPath, { recursive: true });
      syncInto(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

/** Find Lambda code asset dirs from stack assets.json files and sync our code into them so LocalStack mount sees updates. */
function syncCdkOutAssets() {
  if (!fs.existsSync(cdkOut)) return;
  const lambdaAssetDirs = new Set();
  for (const name of fs.readdirSync(cdkOut)) {
    if (!name.endsWith('.assets.json')) continue;
    const filePath = path.join(cdkOut, name);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
      continue;
    }
    const files = data.files || {};
    for (const asset of Object.values(files)) {
      const displayName = (asset.displayName || '').toString();
      const srcPath = asset.source && asset.source.path;
      if (!displayName.includes('Code') || !srcPath || !srcPath.startsWith('asset.')) continue;
      const dir = path.join(cdkOut, srcPath);
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        lambdaAssetDirs.add(dir);
      }
    }
  }
  for (const dir of lambdaAssetDirs) {
    syncInto(src, dir);
    console.log('Lambda built: synced into', path.relative(root, dir));
  }
}

if (fs.existsSync(dest)) emptyDir(dest);
else fs.mkdirSync(path.dirname(dest), { recursive: true });
copyRecursive(src, dest);
console.log('Lambda built:', src, '->', dest);
syncCdkOutAssets();
