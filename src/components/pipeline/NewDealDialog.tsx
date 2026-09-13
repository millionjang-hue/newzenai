"use client";

import { useEffect, useState } from "react";
import type { Company, Stage, User } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export function NewDealDialog({
  stages,
  pipelineId,
  users,
  companies,
  onClose,
  onCreated,
}: {
  stages: Stage[];
  pipelineId: string;
  users: User[];
  companies: Company[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const openStages = stages.filter((stage) => stage.kind === "open");
  const [form, setForm] = useState({
    title: "",
    stage_id: openStages[0]?.id ?? "",
    company_id: "",
    owner_id: "",
    amount: 30_000_000,
    expected_close_date: new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pipeline_id: pipelineId,
          company_id: form.company_id || null,
          owner_id: form.owner_id || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "기회를 생성하지 못했습니다.");
      onCreated();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "기회를 생성하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="신규 영업 기회"
        className="animate-in relative w-full max-w-md rounded-xl border border-line bg-surface-1 p-5 shadow-[var(--shadow-lg)]"
      >
        <h2 className="mb-4 text-sm font-semibold text-ink">신규 영업 기회</h2>

        {error ? (
          <p className="mb-3 rounded-lg border border-[color-mix(in_srgb,var(--status-critical)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] px-3 py-2 text-xs text-[var(--status-critical)]">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">
              기회명 <span className="text-[var(--status-critical)]">*</span>
            </span>
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="예: 누리테크 - 전사 도입"
              className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
            />
          </label>

          <label className="col-span-2 block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">고객사</span>
            <select
              value={form.company_id}
              onChange={(event) => setForm({ ...form, company_id: event.target.value })}
              className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
            >
              <option value="">미지정</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">시작 단계</span>
            <select
              value={form.stage_id}
              onChange={(event) => setForm({ ...form, stage_id: event.target.value })}
              className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
            >
              {openStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">담당자</span>
            <select
              value={form.owner_id}
              onChange={(event) => setForm({ ...form, owner_id: event.target.value })}
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

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">금액 (원)</span>
            <input
              type="number"
              min={0}
              step={1_000_000}
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
              className="tabular w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
            />
            <span className="mt-1 block text-[10px] text-ink-3">{formatCurrency(form.amount)}</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">예상 마감일</span>
            <input
              type="date"
              value={form.expected_close_date}
              onChange={(event) =>
                setForm({ ...form, expected_close_date: event.target.value })
              }
              className="tabular w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 hover:text-ink"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {busy ? "생성 중…" : "기회 생성"}
          </button>
        </div>
      </form>
    </div>
  );
}
