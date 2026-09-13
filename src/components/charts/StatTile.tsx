import type { ReactNode } from "react";
import { cx } from "@/components/ui/primitives";

export interface StatTileProps {
  label: string;
  value: string;
  /** Secondary line under the value - context, not decoration. */
  hint?: string;
  delta?: { value: number; label?: string } | null;
  /** Higher is better (default) or worse - decides the delta colour. */
  invert?: boolean;
  accent?: string;
  icon?: ReactNode;
}

export function StatTile({ label, value, hint, delta, invert, accent, icon }: StatTileProps) {
  const positive = delta ? (invert ? delta.value < 0 : delta.value > 0) : false;
  const negative = delta ? (invert ? delta.value > 0 : delta.value < 0) : false;

  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{label}</p>
        {icon ? <span className="text-ink-3">{icon}</span> : null}
      </div>
      <p
        className="tabular mt-2 text-2xl font-semibold leading-tight tracking-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {delta ? (
          <span
            className={cx(
              "tabular inline-flex items-center gap-0.5 font-medium",
              positive && "text-[var(--status-good)]",
              negative && "text-[var(--status-critical)]",
              !positive && !negative && "text-ink-3",
            )}
          >
            <span aria-hidden="true">{delta.value > 0 ? "▲" : delta.value < 0 ? "▼" : "■"}</span>
            {Math.abs(delta.value * 100).toFixed(1)}%
          </span>
        ) : null}
        {hint || delta?.label ? (
          <span className="truncate text-ink-3">{delta?.label ?? hint}</span>
        ) : null}
      </div>
    </div>
  );
}
