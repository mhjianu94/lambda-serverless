# lambda-serverless

AWS Serverless Lambda setup with CDK. Lambdas and API Gateway are defined in `infrastructure/`; runtime code lives in `server/`.

## LocalStack and hot reload

Run the app locally against [LocalStack](https://localstack.cloud/) with optional hot reload so Lambda code changes apply without redeploying.

### One-time setup

1. Start LocalStack and bootstrap CDK:

   ```bash
   npm run setup
   ```

   This runs `docker compose up -d`, waits for LocalStack health, then `cdklocal bootstrap`. Re-run if deploy fails due to hosts or bootstrap.

### Deploy and run

- **Single deploy (with hot-reload mount):**

  ```bash
  npm run dev
  ```

  Builds the Lambda bundle, deploys all stacks to LocalStack with Lambda code mounted for hot reload, and prints API URLs.

- **Hot reload (no redeploy on save):**

  ```bash
  npm run dev:watch
  ```

  Builds once, deploys once, then watches `server/`. On change it rebuilds and syncs `dist/lambda` into the mounted asset dir; LocalStack picks up changes and reloads Lambda code.

- **Build only on save:** `npm run watch`
- **Build + full deploy on save:** `npm run watch:deploy` (no hot-reload mount)

### Environment

Optional overrides (e.g. in `.env`, not committed):

- `LOCALSTACK_ENDPOINT` – default `http://localhost:4566`
- `LOCALSTACK_REGION` / `CDK_DEFAULT_REGION` – default `us-east-1`
- `LOCALSTACK_HOT_RELOAD=1` – enables mount-based hot reload (set automatically by `npm run dev` and `npm run dev:watch`)

### Tear down

```bash
npm run destroy
```

Destroys all CDK stacks in LocalStack and runs `docker compose down`.
