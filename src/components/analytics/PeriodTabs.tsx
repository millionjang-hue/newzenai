"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cx } from "@/components/ui/primitives";

const OPTIONS = [
  { months: 3, label: "3개월" },
  { months: 6, label: "6개월" },
  { months: 12, label: "12개월" },
  { months: 24, label: "24개월" },
] as const;

export function PeriodTabs({ current }: { current: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const select = (months: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("months", String(months));
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div
      className="flex rounded-lg border border-line bg-surface-1 p-0.5"
      role="group"
      aria-label="분석 기간"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.months}
          type="button"
          aria-pressed={current === option.months}
          onClick={() => select(option.months)}
          className={cx(
            "rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors",
            current === option.months
              ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
              : "text-ink-3 hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
