import 'server-only';

import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';

declare global {
  var __rondaMysqlPool: Pool | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured.');
}

const parsedDatabaseUrl = new URL(databaseUrl);

const pool = globalThis.__rondaMysqlPool ?? mysql.createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  enableKeepAlive: true,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__rondaMysqlPool = pool;
}

export function getMysqlPool() {
  return pool;
}

export function getSafeDatabaseTarget() {
  return {
    host: parsedDatabaseUrl.hostname,
    port: Number(parsedDatabaseUrl.port || 3306),
    database: parsedDatabaseUrl.pathname.replace(/^\//, ''),
  };
}

type PingRow = RowDataPacket & {
  databaseName: string | null;
  serverTime: string | null;
};

export async function pingMySql() {
  const [rows] = await pool.query<PingRow[]>(
    'SELECT DATABASE() AS databaseName, CURRENT_TIMESTAMP() AS serverTime'
  );

  return rows[0] ?? { databaseName: null, serverTime: null };
}