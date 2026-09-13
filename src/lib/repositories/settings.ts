import { execute, queryOne } from "@/lib/db";

/** Tiny key/value store for workspace-level preferences. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM workspace_settings WHERE key = ?`,
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO workspace_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, value, new Date().toISOString()],
  );
}

export const STATUS_MESSAGE_KEY = "profile.status_message";
