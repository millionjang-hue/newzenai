import { NextResponse } from "next/server";
import { completeActivity } from "@/lib/repositories/activities";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await completeActivity(id);
  return NextResponse.json({ ok: true });
}
