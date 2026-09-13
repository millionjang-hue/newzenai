import { Pool, types, type PoolClient } from "pg";
import { SCHEMA_SQL } from "./schema";

/**
 * PostgreSQL access layer.
 *
 * Everything above this file works with plain JS values - strings for
 * timestamps, numbers for money - so the type parsers below normalise what the
 * driver returns before it reaches a repository.
 */

// pg hands back BIGINT and NUMERIC as strings to avoid precision loss. Every
// such column here (money in KRW, counts, averages) is far inside the safe
// integer range, so parse them as numbers rather than string-handling upstream.
types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));
types.setTypeParser(types.builtins.FLOAT8, (value) => Number(value));
// Timestamps come back as ISO-8601 UTC strings; DATE stays `YYYY-MM-DD`.
types.setTypeParser(types.builtins.TIMESTAMPTZ, toIso);
types.setTypeParser(types.builtins.TIMESTAMP, toIso);
types.setTypeParser(types.builtins.DATE, (value) => value);

function toIso(value: string): string {
  const parsed = new Date(value.includes("+") || value.endsWith("Z") ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

declare global {
  var __crmPool: Pool | undefined;
  var __crmReady: Promise<void> | undefined;
}

/** True when a connection string is present - checked before rendering the app. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim());
}

export function connectionString(): string {
  const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL 이 설정되지 않았습니다. .env.local 에 PostgreSQL 접속 문자열을 넣어 주세요. " +
        "예: DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require",
    );
  }
  return url;
}

function pool(): Pool {
  if (!globalThis.__crmPool) {
    globalThis.__crmPool = new Pool({
      connectionString: connectionString(),
      // One serverless invocation handles one request, so a large pool per
      // instance only burns connection slots on the database side.
      max: Number(process.env.PGPOOL_MAX ?? (process.env.VERCEL ? 1 : 10)),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    globalThis.__crmPool.on("error", (error) => {
      console.error("[crm] 유휴 커넥션 오류:", error.message);
    });
  }
  return globalThis.__crmPool;
}

/**
 * Applies the schema and, on an empty database, loads the demo dataset.
 * Runs at most once per process; concurrent instances are serialised with a
 * Postgres advisory lock so two cold starts cannot seed the same database twice.
 */
export function ready(): Promise<void> {
  if (!globalThis.__crmReady) {
    globalThis.__crmReady = bootstrap().catch((error) => {
      // Let the next request retry instead of caching a failed bootstrap.
      globalThis.__crmReady = undefined;
      throw error;
    });
  }
  return globalThis.__crmReady;
}

const BOOTSTRAP_LOCK = 8_242_026;

async function bootstrap(): Promise<void> {
  const client = await pool().connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [BOOTSTRAP_LOCK]);
    try {
      await client.query(SCHEMA_SQL);
      await autoSeed(client);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [BOOTSTRAP_LOCK]);
    }
  } finally {
    client.release();
  }
}

/**
 * Fills an empty database with the demo dataset so a fresh deployment renders
 * something on the very first request. Set `CRM_AUTO_SEED=0` to keep a new
 * install empty and load your own data instead.
 */
async function autoSeed(client: PoolClient): Promise<void> {
  if (process.env.CRM_AUTO_SEED === "0") return;

  const { rows } = await client.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
  if ((rows[0]?.n ?? 0) > 0) return;

  const started = Date.now();
  const { seedDatabase } = await import("@/lib/db/seed");
  const summary = await seedDatabase(client);
  console.log(
    `[crm] 데모 데이터를 생성했습니다 (${Date.now() - started}ms): ` +
      `리드 ${summary.leads} · 기회 ${summary.deals} · 활동 ${summary.activities}. ` +
      `비우려면 CRM_AUTO_SEED=0 을 설정하세요.`,
  );
}

export type SqlValue = string | number | bigint | boolean | null | undefined;
export type SqlParams = SqlValue[];

/**
 * Repositories are written with `?` placeholders; Postgres wants `$1, $2, ...`.
 * Rewriting here keeps the query text readable and the numbering automatic.
 */
export function toPositional(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalise(params: SqlParams): (string | number | bigint | boolean | null)[] {
  return params.map((value) => (value === undefined ? null : value));
}

/** Typed `SELECT` returning many rows. */
export async function query<T>(sql: string, params: SqlParams = []): Promise<T[]> {
  await ready();
  const result = await pool().query(toPositional(sql), normalise(params));
  return result.rows as T[];
}

/** Typed `SELECT` returning at most one row. */
export async function queryOne<T>(sql: string, params: SqlParams = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** `INSERT` / `UPDATE` / `DELETE`. */
export async function execute(sql: string, params: SqlParams = []): Promise<void> {
  await query(sql, params);
}

/**
 * Runs `fn` inside a single transaction. The callback receives a `Tx` whose
 * `query`/`queryOne`/`execute` all share one connection - using the module-level
 * helpers inside a transaction would check out a different connection and
 * silently fall outside it.
 */
export interface Tx {
  query<T>(sql: string, params?: SqlParams): Promise<T[]>;
  queryOne<T>(sql: string, params?: SqlParams): Promise<T | null>;
  execute(sql: string, params?: SqlParams): Promise<void>;
}

export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  await ready();
  const client = await pool().connect();
  const tx: Tx = {
    async query<R>(sql: string, params: SqlParams = []) {
      const result = await client.query(toPositional(sql), normalise(params));
      return result.rows as R[];
    },
    async queryOne<R>(sql: string, params: SqlParams = []) {
      return (await tx.query<R>(sql, params))[0] ?? null;
    },
    async execute(sql: string, params: SqlParams = []) {
      await tx.query(sql, params);
    },
  };

  try {
    await client.query("BEGIN");
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Closes the pool - used by the CLI scripts, never by the server. */
export async function closePool(): Promise<void> {
  await globalThis.__crmPool?.end();
  globalThis.__crmPool = undefined;
  globalThis.__crmReady = undefined;
}
