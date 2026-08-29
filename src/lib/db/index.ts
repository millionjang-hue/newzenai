import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "@/lib/db/schema";
import { seedDatabase } from "@/lib/db/seed";

/**
 * Single process-wide SQLite handle.
 *
 * The connection is cached on globalThis so Next.js' dev-mode module reloading
 * does not open a new file handle on every request.
 */
declare global {
  var __crmDb: DatabaseSync | undefined;
}

export function databasePath(): string {
  const configured = process.env.CRM_DATABASE_PATH?.trim();
  const relative = configured && configured.length > 0 ? configured : "data/crm.db";
  return path.isAbsolute(relative) ? relative : path.join(process.cwd(), relative);
}

function open(): DatabaseSync {
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

export function migrate(db: DatabaseSync): void {
  db.exec(SCHEMA_SQL);
}

function isEmpty(db: DatabaseSync): boolean {
  return (db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n === 0;
}

/**
 * Fills an empty database with the demo dataset so a fresh checkout renders
 * something on the very first request. Set `CRM_AUTO_SEED=0` to keep a new
 * install empty (for a real deployment, where you seed your own data instead).
 */
function autoSeed(db: DatabaseSync): void {
  if (process.env.CRM_AUTO_SEED === "0") return;
  if (!isEmpty(db)) return;

  const started = Date.now();
  const summary = seedDatabase(db);
  console.log(
    `[crm] 데모 데이터를 생성했습니다 (${Date.now() - started}ms): ` +
      `리드 ${summary.leads} · 기회 ${summary.deals} · 활동 ${summary.activities}. ` +
      `비우려면 CRM_AUTO_SEED=0 을 설정하세요.`,
  );
}

export function getDb(): DatabaseSync {
  if (!globalThis.__crmDb) {
    const db = open();
    migrate(db);
    autoSeed(db);
    globalThis.__crmDb = db;
  }
  return globalThis.__crmDb;
}

/** Typed `SELECT` returning many rows. */
export function query<T>(sql: string, params: SqlParams = []): T[] {
  const rows = getDb().prepare(sql).all(...normalise(params)) as unknown[];
  return rows.map((row) => ({ ...(row as object) }) as T);
}

/** Typed `SELECT` returning at most one row. */
export function queryOne<T>(sql: string, params: SqlParams = []): T | null {
  const row = getDb().prepare(sql).get(...normalise(params)) as unknown;
  return row ? ({ ...(row as object) } as T) : null;
}

/** `INSERT` / `UPDATE` / `DELETE`. */
export function execute(sql: string, params: SqlParams = []): void {
  getDb().prepare(sql).run(...normalise(params));
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export type SqlValue = string | number | bigint | null | undefined | boolean;
export type SqlParams = SqlValue[];

/** node:sqlite only accepts null/number/bigint/string/Uint8Array. */
function normalise(params: SqlParams): (string | number | bigint | null)[] {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    return value;
  });
}
