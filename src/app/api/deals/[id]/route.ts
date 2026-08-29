import { NextResponse } from "next/server";
import { deleteDeal, getDeal, updateDeal } from "@/lib/repositories/deals";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  return NextResponse.json({ data: deal });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!getDeal(id)) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json({ data: updateDeal(id, payload) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!getDeal(id)) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  deleteDeal(id);
  return NextResponse.json({ ok: true });
}
