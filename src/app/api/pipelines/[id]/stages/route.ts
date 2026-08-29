import { NextResponse } from "next/server";
import { listStages } from "@/lib/repositories/pipelines";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ data: listStages(id) });
}
