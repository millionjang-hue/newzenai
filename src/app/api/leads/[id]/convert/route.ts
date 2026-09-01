import { NextResponse } from "next/server";
import { convertLead } from "@/lib/repositories/leads";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    // An empty body is valid - the lead's own estimate is used.
  }

  const result = await convertLead(id, {
    amount: payload.amount === undefined ? undefined : Number(payload.amount),
    expectedCloseDate: payload.expected_close_date
      ? String(payload.expected_close_date)
      : undefined,
    ownerId: payload.owner_id ? String(payload.owner_id) : undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ data: result }, { status: 201 });
}
