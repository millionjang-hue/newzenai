import Link from "next/link";
import { Avatar, Badge, Card, CardHeader, MiniBar, PageHeader } from "@/components/ui/primitives";
import { BarRows } from "@/components/charts/BarRows";
import { StatTile } from "@/components/charts/StatTile";
import { TrendChart } from "@/components/charts/TrendChart";
import { openTasks, recentActivities } from "@/lib/repositories/activities";
import { listDeals } from "@/lib/repositories/deals";
import { defaultPipeline } from "@/lib/repositories/pipelines";
import { listLeads } from "@/lib/repositories/leads";
import {
  kpis,
  monthlyTrend,
  pipelineByStage,
  repPerformance,
  trailingMonths,
} from "@/lib/repositories/analytics";
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRelative,
  monthLabel,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "대시보드" };

const ACTIVITY_ICON: Record<string, string> = {
  call: "☎",
  email: "✉",
  meeting: "◷",
  note: "✎",
  task: "☑",
};

export default async function DashboardPage() {
  const period = trailingMonths(12);
  const pipeline = await defaultPipeline();

  // Independent queries - run them together rather than in sequence.
  const [metrics, trend, allStages, reps] = await Promise.all([
    kpis(period),
    monthlyTrend(period),
    pipeline ? pipelineByStage(pipeline.id) : Promise.resolve([]),
    repPerformance(trailingMonths(3)),
  ]);
  const stages = allStages.filter((stage) => stage.kind === "open");
  const topReps = reps.slice(0, 5);

  const growth =
    metrics.previousWonValue > 0
      ? (metrics.wonValue - metrics.previousWonValue) / metrics.previousWonValue
      : null;

  const today = new Date().toISOString().slice(0, 10);
  const [rawOpenDeals, hotLeads, tasks, activities] = await Promise.all([
    listDeals({ pipelineId: pipeline?.id, status: "open" }),
    listLeads({ status: "qualified", sort: "score_desc", limit: 6 }),
    openTasks(6),
    recentActivities(7),
  ]);
  const openDeals = rawOpenDeals.filter((deal) => deal.expected_close_date);
  const overdue = openDeals
    .filter((deal) => deal.expected_close_date! < today)
    .sort((a, b) => (a.expected_close_date! < b.expected_close_date! ? -1 : 1));
  // Overdue first (they are the most urgent), then the nearest upcoming dates.
  const closingSoon = [
    ...overdue.slice(0, 2),
    ...openDeals
      .filter((deal) => deal.expected_close_date! >= today)
      .sort((a, b) => (a.expected_close_date! < b.expected_close_date! ? -1 : 1)),
  ].slice(0, 6);

  const maxRepValue = Math.max(1, ...topReps.map((rep) => rep.wonValue));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="대시보드"
        description={`최근 12개월 실적 요약 · ${period.from} ~ 오늘`}
        actions={
          <>
            <Link
              href="/leads"
              className="rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink-2 hover:text-ink"
            >
              리드 관리
            </Link>
            <Link
              href="/pipeline"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              파이프라인 열기
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="확정 매출 (12개월)"
          value={formatCompactCurrency(metrics.wonValue)}
          delta={growth === null ? null : { value: growth, label: "직전 동기간 대비" }}
          hint={`${formatNumber(metrics.wonCount)}건 수주`}
        />
        <StatTile
          label="진행 중 파이프라인"
          value={formatCompactCurrency(metrics.openPipelineValue)}
          hint={`${formatNumber(metrics.openDealCount)}건 · 가중 ${formatCompactCurrency(metrics.weightedForecast)}`}
        />
        <StatTile
          label="수주율"
          value={formatPercent(metrics.winRate)}
          hint={`수주 ${metrics.wonCount} / 실패 ${metrics.lostCount}`}
        />
        <StatTile
          label="평균 영업 사이클"
          value={`${metrics.avgCycleDays.toFixed(0)}일`}
          hint={`평균 수주 규모 ${formatCompactCurrency(metrics.avgDealSize)}`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="월별 매출 추이"
            subtitle="확정 매출과 신규 생성된 파이프라인 (동일 단위)"
            action={
              <Link href="/analytics" className="text-[11px] text-[var(--accent-ink)] hover:underline">
                분석 탭에서 자세히 →
              </Link>
            }
          />
          <TrendChart
            labels={trend.map((point) => monthLabel(point.month))}
            format="compactCurrency"
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
            ]}
          />
        </Card>

        <Card>
          <CardHeader title="단계별 파이프라인" subtitle="진행 중 기회의 금액 분포" />
          {stages.length > 0 ? (
            <BarRows
              format={formatCompactCurrency}
              rows={stages.map((stage, index) => ({
                label: stage.stage,
                value: stage.value,
                display: formatCompactCurrency(stage.value),
                note: `${stage.count}건 · 가중 ${formatCompactCurrency(stage.weightedValue)}`,
                color: ["var(--seq-650)", "var(--seq-550)", "var(--seq-450)", "var(--seq-350)"][
                  index % 4
                ],
              }))}
            />
          ) : (
            <p className="text-xs text-ink-3">파이프라인이 설정되지 않았습니다.</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="마감 임박 기회"
            subtitle={
              overdue.length > 0
                ? `예상 마감일 순 · 지연 ${formatNumber(overdue.length)}건`
                : "예상 마감일 순"
            }
          />
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {closingSoon.map((deal) => {
              const isOverdue = deal.expected_close_date! < today;
              return (
                <li key={deal.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar name={deal.owner_name ?? "?"} color={deal.owner_color} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">{deal.title}</p>
                    <p className="text-[11px] text-ink-3">
                      {deal.stage_name} · {formatRelative(deal.expected_close_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-xs font-semibold text-ink">
                      {formatCompactCurrency(deal.amount)}
                    </p>
                    {isOverdue ? (
                      <Badge tone="critical">지연</Badge>
                    ) : (
                      <span className="tabular text-[10px] text-ink-3">
                        {formatPercent(deal.probability, 0)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
            {closingSoon.length === 0 ? (
              <li className="py-6 text-center text-xs text-ink-3">마감 예정 기회가 없습니다.</li>
            ) : null}
          </ul>
        </Card>

        <Card>
          <CardHeader title="검증된 리드" subtitle="점수 상위 · 전환 대기" />
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {hotLeads.map((lead) => (
              <li key={lead.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">
                    {lead.last_name}
                    {lead.first_name}
                    <span className="ml-1.5 font-normal text-ink-3">{lead.company_name}</span>
                  </p>
                  <p className="text-[11px] text-ink-3">
                    {lead.source} · 최근 접촉 {formatRelative(lead.last_touch_at)}
                  </p>
                </div>
                <div className="w-16 shrink-0">
                  <p className="tabular mb-1 text-right text-[11px] font-semibold text-ink">
                    {lead.score}
                  </p>
                  <MiniBar value={lead.score} max={100} color="var(--series-3)" />
                </div>
              </li>
            ))}
            {hotLeads.length === 0 ? (
              <li className="py-6 text-center text-xs text-ink-3">검증된 리드가 없습니다.</li>
            ) : null}
          </ul>
          <Link
            href="/leads?status=qualified"
            className="mt-3 block text-[11px] text-[var(--accent-ink)] hover:underline"
          >
            전체 보기 →
          </Link>
        </Card>

        <Card>
          <CardHeader title="예정된 업무" subtitle="완료되지 않은 활동" />
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {tasks.map((task) => {
              const isOverdue = task.due_at! < new Date().toISOString();
              return (
                <li key={task.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                  <span
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-surface-2 text-[10px] text-ink-2"
                    aria-hidden="true"
                  >
                    {ACTIVITY_ICON[task.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-ink">{task.subject}</p>
                    <p className="text-[11px] text-ink-3">
                      {task.owner_name} · {formatRelative(task.due_at)}
                    </p>
                  </div>
                  {isOverdue ? <Badge tone="warning">기한 초과</Badge> : null}
                </li>
              );
            })}
            {tasks.length === 0 ? (
              <li className="py-6 text-center text-xs text-ink-3">예정된 업무가 없습니다.</li>
            ) : null}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="담당자별 실적" subtitle="최근 3개월 확정 매출 · 할당량 달성률" />
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] text-ink-3">
                <th className="pb-2 font-medium">담당자</th>
                <th className="pb-2 font-medium">확정 매출</th>
                <th className="hidden pb-2 font-medium sm:table-cell">달성률</th>
                <th className="pb-2 text-right font-medium">진행 중</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {topReps.map((rep) => (
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
                    <span className="tabular block font-semibold text-ink">
                      {formatCompactCurrency(rep.wonValue)}
                    </span>
                    <span className="mt-1 block w-24">
                      <MiniBar value={rep.wonValue} max={maxRepValue} color={rep.color} />
                    </span>
                  </td>
                  <td className="hidden py-2.5 sm:table-cell">
                    <Badge
                      tone={
                        rep.attainment >= 1 ? "good" : rep.attainment >= 0.7 ? "warning" : "critical"
                      }
                    >
                      {formatPercent(rep.attainment, 0)}
                    </Badge>
                  </td>
                  <td className="tabular py-2.5 text-right text-ink-2">
                    {formatCompactCurrency(rep.openValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="최근 활동" subtitle="완료된 영업 활동" />
          <ul className="flex flex-col gap-3">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-start gap-2.5">
                <Avatar name={activity.owner_name ?? "?"} color={activity.owner_color} size={24} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink">
                    <span className="mr-1 text-ink-3" aria-hidden="true">
                      {ACTIVITY_ICON[activity.type]}
                    </span>
                    {activity.subject}
                  </p>
                  <p className="text-[11px] text-ink-3">
                    {activity.owner_name} · {formatRelative(activity.completed_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="mt-6 text-[11px] text-ink-3">
        총 파이프라인 가치 {formatCurrency(metrics.openPipelineValue)} · 신규 리드{" "}
        {formatNumber(metrics.newLeads)}건 · 리드 전환율 {formatPercent(metrics.leadConversionRate)}
      </p>
    </div>
  );
}
