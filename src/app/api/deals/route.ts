import { NextResponse } from "next/server";
import { createDeal, listDeals } from "@/lib/repositories/deals";
import { defaultPipeline } from "@/lib/repositories/pipelines";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pipelineId = params.get("pipeline") ?? defaultPipeline()?.id;
  if (!pipelineId) return NextResponse.json({ error: "No pipeline configured" }, { status: 404 });

  return NextResponse.json({
    data: listDeals({
      pipelineId,
      ownerId: params.get("owner") ?? "all",
      search: params.get("q") ?? "",
      status: (params.get("status") ?? "all") as "open" | "won" | "lost" | "all",
    }),
  });
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = String(payload.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 422 });
  if (!payload.stage_id) {
    return NextResponse.json({ error: "stage_id is required" }, { status: 422 });
  }

  const pipelineId = payload.pipeline_id ? String(payload.pipeline_id) : defaultPipeline()?.id;
  if (!pipelineId) return NextResponse.json({ error: "No pipeline configured" }, { status: 404 });

  const deal = createDeal({
    title,
    pipeline_id: pipelineId,
    stage_id: String(payload.stage_id),
    company_id: payload.company_id ? String(payload.company_id) : null,
    contact_id: payload.contact_id ? String(payload.contact_id) : null,
    owner_id: payload.owner_id ? String(payload.owner_id) : null,
    amount: Number(payload.amount ?? 0),
    expected_close_date: payload.expected_close_date
      ? String(payload.expected_close_date)
      : null,
  });

  if (!deal) return NextResponse.json({ error: "Unknown stage" }, { status: 422 });
  return NextResponse.json({ data: deal }, { status: 201 });
}
