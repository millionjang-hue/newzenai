"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/today/AppIcon";
import { cx } from "@/components/ui/primitives";
import type { AppLink } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  upload: "직접 등록",
  favicon: "사이트에서 가져옴",
  default: "기본 아이콘",
};

export function WidgetSettings({
  links,
  onClose,
  onChanged,
  onEdit,
  onAdd,
}: {
  links: AppLink[];
  onClose: () => void;
  onChanged: () => void;
  onEdit: (link: AppLink) => void;
  onAdd: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const call = async (id: string, run: () => Promise<Response>) => {
    setBusyId(id);
    setError(null);
    try {
      const response = await run();
      if (!response.ok) {
        throw new Error(((await response.json()) as { error?: string }).error ?? "요청 실패");
      }
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청 실패");
    } finally {
      setBusyId(null);
    }
  };

  const toggle = (link: AppLink) =>
    call(link.id, () =>
      fetch(`/api/app-links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !link.enabled }),
      }),
    );

  const remove = (link: AppLink) =>
    call(link.id, () => fetch(`/api/app-links/${link.id}`, { method: "DELETE" }));

  const move = (index: number, delta: number) => {
    const next = [...links];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    return call(links[index]!.id, () =>
      fetch("/api/app-links/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: next.map((item) => item.id) }),
      }),
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="위젯 설정"
        className="animate-in relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-surface-1 shadow-[var(--shadow-lg)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">위젯 설정</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              상태를 켜면 홈 화면 바로가기에 표시됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              + 앱 추가
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-2 hover:text-ink"
            >
              닫기
            </button>
          </div>
        </header>

        {error ? (
          <p className="mx-5 mt-3 rounded-lg border border-[color-mix(in_srgb,var(--status-critical)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] px-3 py-2 text-xs text-[var(--status-critical)]">
            {error}
          </p>
        ) : null}

        <div className="thin-scroll flex-1 overflow-auto px-5 py-4">
          <table className="w-full min-w-[680px] table-fixed text-xs">
            <colgroup>
              <col className="w-14" />
              <col className="w-[26%]" />
              <col />
              <col className="w-20" />
              <col className="w-16" />
              <col className="w-16" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-[11px] text-ink-3">
                <th className="pb-2 text-center font-medium">아이콘</th>
                <th className="pb-2 text-left font-medium">이름</th>
                <th className="pb-2 text-left font-medium">링크</th>
                <th className="pb-2 text-center font-medium">순서</th>
                <th className="pb-2 text-center font-medium">상태</th>
                <th className="pb-2 text-center font-medium">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {links.map((link, index) => (
                <tr key={link.id} className={cx(busyId === link.id && "opacity-60")}>
                  <td className="py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => onEdit(link)}
                      title={SOURCE_LABEL[link.icon_source]}
                      className="rounded-lg p-0.5 hover:bg-surface-2"
                    >
                      <AppIcon name={link.name} src={link.icon_data} size={26} />
                    </button>
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => onEdit(link)}
                      className="block w-full truncate text-left font-medium text-ink hover:underline"
                      title={link.name}
                    >
                      {link.name}
                    </button>
                    <span className="mt-0.5 block text-[10px] text-ink-3">
                      {SOURCE_LABEL[link.icon_source]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block truncate text-[var(--accent-ink)] hover:underline"
                      title={link.url}
                    >
                      {link.url}
                    </a>
                  </td>
                  <td className="py-2.5">
                    <span className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        aria-label={`${link.name} 위로`}
                        disabled={index === 0 || busyId !== null}
                        onClick={() => move(index, -1)}
                        className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-3 disabled:opacity-30 hover:text-ink"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label={`${link.name} 아래로`}
                        disabled={index === links.length - 1 || busyId !== null}
                        onClick={() => move(index, 1)}
                        className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-3 disabled:opacity-30 hover:text-ink"
                      >
                        ▼
                      </button>
                    </span>
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(link.enabled)}
                      aria-label={`${link.name} 표시`}
                      disabled={busyId !== null}
                      onClick={() => toggle(link)}
                      className={cx(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        link.enabled ? "bg-[var(--accent)]" : "bg-surface-3",
                      )}
                    >
                      <span
                        className={cx(
                          "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          link.enabled ? "translate-x-[18px]" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </td>
                  <td className="py-2.5 text-center">
                    {confirmId === link.id ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmId(null);
                            void remove(link);
                          }}
                          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--status-critical)] hover:underline"
                        >
                          확인
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="rounded px-1.5 py-0.5 text-[11px] text-ink-3 hover:underline"
                        >
                          취소
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(link.id)}
                        className="rounded px-1.5 py-0.5 text-[11px] text-[var(--status-critical)] hover:underline"
                      >
                        [삭제]
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {links.length === 0 ? (
            <p className="py-10 text-center text-xs text-ink-3">
              등록된 앱이 없습니다. &ldquo;+ 앱 추가&rdquo;를 눌러 시작하세요.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
