const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');

const endpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
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

async function main() {
  try {
    const out = await client.send(new DescribeStacksCommand({}));
    const outputs = (out.Stacks || []).flatMap((s) => (s.Outputs || []).map((o) => ({ Key: o.OutputKey, Value: o.OutputValue })));
    const apiUrls = outputs.filter((o) => o.Key && o.Key.includes('ApiUrl') && o.Value);
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

main();
