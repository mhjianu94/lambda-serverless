const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const distLambda = path.join(repoRoot, 'dist', 'lambda');
const serverDist = path.join(serverDir, 'dist');
const serverNodeModules = path.join(serverDir, 'node_modules');

function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  if (process.platform === 'win32') {
    const { rimrafSync } = require('rimraf');
    rimrafSync(dir);
  } else {
    spawnSync('rm', ['-rf', dir], { cwd: repoRoot, stdio: 'ignore' });
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
execSync('npx tsc', { cwd: serverDir, stdio: 'inherit' });

if (!fs.existsSync(serverDist)) {
  console.error('server/dist not found after build');
  process.exit(1);
}

removeDir(distLambda);
fs.mkdirSync(distLambda, { recursive: true });
copyRecursive(serverDist, distLambda);

if (fs.existsSync(serverNodeModules)) {
  copyRecursive(serverNodeModules, path.join(distLambda, 'node_modules'));
}

const makefile = `build-HelloFunction:
\tcp -r . $(ARTIFACTS_DIR)
build-AuthFunction:
\tcp -r . $(ARTIFACTS_DIR)
build-UsersReadFunction:
\tcp -r . $(ARTIFACTS_DIR)
build-UsersWriteFunction:
\tcp -r . $(ARTIFACTS_DIR)
build-MigrationFunction:
\tcp -r . $(ARTIFACTS_DIR)
`;
fs.writeFileSync(path.join(distLambda, 'Makefile'), makefile);

console.log('Lambda asset built:', distLambda);
