import { randomUUID } from "node:crypto";

/** Prefixed, sortable-enough identifiers: `lead_9f2c...`. */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}
