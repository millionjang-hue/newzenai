import { NextResponse } from "next/server";
import { activitiesForDeal, createActivity } from "@/lib/repositories/activities";
import { getDeal } from "@/lib/repositories/deals";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json({ data: await activitiesForDeal(id) });
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = String(payload.type ?? "note") as ActivityType;
  if (!ACTIVITY_TYPES.includes(type)) {
    return NextResponse.json({ error: `Unknown activity type: ${type}` }, { status: 422 });
  }
  const subject = String(payload.subject ?? "").trim();
  if (!subject) return NextResponse.json({ error: "subject is required" }, { status: 422 });

  await createActivity({
    type,
    subject,
    body: payload.body ? String(payload.body) : null,
    deal_id: id,
    contact_id: deal.contact_id,
    owner_id: (payload.owner_id ? String(payload.owner_id) : null) ?? deal.owner_id,
    due_at: payload.due_at ? String(payload.due_at) : null,
    completed: payload.completed !== false,
  });

  return NextResponse.json({ data: await activitiesForDeal(id) }, { status: 201 });
}
