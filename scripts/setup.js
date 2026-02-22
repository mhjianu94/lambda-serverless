const path = require('path');
const { execSync, spawnSync } = require('child_process');
const http = require('http');

const repoRoot = path.resolve(__dirname, '..');
const endpoint = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
const healthUrl = new URL('/_localstack/health', endpoint);

async function main() {
  console.log('Starting LocalStack...');
  execSync('docker compose up -d', { cwd: repoRoot, stdio: 'inherit' });

  console.log('Waiting for LocalStack health...');
  const host = healthUrl.hostname;
  const port = parseInt(healthUrl.port || '4566', 10);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get(`http://${host}:${port}/_localstack/health`, (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(false);
        });
      });
      if (ok) {
        console.log('LocalStack is ready.');
        break;
      }
    } catch (e) {}
    if (i === 29) {
      console.error('LocalStack did not become ready in time.');
      process.exit(1);
    }
  }

  console.log('Bootstrapping CDK...');
  const r = spawnSync('node', ['scripts/run-with-localstack.js', 'cdklocal', 'bootstrap'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
