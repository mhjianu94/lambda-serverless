# lambda-serverless

AWS Serverless Lambda setup with CDK. Lambdas and API Gateway are defined in `infrastructure/`; runtime code lives in `server/`.

## LocalStack and hot reload

Run the app locally against [LocalStack](https://localstack.cloud/) with optional hot reload so Lambda code changes apply without redeploying.

### One-time setup

1. Start LocalStack and bootstrap CDK:

   ```bash
   npm run setup
   ```

   This runs `docker compose up -d`, waits for LocalStack health, then `cdklocal bootstrap`. Re-run if deploy fails (e.g. after an endpoint change). Endpoints use `127.0.0.1` by default so no `/etc/hosts` changes are required.

LocalStack runs **Hello** and **Auth** only (no VPC, RDS, or DB-backed API). For the full stack including RDS and ApiDb, deploy to real AWS.

### Deploy and run

- **Single deploy (with hot-reload mount):**

  ```bash
  npm run dev
  ```

  Builds the Lambda bundle, deploys all stacks to LocalStack with Lambda code mounted for hot reload, and prints API URLs.

- **Hot reload (no redeploy on save):**

  ```bash
  npm run dev
  npm run dev:watch
  ```

  Run `npm run dev` once so Lambda containers get the code mount, then run `npm run dev:watch`. The watch skips redeploy if asset dirs already exist, so the same container is reused and file changes are synced into the mounted dir (LocalStack reloads code in place). If you run only `npm run dev:watch`, it will deploy once at start and then watch.

- **Build only on save:** `npm run watch`
- **Build + full deploy on save:** `npm run watch:deploy` (no hot-reload mount)

### Environment

Optional overrides (e.g. in `.env`, not committed):

- `LOCALSTACK_ENDPOINT` – default `http://localhost:4566`
- `LOCALSTACK_REGION` / `CDK_DEFAULT_REGION` – default `us-east-1`
- `LOCALSTACK_HOT_RELOAD=1` – enables mount-based hot reload (set automatically by `npm run dev` and `npm run dev:watch`)

### Troubleshooting

- **`getaddrinfo ENOTFOUND ... s3.localhost`** – The bootstrap stack was created with a hostname that doesn’t resolve. Re-bootstrap using `127.0.0.1`: run `npm run destroy`, then `npm run setup`, then `npm run dev`.
- **Hot reload not applying changes** – Ensure the Lambda container has the code dir mounted: `docker inspect <lambda_container>` and check `Mounts`. The source path should be `.../infrastructure/cdk.out/hot-reload/<LogicalId>` (real directory). If you previously used symlink-based mounts, run `npm run dev` once so the stack is updated to use the fixed hot-reload dirs; then `dev:watch` will sync into those dirs and LocalStack’s file watcher can detect changes. Start LocalStack from the project root so `HOST_LAMBDA_DIR` is set (`docker compose up -d` from repo root).

- **502 or “Internal server error” when calling the API (including `https://…execute-api.localhost.localstack.cloud:4566/dev/hello`)** – With hot-reload, Lambda code is mounted from the host; LocalStack can set the container’s working directory to the host path, which does not exist inside the container, so Node throws `ENOENT: uv_cwd` and the API returns 502. **Workaround:** call the API via HTTP with `Host` and avoid relying on the HTTPS URL, or invoke the function directly: `aws --endpoint-url=http://127.0.0.1:4566 lambda invoke --function-name <HelloFunctionName> --payload '{}' out.json && cat out.json`. Example: `curl -s "http://127.0.0.1:4566/dev/hello" -H "Host: <API_ID>.execute-api.localhost.localstack.cloud"` (get `<API_ID>` from stack outputs or deploy log).

### Tear down

```bash
npm run destroy
```

Destroys all CDK stacks in LocalStack and runs `docker compose down`.
