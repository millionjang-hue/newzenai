import { execute, query } from "@/lib/db";
import { newId } from "@/lib/ids";
import type { ActivityType, ActivityWithOwner } from "@/lib/types";

const SELECT = `
  SELECT a.*, u.name AS owner_name, u.avatar_color AS owner_color
    FROM activities a
    LEFT JOIN users u ON u.id = a.owner_id
`;

export function activitiesForLead(leadId: string, limit = 50): ActivityWithOwner[] {
  return query<ActivityWithOwner>(
    `${SELECT} WHERE a.lead_id = ? ORDER BY a.created_at DESC LIMIT ?`,
    [leadId, limit],
  );
}

export function activitiesForDeal(dealId: string, limit = 50): ActivityWithOwner[] {
  return query<ActivityWithOwner>(
    `${SELECT} WHERE a.deal_id = ? ORDER BY a.created_at DESC LIMIT ?`,
    [dealId, limit],
  );
}

export function recentActivities(limit = 12): ActivityWithOwner[] {
  return query<ActivityWithOwner>(
    `${SELECT} WHERE a.completed_at IS NOT NULL ORDER BY a.completed_at DESC LIMIT ?`,
    [limit],
  );
}

export function openTasks(limit = 12): ActivityWithOwner[] {
  return query<ActivityWithOwner>(
    `${SELECT}
      WHERE a.completed_at IS NULL AND a.due_at IS NOT NULL
      ORDER BY a.due_at ASC LIMIT ?`,
    [limit],
  );
}

export interface ActivityInput {
  type: ActivityType;
  subject: string;
  body?: string | null;
  lead_id?: string | null;
  deal_id?: string | null;
  contact_id?: string | null;
  owner_id?: string | null;
  due_at?: string | null;
  completed?: boolean;
}

export function createActivity(input: ActivityInput): void {
  const now = new Date().toISOString();
  execute(
    `INSERT INTO activities (id, type, subject, body, lead_id, deal_id, contact_id,
                             owner_id, due_at, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId("act"),
      input.type,
      input.subject,
      input.body ?? null,
      input.lead_id ?? null,
      input.deal_id ?? null,
      input.contact_id ?? null,
      input.owner_id ?? null,
      input.due_at ?? null,
      input.completed === false ? null : now,
      now,
    ],
  );

  if (input.lead_id) {
    execute(`UPDATE leads SET last_touch_at = ?, updated_at = ? WHERE id = ?`, [
      now,
      now,
      input.lead_id,
    ]);
  }
}

export function completeActivity(id: string): void {
  execute(`UPDATE activities SET completed_at = ? WHERE id = ? AND completed_at IS NULL`, [
    new Date().toISOString(),
    id,
  ]);
}
