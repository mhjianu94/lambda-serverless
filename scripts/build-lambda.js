const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const distLambda = path.join(repoRoot, 'dist', 'lambda');
const serverDist = path.join(serverDir, 'dist');
const serverNodeModules = path.join(serverDir, 'node_modules');

function rimraf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(serverDir)) {
  console.error('server/ directory not found');
  process.exit(1);
}

if (!fs.existsSync(path.join(serverDir, 'package.json'))) {
  console.error('server/package.json not found');
  process.exit(1);
}

console.log('Installing server dependencies...');
execSync('npm install', { cwd: serverDir, stdio: 'inherit' });

console.log('Building server (TypeScript)...');
execSync('npm run build', { cwd: serverDir, stdio: 'inherit' });

if (!fs.existsSync(serverDist)) {
  console.error('server/dist not found after build');
  process.exit(1);
}

rimraf(distLambda);
fs.mkdirSync(distLambda, { recursive: true });
copyRecursive(serverDist, distLambda);

if (fs.existsSync(serverNodeModules)) {
  copyRecursive(serverNodeModules, path.join(distLambda, 'node_modules'));
}

console.log('Lambda asset built:', distLambda);
