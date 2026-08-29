import { execute, query, queryOne, transaction } from "@/lib/db";
import { newId } from "@/lib/ids";
import type { Deal, DealWithRelations, Stage } from "@/lib/types";
import { getStage, listStages } from "@/lib/repositories/pipelines";

export interface DealFilter {
  pipelineId?: string;
  ownerId?: string | "all";
  search?: string;
  status?: "open" | "won" | "lost" | "all";
}

const SELECT_DEAL = `
  SELECT d.*,
         s.name AS stage_name,
         s.kind AS stage_kind,
         s.position AS stage_position,
         co.name AS company_name,
         (ct.last_name || ct.first_name) AS contact_name,
         u.name AS owner_name,
         u.avatar_color AS owner_color
    FROM deals d
    JOIN stages s ON s.id = d.stage_id
    LEFT JOIN companies co ON co.id = d.company_id
    LEFT JOIN contacts ct ON ct.id = d.contact_id
    LEFT JOIN users u ON u.id = d.owner_id
`;

export function listDeals(filter: DealFilter = {}): DealWithRelations[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.pipelineId) {
    clauses.push(`d.pipeline_id = ?`);
    params.push(filter.pipelineId);
  }
  if (filter.ownerId && filter.ownerId !== "all") {
    clauses.push(`d.owner_id = ?`);
    params.push(filter.ownerId);
  }
  if (filter.status && filter.status !== "all") {
    clauses.push(`d.status = ?`);
    params.push(filter.status);
  }
  const search = filter.search?.trim() ?? "";
  if (search) {
    const like = `%${search}%`;
    clauses.push(`(d.title LIKE ? OR co.name LIKE ? OR ct.first_name LIKE ? OR ct.last_name LIKE ?)`);
    params.push(like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return query<DealWithRelations>(
    `${SELECT_DEAL} ${where} ORDER BY s.position, d.position, d.created_at DESC`,
    params,
  );
}

export function getDeal(id: string): DealWithRelations | null {
  return queryOne<DealWithRelations>(`${SELECT_DEAL} WHERE d.id = ?`, [id]);
}

export interface DealInput {
  title: string;
  pipeline_id: string;
  stage_id: string;
  company_id?: string | null;
  contact_id?: string | null;
  owner_id?: string | null;
  amount: number;
  expected_close_date?: string | null;
}

export function createDeal(input: DealInput): DealWithRelations | null {
  const stage = getStage(input.stage_id);
  if (!stage) return null;

  const now = new Date().toISOString();
  const id = newId("deal");
  const maxPosition =
    queryOne<{ p: number | null }>(`SELECT MAX(position) AS p FROM deals WHERE stage_id = ?`, [
      stage.id,
    ])?.p ?? 0;

  return transaction(() => {
    execute(
      `INSERT INTO deals (id, title, pipeline_id, stage_id, company_id, contact_id, owner_id,
                          amount, currency, probability, status, position, expected_close_date,
                          closed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'KRW', ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.title,
        input.pipeline_id,
        stage.id,
        input.company_id ?? null,
        input.contact_id ?? null,
        input.owner_id ?? null,
        Math.max(0, Math.round(input.amount)),
        stage.probability,
        stage.kind,
        maxPosition + 1000,
        input.expected_close_date ?? null,
        stage.kind === "open" ? null : now,
        now,
        now,
      ],
    );
    execute(
      `INSERT INTO deal_stage_events (id, deal_id, from_stage_id, to_stage_id, actor_id, occurred_at)
       VALUES (?, ?, NULL, ?, ?, ?)`,
      [newId("evt"), id, stage.id, input.owner_id ?? null, now],
    );
    return getDeal(id);
  });
}

const UPDATABLE = new Set([
  "title",
  "company_id",
  "contact_id",
  "owner_id",
  "amount",
  "expected_close_date",
  "lost_reason",
  "probability",
]);

export function updateDeal(id: string, patch: Record<string, unknown>): DealWithRelations | null {
  const entries = Object.entries(patch).filter(([key]) => UPDATABLE.has(key));
  if (entries.length === 0) return getDeal(id);

  const sets = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([key, value]) => {
    if (key === "amount") return Math.max(0, Math.round(Number(value) || 0));
    if (key === "probability") return Math.min(1, Math.max(0, Number(value) || 0));
    return (value ?? null) as string | number | null;
  });

  execute(`UPDATE deals SET ${sets}, updated_at = ? WHERE id = ?`, [
    ...values,
    new Date().toISOString(),
    id,
  ]);
  return getDeal(id);
}

export interface MoveDealOptions {
  stageId: string;
  /** Ids of the destination column in their new visual order. */
  orderedIds?: string[];
  actorId?: string | null;
  lostReason?: string | null;
}

/**
 * Moves a deal to another stage and rewrites the destination column ordering.
 * Won/lost stages stamp `closed_at` and force probability to 1/0 so forecast
 * numbers stay consistent with the board.
 */
export function moveDeal(id: string, options: MoveDealOptions): DealWithRelations | null {
  const deal = queryOne<Deal>(`SELECT * FROM deals WHERE id = ?`, [id]);
  if (!deal) return null;
  const stage = getStage(options.stageId);
  if (!stage || stage.pipeline_id !== deal.pipeline_id) return null;

  const now = new Date().toISOString();

  return transaction(() => {
    const probability = stage.kind === "won" ? 1 : stage.kind === "lost" ? 0 : stage.probability;
    const closedAt = stage.kind === "open" ? null : (deal.closed_at ?? now);

    execute(
      `UPDATE deals
          SET stage_id = ?, status = ?, probability = ?, closed_at = ?,
              lost_reason = ?, updated_at = ?
        WHERE id = ?`,
      [
        stage.id,
        stage.kind,
        probability,
        closedAt,
        stage.kind === "lost" ? (options.lostReason ?? deal.lost_reason ?? "No decision") : null,
        now,
        id,
      ],
    );

    if (deal.stage_id !== stage.id) {
      execute(
        `INSERT INTO deal_stage_events (id, deal_id, from_stage_id, to_stage_id, actor_id, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId("evt"), id, deal.stage_id, stage.id, options.actorId ?? null, now],
      );
    }

    const ordered = options.orderedIds?.length ? options.orderedIds : [id];
    ordered.forEach((dealId, index) => {
      execute(`UPDATE deals SET position = ? WHERE id = ? AND stage_id = ?`, [
        (index + 1) * 1000,
        dealId,
        stage.id,
      ]);
    });

    return getDeal(id);
  });
}

export function deleteDeal(id: string): void {
  execute(`DELETE FROM deals WHERE id = ?`, [id]);
}

export interface BoardColumn {
  stage: Stage;
  deals: DealWithRelations[];
  totalValue: number;
  weightedValue: number;
}

/** Pipeline board grouped by stage, with per-column totals. */
export function boardForPipeline(pipelineId: string, filter: DealFilter = {}): BoardColumn[] {
  const stages = listStages(pipelineId);
  const deals = listDeals({ ...filter, pipelineId });

  return stages.map((stage) => {
    const columnDeals = deals.filter((d) => d.stage_id === stage.id);
    return {
      stage,
      deals: columnDeals,
      totalValue: columnDeals.reduce((sum, d) => sum + d.amount, 0),
      weightedValue: columnDeals.reduce((sum, d) => sum + d.amount * d.probability, 0),
    };
  });
}
