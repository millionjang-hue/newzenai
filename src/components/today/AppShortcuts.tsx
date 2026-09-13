"use client";

import { useCallback, useState } from "react";
import { AppIcon } from "@/components/today/AppIcon";
import { AppLinkDialog } from "@/components/today/AppLinkDialog";
import { WidgetSettings } from "@/components/today/WidgetSettings";
import type { AppLink } from "@/lib/types";

export function AppShortcuts({ initialLinks }: { initialLinks: AppLink[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [dialog, setDialog] = useState<{ open: boolean; link?: AppLink }>({ open: false });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/app-links");
    if (!response.ok) return;
    const payload = (await response.json()) as { data: AppLink[] };
    setLinks(payload.data ?? []);
  }, []);

  const visible = links.filter((link) => link.enabled);

  return (
    <>
      <ul className="flex flex-wrap items-start gap-x-2 gap-y-4">
        {visible.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex w-[84px] flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-colors hover:bg-surface-2"
            >
              <AppIcon
                name={link.name}
                src={link.icon_data}
                size={48}
                className="transition-transform group-hover:scale-105"
              />
              <span className="line-clamp-2 text-center text-[11px] leading-tight text-ink-2">
                {link.name}
              </span>
            </a>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => setDialog({ open: true })}
            className="flex w-[84px] flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-colors hover:bg-surface-2"
          >
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-dashed border-line-strong text-lg text-ink-3"
              aria-hidden="true"
            >
              +
            </span>
            <span className="text-[11px] leading-tight text-ink-3">추가</span>
          </button>
        </li>
      </ul>

      {visible.length === 0 ? (
        <p className="mt-1 text-[11px] text-ink-3">
          표시할 앱이 없습니다. 추가하거나 위젯 설정에서 상태를 켜 주세요.
        </p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink-2 hover:text-ink"
        >
          <span aria-hidden="true">▤</span>
          위젯 설정
        </button>
      </div>

      {settingsOpen ? (
        <WidgetSettings
          links={links}
          onClose={() => setSettingsOpen(false)}
          onChanged={() => void refresh()}
          onEdit={(link) => setDialog({ open: true, link })}
          onAdd={() => setDialog({ open: true })}
        />
      ) : null}

      {dialog.open ? (
        <AppLinkDialog
          link={dialog.link}
          onClose={() => setDialog({ open: false })}
          onSaved={() => void refresh()}
        />
      ) : null}
    </>
  );
}
