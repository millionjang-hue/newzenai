"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui/primitives";

const NAV = [
  { href: "/dashboard", label: "대시보드", icon: "▦", hint: "오늘의 현황" },
  { href: "/leads", label: "리드", icon: "◎", hint: "신규 유입 관리" },
  { href: "/pipeline", label: "파이프라인", icon: "▤", hint: "영업 기회 보드" },
  { href: "/analytics", label: "분석", icon: "◔", hint: "매출·전환 지표" },
  { href: "/companies", label: "고객사", icon: "▣", hint: "회사 계정" },
  { href: "/contacts", label: "연락처", icon: "☰", hint: "담당자 목록" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-line bg-surface-1 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-5">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg text-[13px] font-bold text-white"
            style={{ background: "var(--accent)" }}
            aria-hidden="true"
          >
            N
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tracking-tight">NewZen CRM</p>
            <p className="text-[10px] text-ink-3">Revenue Operations</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
                      active
                        ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <span className="w-4 text-center text-[11px] opacity-70" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 px-3 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
            데이터
          </p>
          <p className="mt-2 px-3 text-[11px] leading-relaxed text-ink-3">
            데모 데이터셋이 로드되어 있습니다. <code className="text-[10px]">npm run db:reset</code>
            으로 다시 생성할 수 있습니다.
          </p>
        </nav>

        <ThemeToggle />
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="사이드바 닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface-1/85 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
            className="rounded-lg border border-line px-2.5 py-1.5 text-sm"
          >
            ☰
          </button>
          <span className="text-sm font-semibold">NewZen CRM</span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const stored = localStorage.getItem("crm-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  const apply = (next: "light" | "dark" | "system") => {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("crm-theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("crm-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  };

  return (
    <div className="border-t border-line p-3">
      <div
        className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1"
        role="group"
        aria-label="테마 선택"
      >
        {(["light", "system", "dark"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => apply(option)}
            aria-pressed={theme === option}
            className={cx(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              theme === option
                ? "bg-surface-1 text-ink shadow-[var(--shadow-sm)]"
                : "text-ink-3 hover:text-ink",
            )}
          >
            {option === "light" ? "라이트" : option === "dark" ? "다크" : "시스템"}
          </button>
        ))}
      </div>
    </div>
  );
}
