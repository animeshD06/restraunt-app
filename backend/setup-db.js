const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function getSslConfig() {
  const useSsl =
    process.env.PG_SSL_MODE === 'require' ||
    process.env.DATABASE_URL?.includes('sslmode=require');

  return useSsl ? { rejectUnauthorized: false } : undefined;
}

function getBaseConnectionConfig(databaseName) {
  const ssl = getSslConfig();

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl,
    };
  }

  return {
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    database: databaseName,
    ssl,
  };
}

async function ensureDatabaseExists() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const targetDatabase = process.env.PGDATABASE || process.env.DB_NAME || 'restaurant_db';
  const adminClient = new Client(getBaseConnectionConfig(process.env.PGMAINTENANCE_DB || 'postgres'));

  await adminClient.connect();

  try {
    const { rows } = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDatabase]
    );

    if (rows.length === 0) {
      await adminClient.query(`CREATE DATABASE ${quoteIdentifier(targetDatabase)}`);
      console.log(`Created PostgreSQL database: ${targetDatabase}`);
    }
  } finally {
    await adminClient.end();
  }
}

async function runSetup() {
  const sqlPath = path.join(__dirname, 'setup.sql');
  const sql = await fs.readFile(sqlPath, 'utf8');
  await ensureDatabaseExists();

  const client = new Client(getBaseConnectionConfig(process.env.PGDATABASE || process.env.DB_NAME || 'restaurant_db'));

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('PostgreSQL schema setup completed successfully.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError.message);
    }
    console.error('Error setting up PostgreSQL schema:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runSetup();
