import { Suspense } from "react";
import { Avatar, Badge, Card, CardHeader, EmptyState, MiniBar, PageHeader } from "@/components/ui/primitives";
import { BarRows } from "@/components/charts/BarRows";
import { CompositionBar } from "@/components/charts/CompositionBar";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { GroupedColumns } from "@/components/charts/GroupedColumns";
import { StatTile } from "@/components/charts/StatTile";
import { TrendChart } from "@/components/charts/TrendChart";
import { PeriodTabs } from "@/components/analytics/PeriodTabs";
import { STATUS_COLOR, STATUS_LABEL } from "@/components/leads/constants";
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
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
  monthLabel,
} from "@/lib/format";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "분석" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const { months: monthsParam } = await searchParams;
  const months = clampMonths(Number(monthsParam ?? 12));
  const period = trailingMonths(months);
  const pipeline = await defaultPipeline();

  if (!pipeline) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <PageHeader title="분석" />
        <EmptyState
          title="분석할 데이터가 없습니다"
          description="npm run db:seed 를 실행해 데모 데이터를 생성하세요."
        />
      </div>
    );
  }

  // Twelve independent aggregates - issued together so the page waits on the
  // slowest query rather than the sum of all of them.
  const [
    metrics,
    trend,
    stages,
    funnel,
    velocity,
    sources,
    reps,
    statusMix,
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
    forecast(4),
  ]);
  const openStages = stages.filter((stage) => stage.kind === "open");

  const growth =
    metrics.previousWonValue > 0
      ? (metrics.wonValue - metrics.previousWonValue) / metrics.previousWonValue
      : null;

  const maxSourceLeads = Math.max(1, ...sources.map((source) => source.leads));
  const maxRepValue = Math.max(1, ...reps.map((rep) => rep.wonValue));
  const totalAgingValue = aging.reduce((sum, bucket) => sum + bucket.value, 0);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="분석"
        description={`${period.from} 이후 ${months}개월 구간 · 파이프라인 "${pipeline.name}" 기준`}
        actions={
          <Suspense fallback={null}>
            <PeriodTabs current={months} />
          </Suspense>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="확정 매출"
          value={formatCompactCurrency(metrics.wonValue)}
          delta={growth === null ? null : { value: growth, label: "직전 동기간 대비" }}
          hint={`${formatNumber(metrics.wonCount)}건`}
        />
        <StatTile
          label="가중 예측"
          value={formatCompactCurrency(metrics.weightedForecast)}
          hint={`전체 파이프라인 ${formatCompactCurrency(metrics.openPipelineValue)}`}
        />
        <StatTile
          label="수주율"
          value={formatPercent(metrics.winRate)}
          hint={`수주 ${metrics.wonCount} · 실패 ${metrics.lostCount}`}
        />
        <StatTile
          label="평균 수주 규모"
          value={formatCompactCurrency(metrics.avgDealSize)}
          hint={`영업 사이클 ${metrics.avgCycleDays.toFixed(0)}일`}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="신규 리드"
          value={formatNumber(metrics.newLeads)}
          hint={`검증 ${formatNumber(metrics.qualifiedLeads)}건`}
        />
        <StatTile
          label="리드 전환율"
          value={formatPercent(metrics.leadConversionRate)}
          hint={`전환 ${formatNumber(metrics.convertedLeads)}건`}
        />
        <StatTile
          label="진행 중 기회"
          value={formatNumber(metrics.openDealCount)}
          hint={`평균 ${formatCompactCurrency(metrics.openDealCount > 0 ? metrics.openPipelineValue / metrics.openDealCount : 0)}`}
        />
        <StatTile
          label="파이프라인 커버리지"
          value={
            metrics.wonValue > 0
              ? `${(metrics.openPipelineValue / (metrics.wonValue / months)).toFixed(1)}x`
              : "—"
          }
          hint="진행 중 금액 / 월평균 확정 매출"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="매출 및 파이프라인 추이"
            subtitle="확정 매출 · 실패 금액 · 신규 생성 파이프라인 (모두 원화)"
          />
          <TrendChart
            labels={trend.map((point) => monthLabel(point.month))}
            format="compactCurrency"
            height={280}
            series={[
              {
                key: "won",
                label: "확정 매출",
                color: "var(--series-1)",
                values: trend.map((point) => point.wonValue),
                area: true,
              },
              {
                key: "created",
                label: "신규 파이프라인",
                color: "var(--series-2)",
                values: trend.map((point) => point.createdValue),
              },
              {
                key: "lost",
                label: "실패 금액",
                color: "var(--series-3)",
                values: trend.map((point) => point.lostValue),
              },
            ]}
          />
        </Card>

        <Card>
          <CardHeader title="향후 4개월 예측" subtitle="예상 마감일 기준 (동일 단위)" />
          <GroupedColumns
            labels={forecastRows.map((row) => monthLabel(row.month))}
            format="compactCurrency"
            height={260}
            series={[
              {
                key: "weighted",
                label: "가중 예측",
                color: "var(--series-1)",
                values: forecastRows.map((row) => row.weighted),
              },
              {
                key: "best",
                label: "최대치",
                color: "var(--series-2)",
                values: forecastRows.map((row) => row.bestCase),
              },
            ]}
          />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="단계 전환 퍼널"
            subtitle="해당 기간에 생성된 기회가 각 단계에 도달한 비율"
          />
          {funnel.length > 0 ? (
            <FunnelChart
              rows={funnel.map((step) => ({
                label: step.stage,
                value: step.reached,
                rateFromTop: step.rateFromTop,
                rateFromPrev: step.rateFromPrev,
              }))}
            />
          ) : (
            <p className="py-8 text-center text-xs text-ink-3">해당 기간의 데이터가 없습니다.</p>
          )}

          <h3 className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            단계별 체류 기간
          </h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {velocity.map((stage) => (
              <li key={stage.stage} className="rounded-lg border border-line bg-surface-2/50 p-2.5">
                <p className="truncate text-[11px] text-ink-3">{stage.stage}</p>
                <p className="tabular mt-0.5 text-sm font-semibold text-ink">
                  {stage.avgDays.toFixed(1)}일
                </p>
                <p className="text-[10px] text-ink-3">{stage.transitions}회 이동</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="단계별 진행 중 금액" subtitle="열린 기회만 집계" />
          <BarRows
            format={formatCompactCurrency}
            rows={openStages.map((stage, index) => ({
              label: stage.stage,
              value: stage.value,
              note: `${stage.count}건 · 가중 ${formatCompactCurrency(stage.weightedValue)}`,
              color: ["var(--seq-650)", "var(--seq-550)", "var(--seq-450)", "var(--seq-350)"][
                index % 4
              ],
            }))}
          />

          <h3 className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            파이프라인 정체 구간
          </h3>
          <p className="mb-3 text-[11px] text-ink-3">
            마지막 변경 이후 경과일 · 총 {formatCompactCurrency(totalAgingValue)}
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {aging.map((bucket, index) => (
              <li key={bucket.label} className="rounded-lg border border-line bg-surface-2/50 p-2.5">
                <p className="text-[11px] text-ink-3">{bucket.label}</p>
                <p className="tabular mt-0.5 text-sm font-semibold text-ink">
                  {formatCompactCurrency(bucket.value)}
                </p>
                <p className="mt-1.5">
                  <MiniBar
                    value={bucket.value}
                    max={Math.max(1, ...aging.map((item) => item.value))}
                    color={
                      ["var(--status-good)", "var(--series-1)", "var(--status-warning)", "var(--status-critical)"][
                        index
                      ]
                    }
                  />
                </p>
                <p className="mt-1 text-[10px] text-ink-3">{bucket.count}건</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="유입 경로별 성과" subtitle="리드 수 · 전환율 · 확정 매출" />
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[460px] text-xs">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-ink-3">
                  <th className="pb-2 font-medium">경로</th>
                  <th className="pb-2 font-medium">리드</th>
                  <th className="pb-2 text-right font-medium">전환율</th>
                  <th className="pb-2 text-right font-medium">확정 매출</th>
                  <th className="pb-2 text-right font-medium">평균 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sources.map((source) => (
                  <tr key={source.source}>
                    <td className="py-2.5 font-medium text-ink">{source.source}</td>
                    <td className="py-2.5">
                      <span className="tabular mb-1 block text-ink-2">{source.leads}</span>
                      <span className="block w-20">
                        <MiniBar value={source.leads} max={maxSourceLeads} />
                      </span>
                    </td>
                    <td className="tabular py-2.5 text-right">
                      <Badge
                        tone={
                          source.conversionRate >= 0.3
                            ? "good"
                            : source.conversionRate >= 0.15
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {formatPercent(source.conversionRate, 0)}
                      </Badge>
                    </td>
                    <td className="tabular py-2.5 text-right font-semibold text-ink">
                      {formatCompactCurrency(source.wonValue)}
                    </td>
                    <td className="tabular py-2.5 text-right text-ink-2">
                      {source.avgScore.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="담당자별 실적" subtitle="확정 매출 · 할당량 달성률 · 수주율" />
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-line text-left text-[11px] text-ink-3">
                  <th className="pb-2 font-medium">담당자</th>
                  <th className="pb-2 font-medium">확정 매출</th>
                  <th className="pb-2 text-right font-medium">달성률</th>
                  <th className="pb-2 text-right font-medium">수주율</th>
                  <th className="pb-2 text-right font-medium">진행 중</th>
                  <th className="pb-2 text-right font-medium">활동</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {reps.map((rep) => (
                  <tr key={rep.ownerId}>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <Avatar name={rep.name} color={rep.color} size={24} />
                        <span>
                          <span className="block font-medium text-ink">{rep.name}</span>
                          <span className="block text-[10px] text-ink-3">{rep.team}</span>
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className="tabular mb-1 block font-semibold text-ink">
                        {formatCompactCurrency(rep.wonValue)}
                      </span>
                      <span className="block w-20">
                        <MiniBar value={rep.wonValue} max={maxRepValue} color={rep.color} />
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <Badge
                        tone={
                          rep.attainment >= 1
                            ? "good"
                            : rep.attainment >= 0.7
                              ? "warning"
                              : "critical"
                        }
                      >
                        {formatPercent(rep.attainment, 0)}
                      </Badge>
                    </td>
                    <td className="tabular py-2.5 text-right text-ink-2">
                      {formatPercent(rep.winRate, 0)}
                    </td>
                    <td className="tabular py-2.5 text-right text-ink-2">
                      {formatCompactCurrency(rep.openValue)}
                    </td>
                    <td className="tabular py-2.5 text-right text-ink-3">{rep.activityCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="리드 상태 분포" subtitle={`${months}개월간 생성된 리드`} />
          <CompositionBar
            format={formatNumber}
            segments={LEAD_STATUSES.map((status) => ({
              label: STATUS_LABEL[status],
              value: statusMix.find((row) => row.label === status)?.count ?? 0,
              color: STATUS_COLOR[status as LeadStatus],
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="실패 사유" subtitle="금액 기준" />
          {lostReasons.length > 0 ? (
            <BarRows
              compact
              format={formatCompactCurrency}
              rows={lostReasons.map((reason) => ({
                label: reason.label,
                value: reason.value,
                note: `${reason.count}건`,
                color: "var(--status-critical)",
              }))}
            />
          ) : (
            <p className="py-8 text-center text-xs text-ink-3">실패한 기회가 없습니다.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="산업군별 기회" subtitle="진행 중 + 확정 금액" />
          <BarRows
            compact
            format={formatCompactCurrency}
            rows={industries.map((industry) => ({
              label: industry.label,
              value: industry.value,
              note: `${industry.count}건`,
              color: "var(--series-1)",
            }))}
          />
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-ink-3">
        총 진행 중 파이프라인 {formatCurrency(metrics.openPipelineValue)} · 확정 매출{" "}
        {formatCurrency(metrics.wonValue)} · 원본 지표는{" "}
        <code className="text-[10px]">GET /api/analytics?months={months}</code> 에서 JSON으로도
        확인할 수 있습니다.
      </p>
    </div>
  );
}

function clampMonths(value: number): number {
  if (!Number.isFinite(value)) return 12;
  return Math.min(24, Math.max(1, Math.round(value)));
}
