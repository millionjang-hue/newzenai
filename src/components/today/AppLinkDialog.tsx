"use client";

import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/today/AppIcon";
import { ALLOWED_ICON_TYPES, MAX_ICON_BYTES, type AppLink, type IconSource } from "@/lib/types";

interface Draft {
  name: string;
  url: string;
  iconData: string | null;
  iconSource: IconSource;
}

export function AppLinkDialog({
  link,
  onClose,
  onSaved,
}: {
  /** Existing link to edit, or undefined to create a new one. */
  link?: AppLink;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    name: link?.name ?? "",
    url: link?.url ?? "",
    iconData: link?.icon_data ?? null,
    iconSource: link?.icon_source ?? "default",
  });
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Remembers which URL we already searched, so typing does not re-trigger it.
  const lookedUp = useRef<string | null>(link?.url ?? null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Ask the server to find the site's own icon. Silent when there is none. */
  const lookUpIcon = async (url: string, { announce }: { announce: boolean }) => {
    if (!url.trim()) return;
    setLookingUp(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/app-links/resolve-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "아이콘을 가져오지 못했습니다.");

      if (payload.data?.dataUri) {
        setDraft((current) => ({
          ...current,
          iconData: payload.data.dataUri,
          iconSource: "favicon",
        }));
        setNotice("사이트 아이콘을 가져왔습니다.");
      } else if (announce) {
        setNotice("사이트에서 아이콘을 찾지 못했습니다. 기본 아이콘이 사용됩니다.");
      }
    } catch (cause) {
      if (announce) {
        setError(cause instanceof Error ? cause.message : "아이콘을 가져오지 못했습니다.");
      }
    } finally {
      setLookingUp(false);
    }
  };

  /** On leaving the URL field, try once - only if the user has not picked a file. */
  const handleUrlBlur = () => {
    const url = draft.url.trim();
    if (!url || url === lookedUp.current) return;
    if (draft.iconSource === "upload") return;
    lookedUp.current = url;
    void lookUpIcon(url, { announce: false });
  };

  const handleFile = (file: File) => {
    setError(null);
    setNotice(null);
    if (!(ALLOWED_ICON_TYPES as readonly string[]).includes(file.type)) {
      setError("PNG, JPEG, GIF, WebP, SVG, ICO 파일만 올릴 수 있습니다.");
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      setError(`아이콘이 너무 큽니다. ${Math.round(MAX_ICON_BYTES / 1024)}KB 이하로 올려 주세요.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({
        ...current,
        iconData: String(reader.result),
        iconSource: "upload",
      }));
      setNotice("아이콘을 등록했습니다.");
    };
    reader.onerror = () => setError("파일을 읽지 못했습니다.");
    reader.readAsDataURL(file);
  };

  const clearIcon = () => {
    setDraft((current) => ({ ...current, iconData: null, iconSource: "default" }));
    if (fileRef.current) fileRef.current.value = "";
    setNotice("기본 아이콘을 사용합니다.");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = JSON.stringify({
        name: draft.name.trim(),
        url: draft.url.trim(),
        icon_data: draft.iconData,
        icon_source: draft.iconSource,
      });
      const response = await fetch(link ? `/api/app-links/${link.id}` : "/api/app-links", {
        method: link ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "저장하지 못했습니다.");
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
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
        aria-label={link ? "앱 수정" : "앱 추가"}
        className="animate-in relative w-full max-w-md rounded-xl border border-line bg-surface-1 p-5 shadow-[var(--shadow-lg)]"
      >
        <h2 className="text-sm font-semibold text-ink">{link ? "앱 수정" : "앱 추가"}</h2>
        <p className="mt-0.5 mb-4 text-xs text-ink-3">
          주소를 입력하면 사이트 아이콘을 자동으로 찾습니다. 직접 올린 아이콘이 있으면 그것을
          우선 사용합니다.
        </p>

        {error ? (
          <p className="mb-3 rounded-lg border border-[color-mix(in_srgb,var(--status-critical)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] px-3 py-2 text-xs text-[var(--status-critical)]">
            {error}
          </p>
        ) : null}
        {!error && notice ? (
          <p className="mb-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs text-ink-2">
            {notice}
          </p>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-ink-2">
            이름 <span className="text-[var(--status-critical)]">*</span>
          </span>
          <input
            required
            maxLength={40}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="예: 전자결재"
            className="w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-medium text-ink-2">
            링크 <span className="text-[var(--status-critical)]">*</span>
          </span>
          <input
            required
            value={draft.url}
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            onBlur={handleUrlBlur}
            placeholder="https://example.com"
            inputMode="url"
            className="tabular w-full rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-xs"
          />
        </label>

        <div className="mt-4 rounded-lg border border-line bg-surface-2/40 p-3">
          <p className="mb-2 text-[11px] font-medium text-ink-2">아이콘</p>
          <div className="flex items-center gap-3">
            <AppIcon name={draft.name || "?"} src={draft.iconData} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-line bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:text-ink"
                >
                  파일 선택
                </button>
                <button
                  type="button"
                  disabled={!draft.url.trim() || lookingUp}
                  onClick={() => {
                    lookedUp.current = draft.url.trim();
                    void lookUpIcon(draft.url, { announce: true });
                  }}
                  className="rounded-lg border border-line bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-ink-2 disabled:opacity-50 hover:text-ink"
                >
                  {lookingUp ? "찾는 중…" : "주소에서 찾기"}
                </button>
                {draft.iconData ? (
                  <button
                    type="button"
                    onClick={clearIcon}
                    className="rounded-lg border border-line bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-ink-3 hover:text-ink"
                  >
                    기본 아이콘
                  </button>
                ) : null}
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
                {draft.iconSource === "upload"
                  ? "직접 올린 아이콘"
                  : draft.iconSource === "favicon"
                    ? "사이트에서 가져온 아이콘"
                    : "등록된 아이콘이 없어 기본 아이콘이 사용됩니다"}
              </p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_ICON_TYPES.join(",")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
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
            {busy ? "저장 중…" : link ? "저장" : "추가"}
          </button>
        </div>
      </form>
    </div>
  );
}
