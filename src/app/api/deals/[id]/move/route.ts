import { NextResponse } from "next/server";
import { moveDeal } from "@/lib/repositories/deals";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stageId = String(payload.stage_id ?? "");
  if (!stageId) return NextResponse.json({ error: "stage_id is required" }, { status: 422 });

  const deal = moveDeal(id, {
    stageId,
    orderedIds: Array.isArray(payload.ordered_ids)
      ? (payload.ordered_ids as unknown[]).map(String)
      : undefined,
    actorId: payload.actor_id ? String(payload.actor_id) : null,
    lostReason: payload.lost_reason ? String(payload.lost_reason) : null,
  });

  if (!deal) {
    return NextResponse.json(
      { error: "Deal not found, or the stage belongs to another pipeline" },
      { status: 422 },
    );
  }
  return NextResponse.json({ data: deal });
}
