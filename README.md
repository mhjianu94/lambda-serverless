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

## Local development with SAM

Run the API locally using AWS SAM CLI (no deploy). Requires **Docker** and **SAM CLI** installed.

- **SAM CLI**: e.g. `brew install aws-sam-cli`. The command is `sam` (not `aws-sam-cli`). If `sam` is not found, add Homebrew’s bin to PATH, e.g. add to `~/.zshrc`: `eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"` then restart the terminal or `source ~/.zshrc`.
- **Docker**: must be running for `sam local`.

1. Build the Lambda bundle and SAM artifacts (from repo root):

   ```bash
   npm run local:build
   ```

2. Start the local API (listens on port 3000 by default):

   ```bash
   npm run local:start
   ```

3. For **DB-backed routes** (`/db`, `/users`, `/users/{id}`), run a local Postgres (e.g. Docker) and provide env vars. Copy `dev/env.json.example` to `dev/env.json`, set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (and optionally `DB_PORT`). On Linux use `host.docker.internal` for `DB_HOST` to reach the host from Lambda containers, or the container IP. Then:

   ```bash
   sam local start-api --config-file dev/samconfig.toml --env-vars dev/env.json
   ```

4. Run migrations locally (with DB env vars):

   ```bash
   sam local invoke MigrationFunction --config-file dev/samconfig.toml --env-vars dev/env.json
   ```

Deploy to AWS still uses CDK from `infrastructure/`; the SAM template in `dev/` is for local use only.

## Layout

- **infrastructure/** – CDK stacks (Hello, Auth, ApiDb, etc.), Lambda constructs, API Gateway.
- **server/** – Lambda handler source (TypeScript); built to `dist/lambda/` by `build:lambda`.
- **scripts/** – `build-lambda.js` (builds the Lambda bundle used by CDK).
- **dev/** – SAM template and config for local development (`template.yaml`, `samconfig.toml`, `env.json.example`).
