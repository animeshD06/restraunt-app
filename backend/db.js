const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DEFAULT_SCHEMA = process.env.PG_SCHEMA || 'restaurant_app';
const STATUS_VALUES = ['pending', 'preparing', 'served', 'paid', 'cancelled'];
let initializationPromise = null;
let pool = null;
let activeDriver = null;

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function buildPoolConfig() {
  const sslMode = process.env.PG_SSL_MODE;
  const shouldUseSsl =
    sslMode === 'require' ||
    process.env.DATABASE_URL?.includes('sslmode=require');

  const config = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
      }
    : {
        host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
        database: process.env.PGDATABASE || process.env.DB_NAME || 'restaurant_db',
      };

  if (shouldUseSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  config.max = Number(process.env.PGPOOL_MAX || 10);
  config.idleTimeoutMillis = Number(process.env.PG_IDLE_TIMEOUT_MS || 30000);
  config.connectionTimeoutMillis = Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000);

  return config;
}

function isSelectQuery(sql) {
  const normalized = sql.trim().toUpperCase();
  return normalized.startsWith('SELECT') || normalized.startsWith('WITH');
}

function toPostgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizeSql(sql) {
  const trimmed = sql.trim();
  const placeholderSql = toPostgresPlaceholders(trimmed);

  if (/^INSERT\s+/i.test(trimmed) && !/\bRETURNING\b/i.test(trimmed)) {
    return `${placeholderSql} RETURNING id`;
  }

  return placeholderSql;
}

async function runOnClient(client, sql, params = []) {
  await ensureInitialized();
  const normalizedSql = normalizeSql(sql);
  const result = await client.query(normalizedSql, params);

  if (isSelectQuery(sql)) {
    return [result.rows];
  }

  return [
    {
      insertId: result.rows[0]?.id ?? null,
      affectedRows: result.rowCount,
      rows: result.rows,
    },
  ];
}

function createMemoryPool() {
  const { newDb } = require('pg-mem');
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = mem.adapters.createPg();
  return new adapter.Pool();
}

function sanitizeSetupSqlForMemory(sql) {
  return sql
    .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$ LANGUAGE plpgsql;\s*/g, '')
    .replace(/CREATE TRIGGER[\s\S]*?EXECUTE FUNCTION set_updated_at\(\);\s*/g, '')
    .replace(/DROP SCHEMA IF EXISTS restaurant_app CASCADE;\s*/g, '')
    .replace(/CREATE SCHEMA restaurant_app;\s*/g, '')
    .replace(/SET search_path TO restaurant_app, public;\s*/g, '')
    .replace(/,\s*CHECK\s*\(BTRIM\([^)]+\)\s*<>\s*''\)/g, '')
    .replace(/,\s*CONSTRAINT\s+[A-Za-z0-9_]+\s+CHECK\s*\(BTRIM\([^)]+\)\s*<>\s*''\)/g, '');
}

async function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (activeDriver === 'memory') {
        const setupSql = fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf8');
        const client = await pool.connect();
        try {
          await client.query(sanitizeSetupSqlForMemory(setupSql));
        } finally {
          client.release();
        }
      }
    })();
  }

  return initializationPromise;
}

const SEARCH_PATH_SQL = `SET search_path TO ${quoteIdentifier(DEFAULT_SCHEMA)}, public`;

function attachPostgresListeners(targetPool) {
  targetPool.on('connect', async (client) => {
    await client.query(SEARCH_PATH_SQL);
  });

  targetPool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error);
  });
}

function ensurePool() {
  if (pool) {
    return;
  }

  if (process.env.USE_PG_MEM === 'true') {
    pool = createMemoryPool();
    activeDriver = 'memory';
    return;
  }

  pool = new Pool(buildPoolConfig());
  activeDriver = 'postgres';
  attachPostgresListeners(pool);
}

function canFallbackToMemory(error) {
  if (process.env.USE_PG_MEM === 'true' || process.env.ALLOW_PG_MEM_FALLBACK === 'false') {
    return false;
  }

  const errorText = [error?.code, error?.message, error?.stack].filter(Boolean).join(' ');
  return /ECONNREFUSED|ENOTFOUND|database .* does not exist|password authentication failed|SASL|timeout expired/i.test(errorText);
}

async function switchToMemoryPool(error) {
  if (activeDriver === 'memory') {
    return;
  }

  if (pool) {
    await pool.end().catch(() => {});
  }

  pool = createMemoryPool();
  activeDriver = 'memory';
  initializationPromise = null;
  const reason = error?.message || error?.code || 'connection error';
  console.warn(`PostgreSQL unavailable, falling back to in-memory database: ${reason}`);
  await ensureInitialized();
}

async function executeWithFallback(operation) {
  ensurePool();

  try {
    return await operation();
  } catch (error) {
    if (!canFallbackToMemory(error)) {
      throw error;
    }

    await switchToMemoryPool(error);
    return operation();
  }
}

async function createConnection() {
  await ensureInitialized();
  const client = await pool.connect();
  if (activeDriver === 'postgres') {
    await client.query(SEARCH_PATH_SQL);
  }

  return {
    beginTransaction: async () => client.query('BEGIN'),
    commit: async () => client.query('COMMIT'),
    rollback: async () => client.query('ROLLBACK'),
    query: async (sql, params = []) => runOnClient(client, sql, params),
    release: () => client.release(),
  };
}

module.exports = {
  STATUS_VALUES,
  query: async (sql, params = []) => executeWithFallback(() => runOnClient(pool, sql, params)),
  getConnection: async () => executeWithFallback(createConnection),
  close: async () => {
    if (!pool) {
      return;
    }

    await pool.end();
    pool = null;
    activeDriver = null;
    initializationPromise = null;
  },
  ensureInitialized,
};
