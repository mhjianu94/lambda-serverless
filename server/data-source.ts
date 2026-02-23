import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { User } from './entity/User';

let dataSourcePromise: Promise<DataSource> | null = null;

interface DbSecret {
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  dbname?: string;
  engine?: string;
}

async function getDbCredentialsFromSecrets(): Promise<DbSecret> {
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable is not set');
  }
  const client = new SecretsManagerClient({});
  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await client.send(command);
  if (!response.SecretString) {
    throw new Error('Secret has no SecretString');
  }
  return JSON.parse(response.SecretString) as DbSecret;
}

function getLocalDbConfig(): { host: string; port: number; database: string; username: string; password: string } {
  const host = process.env.DB_HOST;
  const username = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME ?? 'postgres';
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
  if (!host || !username || !password) {
    throw new Error('Local DB requires DB_HOST, DB_USER, and DB_PASSWORD (optionally DB_NAME, DB_PORT)');
  }
  return { host, port, database, username, password };
}

export async function getDataSource(): Promise<DataSource> {
  if (dataSourcePromise) {
    return dataSourcePromise;
  }
  let host: string;
  let port: number;
  let database: string;
  let username: string;
  let password: string;

  if (process.env.DB_SECRET_ARN) {
    const creds = await getDbCredentialsFromSecrets();
    host = process.env.DB_PROXY_ENDPOINT || creds.host ?? '';
    port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : creds.port ?? 5432;
    database = creds.dbname ?? 'postgres';
    username = creds.username ?? '';
    password = creds.password ?? '';
    if (!host || !username || !password) {
      throw new Error('Database secret must contain host, username and password');
    }
  } else {
    const local = getLocalDbConfig();
    host = local.host;
    port = local.port;
    database = local.database;
    username = local.username;
    password = local.password;
  }

  const ds = new DataSource({
    type: 'postgres',
    host,
    port,
    database,
    username,
    password,
    entities: [User],
    migrations: [],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    logging: false,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });

  dataSourcePromise = ds.initialize();
  return dataSourcePromise;
}
