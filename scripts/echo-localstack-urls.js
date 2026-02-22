const fs = require('fs');

const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';

// Parse CDK deploy output for *Stack.ApiUrl = https://... or *RestApiEndpoint* = https://...
function parseDeployOutput(text) {
  const byStack = {};
  const lineRe = /(HelloStack|AuthStack)\.\S+\s*=\s*(https:\/\/[^\s]+)/g;
  let m;
  while ((m = lineRe.exec(text)) !== null) {
    const stackName = m[1];
    const url = m[2].trim();
    const apiId = url.match(/https:\/\/([^.]+)\.execute-api/)?.[1];
    if (!apiId) continue;
    if (!byStack[stackName]) {
      const path = stackName === 'HelloStack' ? 'hello' : 'auth';
      const baseUrl = `${LOCALSTACK_ENDPOINT}/restapis/${apiId}/dev/_user_request_`;
      byStack[stackName] = {
        name: stackName === 'HelloStack' ? 'Hello' : 'Auth',
        baseUrl,
        path,
        url: `${baseUrl}/${path}`,
      };
    }
  }
  return [byStack.HelloStack, byStack.AuthStack].filter(Boolean);
}

function printUrls(items) {
  if (!items.length) {
    console.log('\nNo API URLs found in deploy output.\n');
    return;
  }
  console.log('\n--- LocalStack API URLs ---');
  items.forEach((api) => {
    console.log(`${api.name}: ${api.url}`);
    if (api.name === 'Hello') {
      console.log('  (GET or POST)');
    } else {
      console.log('  (POST)');
    }
  });
  console.log('----------------------------\n');
}

const deployLogPath = process.argv[2];
if (deployLogPath && fs.existsSync(deployLogPath)) {
  const text = fs.readFileSync(deployLogPath, 'utf8');
  const items = parseDeployOutput(text);
  printUrls(items);
} else {
  console.log('\nRun "npm run dev" to deploy and see URLs (deploy output is parsed for API URLs).\n');
}
