import { NextResponse } from "next/server";
import { deleteLead, getLead, updateLead } from "@/lib/repositories/leads";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ data: lead });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!(await getLead(id))) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json({ data: await updateLead(id, payload) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!(await getLead(id))) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await deleteLead(id);
  return NextResponse.json({ ok: true });
}
