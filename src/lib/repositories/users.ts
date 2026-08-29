import { query, queryOne } from "@/lib/db";
import type { User } from "@/lib/types";

export function listUsers(): Promise<User[]> {
  return query<User>(
    `SELECT * FROM users WHERE active = 1 ORDER BY role = 'rep', name`,
  );
}

export function getUser(id: string): Promise<User | null> {
  return queryOne<User>(`SELECT * FROM users WHERE id = ?`, [id]);
}
