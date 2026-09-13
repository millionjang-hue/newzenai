"use client";

import { useEffect, useState } from "react";
import { Avatar, Badge, cx } from "@/components/ui/primitives";
import { ACTIVITY_ICON } from "@/components/leads/constants";
import { formatCurrency, formatDate, formatPercent, formatRelative } from "@/lib/format";
import { LOST_REASONS, type ActivityWithOwner, type DealWithRelations, type Stage, type User } from "@/lib/types";

export function DealDrawer({
  deal,
  stages,
  users,
  onClose,
  onChanged,
}: {
  deal: DealWithRelations;
  stages: Stage[];
  users: User[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [activities, setActivities] = useState<ActivityWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(deal.amount);

  useEffect(() => {
    setAmount(deal.amount);
  }, [deal.amount]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/deals/${deal.id}/activities`)
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((payload: { data?: ActivityWithOwner[] }) => {
        if (!cancelled) setActivities(payload.data ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "요청 실패");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  };

  const move = async (stageId: string, lostReason?: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/deals/${deal.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId, lost_reason: lostReason ?? null }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "요청 실패");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  };

  const wonStage = stages.find((stage) => stage.kind === "won");
  const lostStage = stages.find((stage) => stage.kind === "lost");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${deal.title} 상세`}
        className="animate-in relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface-1 shadow-[var(--shadow-lg)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={deal.status === "won" ? "good" : deal.status === "lost" ? "critical" : "accent"}
              >
                {deal.stage_name}
              </Badge>
              <span className="tabular text-[11px] text-ink-3">
                성공 확률 {formatPercent(deal.probability, 0)}
              </span>
            </div>
            <h2 className="mt-1 truncate text-base font-semibold text-ink">{deal.title}</h2>
            <p className="truncate text-xs text-ink-2">
              {deal.company_name ?? "회사 미지정"}
              {deal.contact_name ? ` · ${deal.contact_name}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2 py-1 text-xs text-ink-2 hover:text-ink"
          >
            닫기
          </button>
        </header>

        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="mb-3 rounded-lg border border-[color-mix(in_srgb,var(--status-critical)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] px-3 py-2 text-xs text-[var(--status-critical)]">
              {error}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">거래 금액 (원)</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step={1_000_000}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
                className="tabular min-w-0 flex-1 rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={busy || amount === deal.amount}
                onClick={() => patch({ amount })}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 disabled:opacity-50 hover:text-ink"
              >
                저장
              </button>
            </div>
            <span className="mt-1 block text-[11px] text-ink-3">{formatCurrency(amount)}</span>
          </label>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <Field label="예상 마감" value={formatDate(deal.expected_close_date)} />
            <Field label="생성일" value={formatDate(deal.created_at)} />
            <Field label="최근 변경" value={formatRelative(deal.updated_at)} />
            <Field
              label="가중 금액"
              value={formatCurrency(Math.round(deal.amount * deal.probability))}
            />
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-2">단계</span>
              <select
                value={deal.stage_id}
                disabled={busy}
                onChange={(event) => void move(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-2">담당자</span>
              <select
                value={deal.owner_id ?? ""}
                disabled={busy}
                onChange={(event) => patch({ owner_id: event.target.value || null })}
                className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
              >
                <option value="">미지정</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {deal.status === "lost" ? (
            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-medium text-ink-2">실패 사유</span>
              <select
                value={deal.lost_reason ?? ""}
                disabled={busy}
                onChange={(event) => patch({ lost_reason: event.target.value })}
                className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
              >
                <option value="">선택</option>
                {LOST_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <section className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              활동 기록 ({activities.length})
            </h3>
            {loading && activities.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-3">불러오는 중…</p>
            ) : activities.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-3">기록된 활동이 없습니다.</p>
            ) : (
              <ol className="relative flex flex-col gap-3 border-l border-line pl-4">
                {activities.map((activity) => (
                  <li key={activity.id} className="relative">
                    <span
                      className="absolute -left-[21px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-[var(--surface-1)] bg-surface-3 text-[7px]"
                      aria-hidden="true"
                    >
                      {ACTIVITY_ICON[activity.type]}
                    </span>
                    <p className="text-xs text-ink">{activity.subject}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-3">
                      <Avatar
                        name={activity.owner_name ?? "?"}
                        color={activity.owner_color}
                        size={14}
                      />
                      {activity.owner_name} ·{" "}
                      {formatRelative(activity.completed_at ?? activity.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {deal.status === "open" && wonStage && lostStage ? (
          <footer className="grid grid-cols-2 gap-2 border-t border-line px-5 py-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void move(wonStage.id)}
              className={cx(
                "rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50",
              )}
              style={{ background: "var(--status-good)" }}
            >
              수주 처리
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void move(lostStage.id, "No decision")}
              className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-[var(--status-critical)] disabled:opacity-50"
            >
              실패 처리
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="tabular mt-0.5 truncate text-ink">{value}</dd>
    </div>
  );
}
