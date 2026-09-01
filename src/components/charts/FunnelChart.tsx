import { formatPercent } from "@/lib/format";

export interface FunnelRow {
  label: string;
  value: number;
  rateFromTop: number;
  rateFromPrev: number;
}

/** Ordinal blue ramp - stages are ordered, so magnitude reads as depth. */
const RAMP = ["var(--seq-650)", "var(--seq-550)", "var(--seq-450)", "var(--seq-350)", "var(--seq-250)"];

export function FunnelChart({ rows }: { rows: FunnelRow[] }) {
  const top = Math.max(1, rows[0]?.value ?? 1);

  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row, index) => {
        const width = Math.max(6, (row.value / top) * 100);
        return (
          <li key={row.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-medium text-ink">{row.label}</span>
            <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-surface-2">
              <div
                className="flex h-full items-center rounded-md px-2.5"
                style={{ width: `${width}%`, background: RAMP[index % RAMP.length] }}
              >
                <span className="tabular text-[11px] font-semibold text-white drop-shadow-sm">
                  {row.value}건
                </span>
              </div>
            </div>
            <span className="tabular w-28 shrink-0 text-right text-[11px] text-ink-2">
              {formatPercent(row.rateFromTop, 0)}
              <span className="ml-1 text-ink-3">
                (직전 {formatPercent(row.rateFromPrev, 0)})
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
