import { execute, query, queryOne, transaction } from "@/lib/db";
import { newId } from "@/lib/ids";
import type { Lead, LeadStatus, LeadWithOwner } from "@/lib/types";
import { defaultPipeline, listStages } from "@/lib/repositories/pipelines";

export interface LeadFilter {
  search?: string;
  status?: LeadStatus | "all";
  ownerId?: string | "all";
  source?: string | "all";
  minScore?: number;
  sort?: LeadSort;
  limit?: number;
  offset?: number;
}

export type LeadSort =
  | "created_desc"
  | "created_asc"
  | "score_desc"
  | "value_desc"
  | "touch_asc";

const SORT_SQL: Record<LeadSort, string> = {
  created_desc: "l.created_at DESC",
  created_asc: "l.created_at ASC",
  score_desc: "l.score DESC, l.estimated_value DESC",
  value_desc: "l.estimated_value DESC",
  touch_asc: "COALESCE(l.last_touch_at, l.created_at) ASC",
};

function whereClause(filter: LeadFilter) {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  const search = filter.search?.trim() ?? "";
  if (search) {
    const like = `%${search}%`;
    clauses.push(
      `(l.first_name LIKE ? OR l.last_name LIKE ? OR l.email LIKE ? OR l.company_name LIKE ? OR l.title LIKE ?)`,
    );
    params.push(like, like, like, like, like);
  }
  if (filter.status && filter.status !== "all") {
    clauses.push(`l.status = ?`);
    params.push(filter.status);
  }
  if (filter.ownerId && filter.ownerId !== "all") {
    clauses.push(`l.owner_id = ?`);
    params.push(filter.ownerId);
  }
  if (filter.source && filter.source !== "all") {
    clauses.push(`l.source = ?`);
    params.push(filter.source);
  }
  if (filter.minScore && filter.minScore > 0) {
    clauses.push(`l.score >= ?`);
    params.push(filter.minScore);
  }

  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export function listLeads(filter: LeadFilter = {}): LeadWithOwner[] {
  const { sql, params } = whereClause(filter);
  const order = SORT_SQL[filter.sort ?? "created_desc"];
  const limit = filter.limit ?? 200;
  const offset = filter.offset ?? 0;

  return query<LeadWithOwner>(
    `SELECT l.*,
            u.name AS owner_name,
            u.avatar_color AS owner_color,
            (SELECT COUNT(*) FROM activities a WHERE a.lead_id = l.id) AS activity_count
       FROM leads l
       LEFT JOIN users u ON u.id = l.owner_id
       ${sql}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
}

export function countLeads(filter: LeadFilter = {}): number {
  const { sql, params } = whereClause(filter);
  const row = queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM leads l ${sql}`,
    params,
  );
  return row?.n ?? 0;
}

export function leadStatusCounts(filter: LeadFilter = {}): Record<string, number> {
  const scoped: LeadFilter = { ...filter, status: "all" };
  const { sql, params } = whereClause(scoped);
  const rows = query<{ status: LeadStatus; n: number }>(
    `SELECT l.status AS status, COUNT(*) AS n FROM leads l ${sql} GROUP BY l.status`,
    params,
  );
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export function getLead(id: string): LeadWithOwner | null {
  return queryOne<LeadWithOwner>(
    `SELECT l.*,
            u.name AS owner_name,
            u.avatar_color AS owner_color,
            (SELECT COUNT(*) FROM activities a WHERE a.lead_id = l.id) AS activity_count
       FROM leads l
       LEFT JOIN users u ON u.id = l.owner_id
      WHERE l.id = ?`,
    [id],
  );
}

export interface LeadInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  company_name: string;
  source: string;
  status: LeadStatus;
  score: number;
  owner_id?: string | null;
  estimated_value: number;
  notes?: string | null;
}

export function createLead(input: LeadInput): Lead {
  const now = new Date().toISOString();
  const id = newId("lead");

  execute(
    `INSERT INTO leads (id, first_name, last_name, email, phone, title, company_name,
                        company_id, source, status, score, owner_id, estimated_value,
                        notes, last_touch_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.first_name,
      input.last_name,
      input.email,
      input.phone ?? null,
      input.title ?? null,
      input.company_name,
      input.source,
      input.status,
      clampScore(input.score),
      input.owner_id ?? null,
      Math.max(0, Math.round(input.estimated_value)),
      input.notes ?? null,
      now,
      now,
      now,
    ],
  );

  return getLead(id) as Lead;
}

const UPDATABLE = new Set([
  "first_name",
  "last_name",
  "email",
  "phone",
  "title",
  "company_name",
  "source",
  "status",
  "score",
  "owner_id",
  "estimated_value",
  "notes",
]);

export function updateLead(id: string, patch: Record<string, unknown>): Lead | null {
  const entries = Object.entries(patch).filter(([key]) => UPDATABLE.has(key));
  if (entries.length === 0) return getLead(id);

  const sets = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([key, value]) => {
    if (key === "score") return clampScore(Number(value));
    if (key === "estimated_value") return Math.max(0, Math.round(Number(value) || 0));
    return (value ?? null) as string | number | null;
  });

  execute(`UPDATE leads SET ${sets}, updated_at = ? WHERE id = ?`, [
    ...values,
    new Date().toISOString(),
    id,
  ]);
  return getLead(id);
}

export function deleteLead(id: string): void {
  execute(`DELETE FROM leads WHERE id = ?`, [id]);
}

export interface ConvertLeadOptions {
  amount?: number;
  expectedCloseDate?: string;
  ownerId?: string | null;
}

/**
 * Converts a qualified lead into an opportunity in the default pipeline:
 * creates (or reuses) the company + contact, opens a deal in the first stage,
 * records the stage event, and re-parents the lead's activity history.
 */
export function convertLead(id: string, options: ConvertLeadOptions = {}) {
  const lead = getLead(id);
  if (!lead) return { ok: false as const, error: "Lead not found" };
  if (lead.status === "converted") {
    return { ok: false as const, error: "Lead has already been converted" };
  }

  const pipeline = defaultPipeline();
  if (!pipeline) return { ok: false as const, error: "No pipeline configured" };

  const stages = listStages(pipeline.id).filter((s) => s.kind === "open");
  const firstStage = stages[0];
  if (!firstStage) return { ok: false as const, error: "Pipeline has no open stage" };

  const now = new Date().toISOString();
  const ownerId = options.ownerId ?? lead.owner_id;

  return transaction(() => {
    let companyId = lead.company_id;
    if (!companyId) {
      const existing = queryOne<{ id: string }>(
        `SELECT id FROM companies WHERE lower(name) = lower(?) LIMIT 1`,
        [lead.company_name],
      );
      if (existing) {
        companyId = existing.id;
      } else {
        companyId = newId("comp");
        execute(
          `INSERT INTO companies (id, name, domain, industry, size, country, annual_revenue, created_at)
           VALUES (?, ?, ?, 'Unclassified', '11-50', 'KR', NULL, ?)`,
          [companyId, lead.company_name, domainFromEmail(lead.email), now],
        );
      }
    }

    let contactId = queryOne<{ id: string }>(
      `SELECT id FROM contacts WHERE lower(email) = lower(?) LIMIT 1`,
      [lead.email],
    )?.id;
    if (!contactId) {
      contactId = newId("cont");
      execute(
        `INSERT INTO contacts (id, company_id, first_name, last_name, email, phone, title, is_primary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          contactId,
          companyId,
          lead.first_name,
          lead.last_name,
          lead.email,
          lead.phone,
          lead.title,
          now,
        ],
      );
    }

    const dealId = newId("deal");
    const amount = Math.max(0, Math.round(options.amount ?? lead.estimated_value));
    const expectedClose =
      options.expectedCloseDate ??
      new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
    const maxPosition =
      queryOne<{ p: number | null }>(
        `SELECT MAX(position) AS p FROM deals WHERE stage_id = ?`,
        [firstStage.id],
      )?.p ?? 0;

    execute(
      `INSERT INTO deals (id, title, pipeline_id, stage_id, company_id, contact_id, owner_id,
                          source_lead_id, amount, currency, probability, status, position,
                          expected_close_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'KRW', ?, 'open', ?, ?, ?, ?)`,
      [
        dealId,
        `${lead.company_name} - 신규 도입`,
        pipeline.id,
        firstStage.id,
        companyId,
        contactId,
        ownerId,
        lead.id,
        amount,
        firstStage.probability,
        maxPosition + 1000,
        expectedClose,
        now,
        now,
      ],
    );

    execute(
      `INSERT INTO deal_stage_events (id, deal_id, from_stage_id, to_stage_id, actor_id, occurred_at)
       VALUES (?, ?, NULL, ?, ?, ?)`,
      [newId("evt"), dealId, firstStage.id, ownerId, now],
    );

    execute(`UPDATE activities SET deal_id = ?, contact_id = ? WHERE lead_id = ?`, [
      dealId,
      contactId,
      lead.id,
    ]);

    execute(
      `UPDATE leads
          SET status = 'converted', company_id = ?, converted_deal_id = ?,
              converted_at = ?, updated_at = ?
        WHERE id = ?`,
      [companyId, dealId, now, now, lead.id],
    );

    return { ok: true as const, dealId, companyId, contactId };
  });
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function domainFromEmail(email: string): string | null {
  const at = email.indexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
}
