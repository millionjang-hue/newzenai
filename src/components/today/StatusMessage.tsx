"use client";

import { useState } from "react";

/** Inline-editable profile status line, like the one on the home screen. */
export function StatusMessage({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "저장하지 못했습니다.");
      setValue(payload.data ?? "");
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <p className="flex items-center gap-1.5 text-xs">
        <span aria-hidden="true" className="text-ink-3">
          •
        </span>
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className={value ? "text-ink-2 hover:underline" : "text-ink-3 hover:underline"}
        >
          {value || "프로필 상태 메시지를 입력해보세요."}
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={save} className="flex items-center gap-1.5">
      <input
        autoFocus
        maxLength={120}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setEditing(false);
        }}
        placeholder="프로필 상태 메시지를 입력해보세요."
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface-1 px-2.5 py-1 text-xs sm:max-w-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        저장
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-ink-2 hover:text-ink"
      >
        취소
      </button>
      {error ? <span className="text-[11px] text-[var(--status-critical)]">{error}</span> : null}
    </form>
  );
}
