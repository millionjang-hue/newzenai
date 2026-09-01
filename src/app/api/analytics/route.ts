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

  const pipeline = await defaultPipeline();
  if (!pipeline) return NextResponse.json({ error: "No pipeline configured" }, { status: 404 });

  const [
    kpiRow,
    monthly,
    stages,
    funnel,
    velocity,
    sources,
    reps,
    leadStatus,
    lostReasons,
    industries,
    aging,
    forecastRows,
  ] = await Promise.all([
    kpis(period),
    monthlyTrend(period),
    pipelineByStage(pipeline.id),
    conversionFunnel(pipeline.id, period),
    stageVelocity(pipeline.id),
    sourcePerformance(period),
    repPerformance(period),
    leadStatusMix(period),
    lostReasonMix(period),
    industryMix(),
    pipelineAging(),
    forecast(),
  ]);

  return NextResponse.json({
    period,
    kpis: kpiRow,
    monthly,
    stages,
    funnel,
    velocity,
    sources,
    reps,
    leadStatus,
    lostReasons,
    industries,
    aging,
    forecast: forecastRows,
  });
}
