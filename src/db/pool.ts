import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

dotenv.config()

let db: Pool
let sessionSecret: string

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value == null) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return undefined
}

async function fetchSecret(secretId: string): Promise<Record<string, string>> {
  const client = new SecretsManagerClient({ region: "eu-north-1" });
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretId,
      VersionStage: "AWSCURRENT",
    })
  );
  return JSON.parse(response.SecretString ?? '{}');
}

export async function initDb(): Promise<void> {
  let secretValues: Record<string, string> = {};

  if (process.env.NODE_ENV === 'dev') {
    console.log('[db] NODE_ENV=dev, using env vars instead of AWS Secrets Manager');
  } else {
    try {
      secretValues = await fetchSecret("dev/idsclinic/db");
      console.log('[db] loaded credentials from AWS Secrets Manager');
    } catch (err) {
      console.warn('[db] could not fetch AWS secret, falling back to env vars:', (err as Error).message);
    }
  }

  try {
    const sessionSecretValues = await fetchSecret("dev/idsclinic/db/session");
    sessionSecret = sessionSecretValues.SESSION_SECRET ?? process.env.SESSION_SECRET ?? 'dev-secret'
  } catch (err) {
    console.warn('[session] could not fetch session secret, falling back to env vars:', (err as Error).message);
    sessionSecret = process.env.SESSION_SECRET ?? 'dev-secret'
  }

  const host = secretValues.host ?? process.env.DB_HOST ?? 'localhost';
  const explicitSsl = parseBooleanEnv(process.env.DB_SSL);
  const shouldUseSsl = explicitSsl ?? !isLocalHost(host);
  const rejectUnauthorized = parseBooleanEnv(process.env.DB_SSL_REJECT_UNAUTHORIZED) ?? false;

  const config: PoolConfig = {
    host,
    port: Number(secretValues.port) || Number(process.env.DB_PORT) || 5432,
    database: secretValues.engine ?? process.env.DB_NAME ?? 'ids_clinic',
    user: secretValues.username ?? process.env.DB_USER ?? 'postgres',
    password: secretValues.password ?? process.env.DB_PASSWORD ?? '',
    ssl: shouldUseSsl ? { rejectUnauthorized } : undefined,

    max: Number(process.env.DB_POOL_MAX) || 20,
    min: Number(process.env.DB_POOL_MIN) || 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
    statement_timeout: 15_000,
    query_timeout: 15_000,
  };

  db = new Pool(config);

  if (process.env.NODE_ENV !== 'production') {
    db.on('connect', () => console.log('[db] new client connected to pool'));
  }

  db.on('error', (err) => {
    console.error('Unexpected DB pool client error', err);
  });
}

export { db, sessionSecret }
