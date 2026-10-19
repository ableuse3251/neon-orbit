import fs from 'fs';
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

// Parse PostgreSQL DATE (OID 1082) as plain string YYYY-MM-DD to avoid timezone distortion
pg.types.setTypeParser(1082, (val: string) => val);

export let pool: pg.Pool | null = null;
let isDbConnected = false;

export function setDbConnected(connected: boolean) {
  isDbConnected = connected;
}

export function setPool(p: pg.Pool | null) {
  pool = p;
  if (!p) {
    isDbConnected = false;
  }
}

if (config.databaseUrl) {
  try {
    const isServerless = process.env.VERCEL === '1' || process.env.SERVERLESS === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    const defaultPoolMax = isServerless ? 2 : 25;
    const poolMax = Number(process.env.DB_POOL_MAX || defaultPoolMax);
    const isDockerLocal = config.dockerLocalDb;
    const useSsl = config.dbSsl && !isDockerLocal && (config.nodeEnv === 'production' || Boolean(config.dbSslCa));
    let sslConfig: boolean | pg.ConnectionConfig['ssl'] = false;

    const isSupabase = config.databaseUrl.includes('supabase.com') || config.databaseUrl.includes('supabase.co');
    if (useSsl) {
      let ca: string | undefined = undefined;
      if (config.dbSslCa) {
        if (fs.existsSync(config.dbSslCa)) {
          ca = fs.readFileSync(config.dbSslCa, 'utf-8');
        } else {
          ca = config.dbSslCa;
        }
      }
      sslConfig = {
        rejectUnauthorized: ca ? config.dbSslRejectUnauthorized : (isSupabase ? false : config.dbSslRejectUnauthorized),
        ca,
      };
    }

    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: sslConfig,
      max: poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL client error:', err);
      isDbConnected = false;
    });
  } catch (err) {
    console.warn('PostgreSQL pool initialization failed, falling back to mock DB:', err);
    pool = null;
  }
} else {
  console.info('No DATABASE_URL provided. Running in DB fallback mode.');
}

let customQueryHandler: ((text: string, params?: unknown[]) => Promise<pg.QueryResult<any>>) | null = null;
let customTransactionHandler: (<T>(callback: (client: pg.PoolClient) => Promise<T>) => Promise<T>) | null = null;

export function setCustomQueryHandler(handler: typeof customQueryHandler) {
  customQueryHandler = handler;
}

export function setCustomTransactionHandler(handler: typeof customTransactionHandler) {
  customTransactionHandler = handler;
}

/**
 * Execute SQL Query with error handling and fallback
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  if (customQueryHandler) {
    return customQueryHandler(text, params);
  }

  if (pool) {
    try {
      const res = await pool.query<T>(text, params);
      isDbConnected = true;
      return res;
    } catch (err) {
      console.error('Database query error:', err);
      // If connection-level error, mark as disconnected
      if ((err as any).code && ['ECONNREFUSED', 'ETIMEDOUT', '57P01', '08006', '08001'].includes((err as any).code)) {
        isDbConnected = false;
      }
      throw err;
    }
  }

  // Fallback mock response for dev when DB is not connected
  return {
    rows: [],
    rowCount: 0,
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
}

/**
 * Execute queries in a transaction
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (customTransactionHandler) {
    return customTransactionHandler(callback as any);
  }

  if (!pool) {
    throw new Error('Database pool is not initialized for transaction execution.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    isDbConnected = true;
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check DB health status
 */
export async function checkDbHealth(): Promise<{ status: 'ok' | 'degraded' | 'disabled'; message?: string }> {
  if (!pool) {
    return { status: 'disabled', message: 'No DATABASE_URL configured (Fallback mode)' };
  }

  try {
    const res = await pool.query('SELECT 1 as alive');
    if (res.rows[0]?.alive === 1 || res.rows[0]?.['?column?'] === 1) {
      isDbConnected = true;
      return { status: 'ok' };
    }
    isDbConnected = false;
    return { status: 'degraded', message: 'Unexpected response from database' };
  } catch (err) {
    isDbConnected = false;
    return { status: 'degraded', message: (err as Error).message };
  }
}

export function isDbActive(): boolean {
  return isDbConnected && pool !== null;
}
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
  }
  isDbConnected = false;
}
