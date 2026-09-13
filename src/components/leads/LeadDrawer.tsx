"use client";

import { useEffect, useState } from "react";
import { Avatar, Badge, cx } from "@/components/ui/primitives";
import { ACTIVITY_ICON, ACTIVITY_LABEL, STATUS_LABEL, STATUS_TONE } from "@/components/leads/constants";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatRelative,
} from "@/lib/format";
import {
  ACTIVITY_TYPES,
  LEAD_STATUSES,
  type ActivityType,
  type ActivityWithOwner,
  type LeadStatus,
  type LeadWithOwner,
  type User,
} from "@/lib/types";

export function LeadDrawer({
  lead,
  users,
  onClose,
  onChanged,
}: {
  lead: LeadWithOwner;
  users: User[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [activities, setActivities] = useState<ActivityWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ type: "call" as ActivityType, subject: "" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leads/${lead.id}/activities`)
      .then((response) => response.json())
      .then((payload: { data: ActivityWithOwner[] }) => {
        if (!cancelled) setActivities(payload.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("활동 내역을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

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
      const response = await fetch(`/api/leads/${lead.id}`, {
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

  const logActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.subject.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: draft.type, subject: draft.subject.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "요청 실패");
      setActivities(payload.data ?? []);
      setDraft({ ...draft, subject: "" });
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "전환에 실패했습니다.");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "전환에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

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
        aria-label={`${lead.last_name}${lead.first_name} 리드 상세`}
        className="animate-in relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface-1 shadow-[var(--shadow-lg)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-ink">
                {lead.last_name}
                {lead.first_name}
              </h2>
              <Badge tone={STATUS_TONE[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-2">
              {lead.title ? `${lead.title} · ` : ""}
              {lead.company_name}
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

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <Field label="이메일" value={lead.email} mono />
            <Field label="연락처" value={lead.phone ?? "—"} mono />
            <Field label="유입 경로" value={lead.source} />
            <Field label="예상 규모" value={formatCurrency(lead.estimated_value)} />
            <Field label="등록일" value={formatDate(lead.created_at)} />
            <Field label="최근 접촉" value={formatRelative(lead.last_touch_at)} />
          </dl>

          <div className="mt-4 rounded-lg border border-line bg-surface-2/60 p-3">
            <p className="mb-1.5 text-[11px] font-medium text-ink-3">리드 점수</p>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${lead.score}%`,
                    background:
                      lead.score >= 70
                        ? "var(--series-3)"
                        : lead.score >= 45
                          ? "var(--series-4)"
                          : "var(--series-8)",
                  }}
                />
              </div>
              <span className="tabular text-sm font-semibold text-ink">{lead.score}</span>
            </div>
          </div>

          {lead.notes ? (
            <p className="mt-3 rounded-lg border border-line bg-surface-2/60 p-3 text-xs leading-relaxed text-ink-2">
              {lead.notes}
            </p>
          ) : null}

          <section className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              담당자 / 상태
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="relative block">
                <span className="sr-only">상태</span>
                <select
                  value={lead.status}
                  disabled={busy || lead.status === "converted"}
                  onChange={(event) => patch({ status: event.target.value as LeadStatus })}
                  className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs disabled:opacity-60"
                >
                  {LEAD_STATUSES.filter((status) => status !== "converted").map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                  {lead.status === "converted" ? <option value="converted">전환 완료</option> : null}
                </select>
              </label>
              <label className="relative block">
                <span className="sr-only">담당자</span>
                <select
                  value={lead.owner_id ?? ""}
                  disabled={busy}
                  onChange={(event) => patch({ owner_id: event.target.value || null })}
                  className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs disabled:opacity-60"
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
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              활동 기록 ({activities.length})
            </h3>

            <form onSubmit={logActivity} className="mb-3 flex gap-2">
              <select
                value={draft.type}
                onChange={(event) =>
                  setDraft({ ...draft, type: event.target.value as ActivityType })
                }
                className="rounded-lg border border-line bg-surface-1 px-2 py-1.5 text-xs"
              >
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ACTIVITY_LABEL[type]}
                  </option>
                ))}
              </select>
              <input
                value={draft.subject}
                onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                placeholder="활동 내용을 기록하세요"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={busy || !draft.subject.trim()}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                기록
              </button>
            </form>

            {loading ? (
              <p className="py-6 text-center text-xs text-ink-3">불러오는 중…</p>
            ) : activities.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-3">아직 기록된 활동이 없습니다.</p>
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
                    {activity.body ? (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{activity.body}</p>
                    ) : null}
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-3">
                      <Avatar
                        name={activity.owner_name ?? "?"}
                        color={activity.owner_color}
                        size={14}
                      />
                      {activity.owner_name} ·{" "}
                      {formatRelative(activity.completed_at ?? activity.created_at)}
                      {activity.completed_at ? null : (
                        <Badge tone="warning" className="ml-1">
                          예정
                        </Badge>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <footer className="border-t border-line px-5 py-3">
          {lead.status === "converted" ? (
            <p className="text-center text-xs text-ink-3">
              이 리드는 이미 영업 기회로 전환되었습니다.
            </p>
          ) : (
            <button
              type="button"
              onClick={convert}
              disabled={busy}
              className={cx(
                "w-full rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50",
              )}
              style={{ background: "var(--accent)" }}
            >
              영업 기회로 전환 · {formatCompactCurrency(lead.estimated_value)}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className={cx("mt-0.5 truncate text-ink", mono && "tabular")} title={value}>
        {value}
      </dd>
    </div>
  );
}
