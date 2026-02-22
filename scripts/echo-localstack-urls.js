const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');

const endpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL || 'http://127.0.0.1:4566';
const region = process.env.LOCALSTACK_REGION || process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';

const client = new CloudFormationClient({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
  forcePathStyle: true,
});

function getOutputs(stacks) {
  const out = [];
  for (const s of stacks || []) {
    const outputs = s.Outputs || s.outputs || [];
    for (const o of outputs) {
      const key = o.OutputKey || o.outputKey;
      const value = o.OutputValue ?? o.outputValue;
      if (key && value) out.push({ Key: key, Value: value });
    }
  }
  return out;
}

async function main() {
  try {
    const out = await client.send(new DescribeStacksCommand({}));
    const stacks = out.Stacks || out.stacks || [];
    const outputs = getOutputs(stacks);
    const apiUrls = outputs.filter((o) => String(o.Key).includes('ApiUrl') && o.Value);
    if (apiUrls.length === 0) {
      console.log('No API URLs found. Deploy first: npm run setup (once), then npm run dev');
      return;
    }
    console.log('\n--- API endpoints (test with curl or your HTTP client) ---');
    apiUrls.forEach(({ Key, Value }) => console.log(`  ${Key}: ${Value}`));
    console.log('---\n');
  } catch (e) {
    console.error('Failed to get stack outputs:', e.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Failed to get stack outputs:', e.message);
  process.exit(1);
});
