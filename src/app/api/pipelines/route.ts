import { NextResponse } from "next/server";
import { listPipelines, listStages } from "@/lib/repositories/pipelines";

export const dynamic = "force-dynamic";

export async function GET() {
  const pipelines = await listPipelines();
  const withStages = await Promise.all(
    pipelines.map(async (pipeline) => ({ ...pipeline, stages: await listStages(pipeline.id) })),
  );
  return NextResponse.json({ data: withStages });
}
