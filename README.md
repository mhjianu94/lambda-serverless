# AWS Serverless Lambda Setup with CDK

This project contains a serverless AWS Lambda function setup using AWS CDK (Cloud Development Kit) for infrastructure as code with CloudFormation.

## Prerequisites

1. **Node.js and npm**
   ```bash
   node --version  # Should be v18 or higher
   npm --version
   ```

2. **AWS CLI** configured with your credentials
   ```bash
   aws configure
   ```
   You'll need:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region (e.g., us-east-1)
   - Default output format (json)

3. **AWS CDK CLI** installed globally
   ```bash
   npm install -g aws-cdk
   ```

4. **Bootstrap CDK** (first time only, per account/region)
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   # or use your default account/region
   cdk bootstrap
   ```

## Project Structure

```
.
├── .github/
│   └── workflows/
│       ├── deploy.yml            # Automatic deployment workflow
│       └── deploy-manual.yml     # Manual deployment workflow
├── infrastructure/               # CDK app and stack definitions
│   ├── bin/
│   │   └── app.ts               # CDK app entry point
│   ├── lib/
│   │   ├── api/                 # API Gateway constructs
│   │   ├── lambdas/             # Lambda constructs
│   │   └── stacks/             # HelloService, AuthService
│   ├── cdk.json
│   ├── tsconfig.json
│   └── package.json             # CDK dependencies
├── server/                       # Application and Lambda handlers
│   └── lambda/
│       └── handler.js            # Lambda function handler
├── scripts/
│   └── run-with-localstack.js   # Run CDK against LocalStack
├── docker-compose.yml            # LocalStack for local dev
├── package.json                  # Root scripts (delegates to infrastructure)
└── README.md
```

## Setup

1. **Install dependencies** (root and infrastructure)
   ```bash
   npm install
   cd infrastructure && npm install && cd ..
   ```

2. **Compile TypeScript** (builds infrastructure)
   ```bash
   npm run build
   ```

## Deployment

### Deploy to AWS

```bash
npm run deploy
# or
cdk deploy
```

This will:
- Synthesize CloudFormation templates
- Create/update the Lambda function
- Set up API Gateway REST API
- Configure CloudWatch Log Groups
- Deploy all resources via CloudFormation

### Preview changes before deploying

```bash
cdk diff
```

### Synthesize CloudFormation template

```bash
npm run synth
# or
cdk synth
```

This generates CloudFormation templates in `cdk.out/` without deploying.

## Local development with LocalStack

You can run the full stack (Lambda + API Gateway) locally using [LocalStack](https://localstack.cloud/), so you can develop and test without deploying to AWS.

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

1. **One-time setup** (start LocalStack, configure hosts, bootstrap CDK)
   ```bash
   npm run setup
   ```
   Wait until LocalStack is ready (about 20 seconds). If deploy later fails with host resolution errors, re-run `npm run setup` or add the printed lines to `/etc/hosts`.

2. **Deploy and get API URLs**
   ```bash
   npm run dev
   ```
   This deploys both stacks to LocalStack and prints the Hello and Auth API URLs (and the path-style form for `curl`).

3. **Optional: watch Lambda code**
   - `npm run dev:watch` – build lambda, start file watcher in background, then deploy once.
   - `npm run watch` – build lambda on save only (for hot-reload setups).
   - `npm run watch:deploy` – build + redeploy on save (slower but reliable when hot-reload does not apply).

4. **Call your API locally**
   Use the URLs printed by `npm run dev`, or the path form:  
   `http://localhost:4566/restapis/<api-id>/dev/_user_request_/hello` (and `/auth` for Auth).

5. **Tear down**
   ```bash
   npm run destroy
   ```

**Scripts:**

| Script | Description |
|--------|-------------|
| `npm run setup` | One-time: start LocalStack, hosts, bootstrap |
| `npm run dev` | Deploy to LocalStack and print API URLs |
| `npm run dev:watch` | Build lambda, watch in background, then deploy |
| `npm run watch` | Build lambda on save only |
| `npm run watch:deploy` | Build + deploy on save only |
| `npm run destroy` | Tear down stacks and stop Docker |

To use a different LocalStack endpoint (e.g. custom port), set `LOCALSTACK_ENDPOINT` before running setup or dev:

```bash
LOCALSTACK_ENDPOINT=http://localhost:4567 npm run dev
```

## GitHub Actions Deployment

This project includes GitHub Actions workflows for automated deployment.

### Setup GitHub Secrets

Before using GitHub Actions, you need to configure the following secrets in your GitHub repository:

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Add the following secrets:

   - `AWS_ACCESS_KEY_ID` - Your AWS access key ID
   - `AWS_SECRET_ACCESS_KEY` - Your AWS secret access key
   - `AWS_ACCOUNT_ID` - Your AWS account ID (12-digit number)
   - `AWS_REGION` (optional) - AWS region to deploy to (defaults to `us-east-1`)

### Workflows

#### 1. Automatic Deployment (`deploy.yml`)

Automatically deploys when you push to `main` or `master` branch:

- Triggers on push to `main`/`master`
- Can also be triggered manually from GitHub Actions tab
- Uses region from `AWS_REGION` secret or defaults to `us-east-1`

#### 2. Manual Deployment (`deploy-manual.yml`)

Allows you to manually trigger deployment with custom parameters:

- Go to **Actions** tab → **Deploy to AWS (Manual)** → **Run workflow**
- Select region from dropdown
- Enter environment name
- Click **Run workflow**

### Workflow Steps

Both workflows perform the following steps:

1. ✅ Checkout code
2. ✅ Setup Node.js 18.x
3. ✅ Install dependencies (`npm ci`)
4. ✅ Build TypeScript (`npm run build`)
5. ✅ Configure AWS credentials
6. ✅ Install CDK CLI
7. ✅ Bootstrap CDK (if needed, continues on error)
8. ✅ Synthesize CloudFormation template (`cdk synth`)
9. ✅ Deploy to AWS (`cdk deploy`)

### Viewing Deployment Status

- Go to the **Actions** tab in your GitHub repository
- Click on a workflow run to see detailed logs
- Green checkmark ✅ = successful deployment
- Red X ❌ = deployment failed (check logs for details)

### Troubleshooting GitHub Actions

1. **Authentication errors**: Verify your AWS secrets are correctly set
2. **Bootstrap errors**: The workflow attempts to bootstrap automatically, but you may need to bootstrap manually first:
   ```bash
   cdk bootstrap aws://ACCOUNT-ID/REGION
   ```
3. **Permission errors**: Ensure your AWS IAM user/role has permissions for:
   - CloudFormation (full access)
   - S3 (for CDK bootstrap bucket)
   - IAM (for creating roles)
   - Lambda, API Gateway, CloudWatch Logs

## Testing

### Test the API endpoint

After deployment, CDK will output the API Gateway URL. Test it with:

```bash
# GET request
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/hello

# POST request
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/hello \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Test Lambda function directly

```bash
aws lambda invoke \
  --function-name <function-name> \
  --payload '{"test": "data"}' \
  response.json
```

## Monitoring

### View CloudWatch Logs

```bash
aws logs tail /aws/lambda/hello-function --follow
```

Or view in AWS Console: CloudWatch → Log Groups → `/aws/lambda/hello-function`

## Removal

To remove all deployed resources:

```bash
npm run destroy
# or
cdk destroy
```

## Configuration

### Modify the Stacks

There are two main services: **HelloService** (hello Lambda + /hello API) and **AuthService** (auth Lambda + /auth API).

- **HelloService**: `infrastructure/lib/stacks/hello.ts` and `lib/lambdas/hello.ts`, `lib/api/hello.ts`
- **AuthService**: `infrastructure/lib/stacks/auth.ts` and `lib/lambdas/auth.ts`, `lib/api/auth.ts`

Edit these to change Lambda configuration (memory, timeout, env vars), add API routes, or add resources (S3, DynamoDB, etc.). Deploy both with `npm run deploy` or one service with `cdk deploy HelloService` or `cdk deploy AuthService`.

### Change AWS Region/Account

Edit `infrastructure/bin/app.ts` to modify the stack environment:

```typescript
env: {
  account: 'YOUR-ACCOUNT-ID',
  region: 'us-west-2',
}
```

Or use environment variables:
```bash
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-west-2
```

## Current Resources

This stack includes:

1. **Lambda Function** (`HelloFunction`)
   - Node.js 18.x runtime
   - 512 MB memory
   - 30 second timeout
   - Environment variable: `STAGE=dev`

2. **API Gateway REST API** (`HelloApi`)
   - REST API with CORS enabled
   - Stage: `dev`
   - Logging enabled
   - Endpoints:
     - `GET /hello`
     - `POST /hello`

3. **CloudWatch Log Group** (`HelloLambdaLogGroup`)
   - Log retention: 7 days
   - Automatic log creation for Lambda

## Adding More AWS Resources

You can easily add more AWS resources to the stack. Examples:

### Add S3 Bucket

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';

const bucket = new s3.Bucket(this, 'MyBucket', {
  bucketName: 'my-unique-bucket-name',
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

### Add DynamoDB Table

```typescript
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

const table = new dynamodb.Table(this, 'MyTable', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
});
```

### Add SQS Queue

```typescript
import * as sqs from 'aws-cdk-lib/aws-sqs';

const queue = new sqs.Queue(this, 'MyQueue', {
  visibilityTimeout: cdk.Duration.seconds(300),
});
```

## Troubleshooting

1. **Bootstrap errors**: Make sure you've run `cdk bootstrap` for your AWS account/region.

2. **Permission errors**: Ensure your AWS credentials have the necessary permissions for:
   - CloudFormation
   - Lambda
   - API Gateway
   - IAM (for creating roles)
   - CloudWatch Logs

3. **TypeScript compilation errors**: Run `npm run build` to check for TypeScript errors.

4. **CDK version mismatch**: Ensure `aws-cdk` CLI version matches `aws-cdk-lib` in package.json.

5. **Deployment failures**: Check CloudFormation console for detailed error messages.

## Useful Commands

- `npm run build` - Compile TypeScript
- `npm run watch` - Watch for changes and compile
- `npm run deploy` - Deploy stack to AWS
- `npm run synth` - Synthesize CloudFormation template
- `npm run diff` - Compare deployed stack with current state
- `npm run destroy` - Destroy stack
- `cdk ls` - List all stacks
- `cdk doctor` - Check CDK setup
