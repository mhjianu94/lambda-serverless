import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { User } from './entity/User';
import { CreateUsersTable1730000000000 } from './migrations/CreateUsersTable1730000000000';

let dataSourcePromise: Promise<DataSource> | null = null;

interface DbSecret {
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  dbname?: string;
  engine?: string;
}

async function getDbCredentials(): Promise<DbSecret> {
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

export async function getDataSource(): Promise<DataSource> {
  if (dataSourcePromise) {
    return dataSourcePromise;
  }
  const host = process.env.DB_PROXY_ENDPOINT || (await getDbCredentials()).host;
  if (!host) {
    throw new Error('DB_PROXY_ENDPOINT or secret host must be set');
  }
  const creds = await getDbCredentials();
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : creds.port ?? 5432;
  const database = creds.dbname ?? 'postgres';
  const username = creds.username;
  const password = creds.password;
  if (!username || !password) {
    throw new Error('Database secret must contain username and password');
  }

  const ds = new DataSource({
    type: 'postgres',
    host,
    port,
    database,
    username,
    password,
    entities: [User],
    migrations: [CreateUsersTable1730000000000],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    logging: false,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });

  dataSourcePromise = ds.initialize();
  return dataSourcePromise;
}
