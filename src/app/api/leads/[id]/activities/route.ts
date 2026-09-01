import { NextResponse } from "next/server";
import { activitiesForLead, createActivity } from "@/lib/repositories/activities";
import { getLead } from "@/lib/repositories/leads";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json({ data: await activitiesForLead(id) });
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

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
    lead_id: id,
    owner_id: (payload.owner_id ? String(payload.owner_id) : null) ?? lead.owner_id,
    due_at: payload.due_at ? String(payload.due_at) : null,
    completed: payload.completed !== false,
  });

  return NextResponse.json({ data: await activitiesForLead(id) }, { status: 201 });
}
