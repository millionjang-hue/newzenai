import { NextResponse } from "next/server";
import {
  conversionFunnel,
  forecast,
  industryMix,
  kpis,
  leadStatusMix,
  lostReasonMix,
  monthlyTrend,
  pipelineAging,
  pipelineByStage,
  repPerformance,
  sourcePerformance,
  stageVelocity,
  trailingMonths,
} from "@/lib/repositories/analytics";
import { defaultPipeline } from "@/lib/repositories/pipelines";

export const dynamic = "force-dynamic";

/** Machine-readable mirror of the analytics tab - handy for exports and BI. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const months = Math.min(24, Math.max(1, Number(params.get("months") ?? 12)));
  const period = trailingMonths(months);

  const pipeline = defaultPipeline();
  if (!pipeline) return NextResponse.json({ error: "No pipeline configured" }, { status: 404 });

  return NextResponse.json({
    period,
    kpis: kpis(period),
    monthly: monthlyTrend(period),
    stages: pipelineByStage(pipeline.id),
    funnel: conversionFunnel(pipeline.id, period),
    velocity: stageVelocity(pipeline.id),
    sources: sourcePerformance(period),
    reps: repPerformance(period),
    leadStatus: leadStatusMix(period),
    lostReasons: lostReasonMix(period),
    industries: industryMix(),
    aging: pipelineAging(),
    forecast: forecast(),
  });
}
