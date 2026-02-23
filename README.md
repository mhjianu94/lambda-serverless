# lambda-serverless

AWS Serverless Lambda setup with CDK. Lambdas and API Gateway are defined in `infrastructure/`; runtime code lives in `server/`.

## Build

- **Lambda bundle:** `npm run build:lambda` – builds the server (TypeScript) and outputs `dist/lambda/` for CDK asset.
- **Infrastructure:** `npm run build` – compiles CDK (TypeScript) in `infrastructure/`.
- **Synth:** `npm run test:build` – build infra and run `cdk synth`.

## Deploy to AWS

From `infrastructure/`:

```bash
cd infrastructure
npx cdk bootstrap   # once per account/region
npx cdk deploy --all --require-approval never
```

Set `AWS_PROFILE` or env vars as needed for your AWS account.

## Layout

- **infrastructure/** – CDK stacks (Hello, Auth, ApiDb, etc.), Lambda constructs, API Gateway.
- **server/** – Lambda handler source (TypeScript); built to `dist/lambda/` by `build:lambda`.
- **scripts/** – `build-lambda.js` (builds the Lambda bundle used by CDK).
