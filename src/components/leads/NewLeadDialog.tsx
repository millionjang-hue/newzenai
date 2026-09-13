"use client";

import { useEffect, useState } from "react";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadStatus, type User } from "@/lib/types";
import { STATUS_LABEL } from "@/components/leads/constants";

const EMPTY = {
  last_name: "",
  first_name: "",
  email: "",
  phone: "",
  title: "",
  company_name: "",
  source: LEAD_SOURCES[0] as string,
  status: "new" as LeadStatus,
  score: 45,
  owner_id: "",
  estimated_value: 20_000_000,
  notes: "",
};

export function NewLeadDialog({
  users,
  onClose,
  onCreated,
}: {
  users: User[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
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
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, owner_id: form.owner_id || null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "리드를 생성하지 못했습니다.");
      onCreated();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "리드를 생성하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

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
        aria-label="신규 리드 등록"
        className="animate-in relative w-full max-w-lg rounded-xl border border-line bg-surface-1 p-5 shadow-[var(--shadow-lg)]"
      >
        <h2 className="text-sm font-semibold text-ink">신규 리드 등록</h2>
        <p className="mt-0.5 mb-4 text-xs text-ink-3">
          필수 항목은 이름, 이메일, 회사명입니다.
        </p>

        {error ? (
          <p className="mb-3 rounded-lg border border-[color-mix(in_srgb,var(--status-critical)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] px-3 py-2 text-xs text-[var(--status-critical)]">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Text label="성" value={form.last_name} onChange={(v) => set("last_name", v)} required />
          <Text
            label="이름"
            value={form.first_name}
            onChange={(v) => set("first_name", v)}
            required
          />
          <Text
            label="이메일"
            type="email"
            value={form.email}
            onChange={(v) => set("email", v)}
            required
            className="col-span-2"
          />
          <Text label="연락처" value={form.phone} onChange={(v) => set("phone", v)} />
          <Text label="직함" value={form.title} onChange={(v) => set("title", v)} />
          <Text
            label="회사명"
            value={form.company_name}
            onChange={(v) => set("company_name", v)}
            required
            className="col-span-2"
          />

          <Select
            label="유입 경로"
            value={form.source}
            onChange={(v) => set("source", v)}
            options={LEAD_SOURCES.map((source) => ({ value: source, label: source }))}
          />
          <Select
            label="상태"
            value={form.status}
            onChange={(v) => set("status", v as LeadStatus)}
            options={LEAD_STATUSES.filter((status) => status !== "converted").map((status) => ({
              value: status,
              label: STATUS_LABEL[status],
            }))}
          />
          <Select
            label="담당자"
            value={form.owner_id}
            onChange={(v) => set("owner_id", v)}
            options={[
              { value: "", label: "미지정" },
              ...users.map((user) => ({ value: user.id, label: user.name })),
            ]}
          />
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">
              예상 규모 (원)
            </span>
            <input
              type="number"
              min={0}
              step={1_000_000}
              value={form.estimated_value}
              onChange={(event) => set("estimated_value", Number(event.target.value))}
              className="tabular w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
            />
          </label>

          <label className="col-span-2 block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">
              리드 점수 · <span className="tabular">{form.score}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={form.score}
              onChange={(event) => set("score", Number(event.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </label>

          <label className="col-span-2 block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">메모</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              className="w-full resize-none rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
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
            {busy ? "등록 중…" : "리드 등록"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  required,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-[11px] font-medium text-ink-2">
        {label}
        {required ? <span className="ml-0.5 text-[var(--status-critical)]">*</span> : null}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-2">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
