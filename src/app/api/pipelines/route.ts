import { NextResponse } from "next/server";
import { listPipelines, listStages } from "@/lib/repositories/pipelines";

export const dynamic = "force-dynamic";

export async function GET() {
  const pipelines = listPipelines();
  return NextResponse.json({
    data: pipelines.map((pipeline) => ({ ...pipeline, stages: listStages(pipeline.id) })),
  });
}
