import { NextResponse } from "next/server";
import { reorderAppLinks } from "@/lib/repositories/appLinks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(payload.ordered_ids)) {
    return NextResponse.json({ error: "ordered_ids is required" }, { status: 422 });
  }

  const ids = (payload.ordered_ids as unknown[]).map(String);
  return NextResponse.json({ data: await reorderAppLinks(ids) });
}
