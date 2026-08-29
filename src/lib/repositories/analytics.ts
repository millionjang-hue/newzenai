import { query, queryOne } from "@/lib/db";
import { isoMonth } from "@/lib/format";
import type { StageKind } from "@/lib/types";

export interface Period {
  /** Inclusive ISO day, e.g. `2026-01-01`. */
  from: string;
  /** Exclusive ISO day, e.g. `2026-09-01`. */
  to: string;
}

/** Trailing `months` whole months ending after today. */
export function trailingMonths(months: number, now = new Date()): Period {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function monthsInPeriod(period: Period): string[] {
  const out: string[] = [];
  const cursor = new Date(`${period.from}T00:00:00Z`);
  const end = new Date(`${period.to}T00:00:00Z`);
  while (cursor < end) {
    out.push(isoMonth(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

export interface Kpis {
  openPipelineValue: number;
  weightedForecast: number;
  openDealCount: number;
  wonValue: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  avgDealSize: number;
  avgCycleDays: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  leadConversionRate: number;
  /** Won value in the equally long window immediately before the period. */
  previousWonValue: number;
}

export async function kpis(period: Period): Promise<Kpis> {
  const open = await queryOne<{ value: number; weighted: number; n: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS value,
            COALESCE(SUM(amount * probability), 0) AS weighted,
            COUNT(*)::int AS n
       FROM deals WHERE status = 'open'`,
  );

  const closed = await queryOne<{ won_value: number; won: number; lost: number; cycle: number | null }>(
    `SELECT COALESCE(SUM(CASE WHEN status = 'won' THEN amount ELSE 0 END), 0) AS won_value,
            SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)::int AS won,
            SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END)::int AS lost,
            AVG(CASE WHEN status = 'won'
                     THEN EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400.0 END) AS cycle
       FROM deals
      WHERE closed_at >= ? AND closed_at < ?`,
    [period.from, period.to],
  );

  const previous = previousPeriod(period);
  const prior = await queryOne<{ won_value: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS won_value
       FROM deals WHERE status = 'won' AND closed_at >= ? AND closed_at < ?`,
    [previous.from, previous.to],
  );

  const leads = await queryOne<{ n: number; qualified: number; converted: number }>(
    `SELECT COUNT(*)::int AS n,
            SUM(CASE WHEN status IN ('qualified', 'converted') THEN 1 ELSE 0 END)::int AS qualified,
            SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END)::int AS converted
       FROM leads WHERE created_at >= ? AND created_at < ?`,
    [period.from, period.to],
  );

  const won = closed?.won ?? 0;
  const lost = closed?.lost ?? 0;
  const decided = won + lost;
  const newLeads = leads?.n ?? 0;

  return {
    openPipelineValue: open?.value ?? 0,
    weightedForecast: open?.weighted ?? 0,
    openDealCount: open?.n ?? 0,
    wonValue: closed?.won_value ?? 0,
    wonCount: won,
    lostCount: lost,
    winRate: decided > 0 ? won / decided : 0,
    avgDealSize: won > 0 ? (closed?.won_value ?? 0) / won : 0,
    avgCycleDays: closed?.cycle ?? 0,
    newLeads,
    qualifiedLeads: leads?.qualified ?? 0,
    convertedLeads: leads?.converted ?? 0,
    leadConversionRate: newLeads > 0 ? (leads?.converted ?? 0) / newLeads : 0,
    previousWonValue: prior?.won_value ?? 0,
  };
}

function previousPeriod(period: Period): Period {
  const from = new Date(`${period.from}T00:00:00Z`);
  const to = new Date(`${period.to}T00:00:00Z`);
  const span = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - span).toISOString().slice(0, 10),
    to: period.from,
  };
}

export interface MonthlyPoint {
  month: string;
  wonValue: number;
  lostValue: number;
  createdValue: number;
  wonCount: number;
  lostCount: number;
  newLeads: number;
}

export async function monthlyTrend(period: Period): Promise<MonthlyPoint[]> {
  const closed = await query<{ month: string; status: string; value: number; n: number }>(
    `SELECT to_char(closed_at, 'YYYY-MM') AS month, status,
            COALESCE(SUM(amount), 0) AS value, COUNT(*)::int AS n
       FROM deals
      WHERE closed_at >= ? AND closed_at < ? AND status IN ('won', 'lost')
      GROUP BY month, status`,
    [period.from, period.to],
  );
  const created = await query<{ month: string; value: number }>(
    `SELECT to_char(created_at, 'YYYY-MM') AS month, COALESCE(SUM(amount), 0) AS value
       FROM deals WHERE created_at >= ? AND created_at < ? GROUP BY month`,
    [period.from, period.to],
  );
  const leads = await query<{ month: string; n: number }>(
    `SELECT to_char(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS n
       FROM leads WHERE created_at >= ? AND created_at < ? GROUP BY month`,
    [period.from, period.to],
  );

  return monthsInPeriod(period).map((month) => {
    const won = closed.find((r) => r.month === month && r.status === "won");
    const lost = closed.find((r) => r.month === month && r.status === "lost");
    return {
      month,
      wonValue: won?.value ?? 0,
      lostValue: lost?.value ?? 0,
      createdValue: created.find((r) => r.month === month)?.value ?? 0,
      wonCount: won?.n ?? 0,
      lostCount: lost?.n ?? 0,
      newLeads: leads.find((r) => r.month === month)?.n ?? 0,
    };
  });
}

export interface StageBreakdown {
  stageId: string;
  stage: string;
  kind: StageKind;
  position: number;
  count: number;
  value: number;
  weightedValue: number;
  avgDaysInStage: number;
}

export function pipelineByStage(pipelineId: string): Promise<StageBreakdown[]> {
  return query<StageBreakdown>(
    `SELECT s.id AS "stageId", s.name AS stage, s.kind AS kind, s.position AS position,
            COUNT(d.id) AS count,
            COALESCE(SUM(d.amount), 0) AS value,
            COALESCE(SUM(d.amount * d.probability), 0) AS "weightedValue",
            COALESCE(AVG(EXTRACT(EPOCH FROM (now() - d.updated_at)) / 86400.0), 0) AS "avgDaysInStage"
       FROM stages s
       LEFT JOIN deals d ON d.stage_id = s.id AND d.status = 'open'
      WHERE s.pipeline_id = ?
      GROUP BY s.id
      ORDER BY s.position`,
    [pipelineId],
  );
}

export interface FunnelStep {
  stage: string;
  position: number;
  reached: number;
  /** Share of deals that reached the first stage. */
  rateFromTop: number;
  /** Share of deals that reached the previous stage. */
  rateFromPrev: number;
}

/**
 * How many deals ever entered each stage, from the stage-event log rather than
 * the current board, so closed deals still count toward earlier steps.
 */
export async function conversionFunnel(
  pipelineId: string,
  period: Period,
): Promise<FunnelStep[]> {
  const rows = await query<{ stage: string; position: number; reached: number }>(
    `SELECT s.name AS stage, s.position AS position,
            COUNT(DISTINCT e.deal_id)::int AS reached
       FROM stages s
       LEFT JOIN deal_stage_events e ON e.to_stage_id = s.id
       LEFT JOIN deals d ON d.id = e.deal_id AND d.created_at >= ? AND d.created_at < ?
      WHERE s.pipeline_id = ? AND s.kind = 'open' AND d.id IS NOT NULL
      GROUP BY s.id
      ORDER BY s.position`,
    [period.from, period.to, pipelineId],
  );

  const top = rows[0]?.reached ?? 0;
  return rows.map((row, index) => {
    const prev = index === 0 ? row.reached : rows[index - 1]!.reached;
    return {
      stage: row.stage,
      position: row.position,
      reached: row.reached,
      rateFromTop: top > 0 ? row.reached / top : 0,
      rateFromPrev: prev > 0 ? row.reached / prev : 0,
    };
  });
}

export interface SourcePerformance {
  source: string;
  leads: number;
  qualified: number;
  converted: number;
  conversionRate: number;
  wonValue: number;
  pipelineValue: number;
  avgScore: number;
}

export function sourcePerformance(period: Period): Promise<SourcePerformance[]> {
  return query<SourcePerformance>(
    `SELECT l.source AS source,
            COUNT(*)::int AS leads,
            SUM(CASE WHEN l.status IN ('qualified', 'converted') THEN 1 ELSE 0 END)::int AS qualified,
            SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END)::int AS converted,
            CASE WHEN COUNT(*) = 0 THEN 0
                 ELSE 1.0 * SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) / COUNT(*)
            END AS "conversionRate",
            COALESCE(SUM(CASE WHEN d.status = 'won' THEN d.amount ELSE 0 END), 0) AS "wonValue",
            COALESCE(SUM(CASE WHEN d.status = 'open' THEN d.amount ELSE 0 END), 0) AS "pipelineValue",
            COALESCE(AVG(l.score), 0) AS "avgScore"
       FROM leads l
       LEFT JOIN deals d ON d.source_lead_id = l.id
      WHERE l.created_at >= ? AND l.created_at < ?
      GROUP BY l.source
      ORDER BY "wonValue" DESC, leads DESC`,
    [period.from, period.to],
  );
}

export interface RepPerformance {
  ownerId: string;
  name: string;
  color: string;
  team: string;
  quotaPeriod: number;
  wonValue: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  openValue: number;
  openCount: number;
  attainment: number;
  activityCount: number;
}

export async function repPerformance(period: Period): Promise<RepPerformance[]> {
  const months = monthsInPeriod(period).length || 1;
  const rows = await query<Omit<RepPerformance, "attainment" | "winRate" | "quotaPeriod"> & {
    quota_monthly: number;
  }>(
    `SELECT u.id AS "ownerId", u.name AS name, u.avatar_color AS color, u.team AS team,
            u.quota_monthly AS quota_monthly,
            COALESCE(SUM(CASE WHEN d.status = 'won' AND d.closed_at >= ? AND d.closed_at < ?
                              THEN d.amount ELSE 0 END), 0) AS "wonValue",
            COALESCE(SUM(CASE WHEN d.status = 'won' AND d.closed_at >= ? AND d.closed_at < ?
                              THEN 1 ELSE 0 END), 0) AS "wonCount",
            COALESCE(SUM(CASE WHEN d.status = 'lost' AND d.closed_at >= ? AND d.closed_at < ?
                              THEN 1 ELSE 0 END), 0) AS "lostCount",
            COALESCE(SUM(CASE WHEN d.status = 'open' THEN d.amount ELSE 0 END), 0) AS "openValue",
            COALESCE(SUM(CASE WHEN d.status = 'open' THEN 1 ELSE 0 END), 0) AS "openCount",
            (SELECT COUNT(*)::int FROM activities a
              WHERE a.owner_id = u.id AND a.created_at >= ? AND a.created_at < ?) AS "activityCount"
       FROM users u
       LEFT JOIN deals d ON d.owner_id = u.id
      WHERE u.active = 1 AND u.role IN ('rep', 'manager')
      GROUP BY u.id
      ORDER BY "wonValue" DESC`,
    [
      period.from, period.to,
      period.from, period.to,
      period.from, period.to,
      period.from, period.to,
    ],
  );

  return rows.map((row) => {
    const decided = row.wonCount + row.lostCount;
    const quotaPeriod = row.quota_monthly * months;
    return {
      ownerId: row.ownerId,
      name: row.name,
      color: row.color,
      team: row.team,
      quotaPeriod,
      wonValue: row.wonValue,
      wonCount: row.wonCount,
      lostCount: row.lostCount,
      winRate: decided > 0 ? row.wonCount / decided : 0,
      openValue: row.openValue,
      openCount: row.openCount,
      attainment: quotaPeriod > 0 ? row.wonValue / quotaPeriod : 0,
      activityCount: row.activityCount,
    };
  });
}

export interface LabelledCount {
  label: string;
  count: number;
  value: number;
}

export function leadStatusMix(period: Period): Promise<LabelledCount[]> {
  return query<LabelledCount>(
    `SELECT status AS label, COUNT(*)::int AS count, COALESCE(SUM(estimated_value), 0) AS value
       FROM leads WHERE created_at >= ? AND created_at < ?
      GROUP BY status`,
    [period.from, period.to],
  );
}

export function lostReasonMix(period: Period): Promise<LabelledCount[]> {
  return query<LabelledCount>(
    `SELECT COALESCE(lost_reason, 'Unspecified') AS label,
            COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS value
       FROM deals
      WHERE status = 'lost' AND closed_at >= ? AND closed_at < ?
      GROUP BY label
      ORDER BY value DESC`,
    [period.from, period.to],
  );
}

export function industryMix(): Promise<LabelledCount[]> {
  return query<LabelledCount>(
    `SELECT co.industry AS label, COUNT(d.id)::int AS count, COALESCE(SUM(d.amount), 0) AS value
       FROM deals d
       JOIN companies co ON co.id = d.company_id
      WHERE d.status IN ('open', 'won')
      GROUP BY co.industry
      ORDER BY value DESC
      LIMIT 8`,
  );
}

export interface AgingBucket {
  label: string;
  count: number;
  value: number;
}

/** Open deals bucketed by days since their last update - stall detection. */
export async function pipelineAging(): Promise<AgingBucket[]> {
  const rows = await query<{ days: number; amount: number }>(
    `SELECT EXTRACT(EPOCH FROM (now() - updated_at)) / 86400.0 AS days, amount
       FROM deals WHERE status = 'open'`,
  );
  const buckets: AgingBucket[] = [
    { label: "0-14일", count: 0, value: 0 },
    { label: "15-30일", count: 0, value: 0 },
    { label: "31-60일", count: 0, value: 0 },
    { label: "60일+", count: 0, value: 0 },
  ];
  for (const row of rows) {
    const index = row.days <= 14 ? 0 : row.days <= 30 ? 1 : row.days <= 60 ? 2 : 3;
    buckets[index]!.count += 1;
    buckets[index]!.value += row.amount;
  }
  return buckets;
}

export interface ForecastRow {
  month: string;
  committed: number;
  weighted: number;
  bestCase: number;
}

/** Forward-looking view of open deals grouped by expected close month. */
export async function forecast(monthsAhead = 4, now = new Date()): Promise<ForecastRow[]> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, 1));
  const rows = await query<{ month: string; committed: number; weighted: number; best: number }>(
    `SELECT to_char(expected_close_date, 'YYYY-MM') AS month,
            COALESCE(SUM(CASE WHEN probability >= 0.6 THEN amount ELSE 0 END), 0) AS committed,
            COALESCE(SUM(amount * probability), 0) AS weighted,
            COALESCE(SUM(amount), 0) AS best
       FROM deals
      WHERE status = 'open' AND expected_close_date >= ? AND expected_close_date < ?
      GROUP BY month ORDER BY month`,
    [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)],
  );

  return monthsInPeriod({
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }).map((month) => {
    const row = rows.find((r) => r.month === month);
    return {
      month,
      committed: row?.committed ?? 0,
      weighted: row?.weighted ?? 0,
      bestCase: row?.best ?? 0,
    };
  });
}

/** Median + average days a won deal spent in each stage. */
export interface StageVelocity {
  stage: string;
  position: number;
  avgDays: number;
  transitions: number;
}

export function stageVelocity(pipelineId: string): Promise<StageVelocity[]> {
  return query<StageVelocity>(
    `WITH ordered AS (
       SELECT e.deal_id, e.to_stage_id, e.occurred_at,
              LEAD(e.occurred_at) OVER (PARTITION BY e.deal_id ORDER BY e.occurred_at) AS next_at
         FROM deal_stage_events e
     )
     SELECT s.name AS stage, s.position AS position,
            COALESCE(AVG(EXTRACT(EPOCH FROM (o.next_at - o.occurred_at)) / 86400.0), 0) AS "avgDays",
            COUNT(o.next_at)::int AS transitions
       FROM stages s
       JOIN ordered o ON o.to_stage_id = s.id
      WHERE s.pipeline_id = ? AND s.kind = 'open' AND o.next_at IS NOT NULL
      GROUP BY s.id
      ORDER BY s.position`,
    [pipelineId],
  );
}
