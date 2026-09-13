import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/primitives";
import { AppShortcuts } from "@/components/today/AppShortcuts";
import { StatusMessage } from "@/components/today/StatusMessage";
import { StatTile } from "@/components/charts/StatTile";
import { listAppLinks } from "@/lib/repositories/appLinks";
import { getSetting, STATUS_MESSAGE_KEY } from "@/lib/repositories/settings";
import { listUsers } from "@/lib/repositories/users";
import { openTasks } from "@/lib/repositories/activities";
import { kpis, trailingMonths } from "@/lib/repositories/analytics";
import { formatCompactCurrency, formatNumber, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "오늘" };

/** The app is Korean-language and KRW-denominated; greet on Seoul time. */
const TIME_ZONE = "Asia/Seoul";

export default async function TodayPage() {
  const [links, statusMessage, users, tasks, metrics] = await Promise.all([
    listAppLinks(),
    getSetting(STATUS_MESSAGE_KEY),
    listUsers(),
    openTasks(5),
    kpis(trailingMonths(1)),
  ]);

  // No sign-in yet, so the workspace admin stands in for "the current user".
  const currentUser = users.find((user) => user.role === "admin") ?? users[0];
  const now = new Date();
  const { greeting, emoji } = greetingFor(now);

  return (
    <div className="mx-auto max-w-[1400px]">
      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              {currentUser ? `${currentUser.name}님 ` : ""}
              {greeting}
              <span className="ml-1.5" aria-hidden="true">
                {emoji}
              </span>
            </h1>
            <div className="mt-1.5">
              <StatusMessage initial={statusMessage ?? ""} />
            </div>
          </div>
          <p className="tabular shrink-0 text-xs text-ink-3">{formatFullDate(now)}</p>
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <AppShortcuts initialLinks={links} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="이번 달 확정 매출"
          value={formatCompactCurrency(metrics.wonValue)}
          hint={`${formatNumber(metrics.wonCount)}건 수주`}
        />
        <StatTile
          label="진행 중 파이프라인"
          value={formatCompactCurrency(metrics.openPipelineValue)}
          hint={`${formatNumber(metrics.openDealCount)}건`}
        />
        <StatTile
          label="이번 달 신규 리드"
          value={formatNumber(metrics.newLeads)}
          hint={`검증 ${formatNumber(metrics.qualifiedLeads)}건`}
        />
        <StatTile
          label="가중 예측"
          value={formatCompactCurrency(metrics.weightedForecast)}
          hint="열린 기회 × 성공 확률"
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="오늘의 할 일"
          subtitle="완료되지 않은 활동"
          action={
            <Link href="/dashboard" className="text-[11px] text-[var(--accent-ink)] hover:underline">
              대시보드에서 자세히 →
            </Link>
          }
        />
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="min-w-0 flex-1 truncate text-xs text-ink">{task.subject}</span>
              <span className="shrink-0 text-[11px] text-ink-3">
                {task.owner_name} · {formatRelative(task.due_at)}
              </span>
            </li>
          ))}
          {tasks.length === 0 ? (
            <li className="py-6 text-center text-xs text-ink-3">예정된 업무가 없습니다.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}

function greetingFor(now: Date): { greeting: string; emoji: string } {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: TIME_ZONE,
    }).format(now),
  );

  if (hour >= 5 && hour < 11) return { greeting: "좋은 아침이에요.", emoji: "☀️" };
  if (hour >= 11 && hour < 17) return { greeting: "활기찬 오후 보내세요.", emoji: "🌤️" };
  if (hour >= 17 && hour < 21) return { greeting: "오늘도 수고하셨어요.", emoji: "🌆" };
  return { greeting: "편안한 밤 되세요.", emoji: "🌙" };
}

function formatFullDate(now: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: TIME_ZONE,
  }).format(now);
}
