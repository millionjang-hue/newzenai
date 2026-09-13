import { execute, query, queryOne, transaction, type Tx } from "@/lib/db";
import { newId } from "@/lib/ids";
import type { AppLink, IconSource } from "@/lib/types";

export function listAppLinks(onlyEnabled = false): Promise<AppLink[]> {
  return query<AppLink>(
    `SELECT * FROM app_links ${onlyEnabled ? "WHERE enabled = 1" : ""} ORDER BY position, created_at`,
  );
}

export function getAppLink(id: string): Promise<AppLink | null> {
  return queryOne<AppLink>(`SELECT * FROM app_links WHERE id = ?`, [id]);
}

export interface AppLinkInput {
  name: string;
  url: string;
  icon_data?: string | null;
  icon_source?: IconSource;
  enabled?: boolean;
}

export async function createAppLink(input: AppLinkInput): Promise<AppLink | null> {
  const now = new Date().toISOString();
  const id = newId("app");
  const maxPosition =
    (await queryOne<{ p: number | null }>(`SELECT MAX(position) AS p FROM app_links`))?.p ?? 0;

  await execute(
    `INSERT INTO app_links (id, name, url, icon_data, icon_source, enabled, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.url,
      input.icon_data ?? null,
      input.icon_source ?? (input.icon_data ? "upload" : "default"),
      input.enabled === false ? 0 : 1,
      maxPosition + 1000,
      now,
      now,
    ],
  );

  return getAppLink(id);
}

const UPDATABLE = new Set(["name", "url", "icon_data", "icon_source", "enabled"]);

export async function updateAppLink(
  id: string,
  patch: Record<string, unknown>,
): Promise<AppLink | null> {
  const entries = Object.entries(patch).filter(([key]) => UPDATABLE.has(key));
  if (entries.length === 0) return getAppLink(id);

  const sets = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([key, value]) => {
    if (key === "enabled") return value ? 1 : 0;
    return (value ?? null) as string | number | null;
  });

  await execute(`UPDATE app_links SET ${sets}, updated_at = ? WHERE id = ?`, [
    ...values,
    new Date().toISOString(),
    id,
  ]);
  return getAppLink(id);
}

export async function deleteAppLink(id: string): Promise<void> {
  await execute(`DELETE FROM app_links WHERE id = ?`, [id]);
}

/** Rewrites the ordering from a full list of ids, as the settings table shows them. */
export async function reorderAppLinks(orderedIds: string[]): Promise<AppLink[]> {
  const now = new Date().toISOString();
  await transaction(async (tx: Tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.execute(`UPDATE app_links SET position = ?, updated_at = ? WHERE id = ?`, [
        (index + 1) * 1000,
        now,
        id,
      ]);
    }
  });
  return listAppLinks();
}
