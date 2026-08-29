import { cx } from "@/components/ui/primitives";

export interface BarRow {
  label: string;
  value: number;
  /** Right-hand figure. Falls back to the formatted value. */
  display?: string;
  /** Small note rendered under the label. */
  note?: string;
  color?: string;
}

/**
 * Horizontal magnitude bars. Every row is direct-labelled, so the colour never
 * has to carry the reading - which is what keeps the low-contrast ordinal steps
 * legal here.
 */
export function BarRows({
  rows,
  format,
  max,
  compact = false,
}: {
  rows: BarRow[];
  format: (value: number) => string;
  max?: number;
  compact?: boolean;
}) {
  const peak = max ?? Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className={cx("flex flex-col", compact ? "gap-2.5" : "gap-3.5")}>
      {rows.map((row) => {
        const pct = peak > 0 ? (row.value / peak) * 100 : 0;
        return (
          <li key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-ink">{row.label}</span>
              <span className="tabular shrink-0 text-xs font-semibold text-ink">
                {row.display ?? format(row.value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-[4px] bg-surface-2">
              <div
                className="h-full rounded-[4px] transition-[width] duration-500"
                style={{
                  width: `${Math.max(pct, row.value > 0 ? 1.5 : 0)}%`,
                  background: row.color ?? "var(--series-1)",
                }}
              />
            </div>
            {row.note ? <p className="mt-1 text-[11px] text-ink-3">{row.note}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
