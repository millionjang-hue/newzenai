import { query, queryOne } from "@/lib/db";
import type { Pipeline, Stage } from "@/lib/types";

export function listPipelines(): Pipeline[] {
  return query<Pipeline>(`SELECT * FROM pipelines ORDER BY is_default DESC, name`);
}

export function defaultPipeline(): Pipeline | null {
  return queryOne<Pipeline>(
    `SELECT * FROM pipelines ORDER BY is_default DESC, created_at LIMIT 1`,
  );
}

export function listStages(pipelineId: string): Stage[] {
  return query<Stage>(
    `SELECT * FROM stages WHERE pipeline_id = ? ORDER BY position`,
    [pipelineId],
  );
}

export function getStage(id: string): Stage | null {
  return queryOne<Stage>(`SELECT * FROM stages WHERE id = ?`, [id]);
}
