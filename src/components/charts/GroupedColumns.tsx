"use client";

import { useState } from "react";
import { resolveFormat, type ChartFormat } from "@/components/charts/formatters";

export interface ColumnSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

/**
 * Grouped vertical bars on one shared scale, with a per-group hover tooltip.
 * Bars carry a 2px surface gap so adjacent fills never merge.
 */
export function GroupedColumns({
  labels,
  series,
  format: formatName,
  height = 240,
}: {
  labels: string[];
  series: ColumnSeries[];
  /** Name of a shared formatter - functions cannot cross the RSC boundary. */
  format: ChartFormat;
  height?: number;
}) {
  const format = resolveFormat(formatName);
  const [hover, setHover] = useState<number | null>(null);

  const W = 420;
  const PAD = { top: 14, right: 10, bottom: 26, left: 52 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const peak = Math.max(1, ...series.flatMap((s) => s.values));
  const step = niceStep(peak / 3);
  const maxValue = Math.ceil(peak / step) * step;

  const ticks: number[] = [];
  for (let value = 0; value <= maxValue + 1e-6; value += step) ticks.push(value);

  const groupW = innerW / Math.max(1, labels.length);
  const barW = Math.max(6, (groupW * 0.62) / series.length - 2);
  const y = (value: number) => PAD.top + innerH - (value / maxValue) * innerH;

  return (
    <figure className="relative m-0">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={series.map((s) => s.label).join(", ")}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={11}
            >
              {format(tick)}
            </text>
          </g>
        ))}

        {labels.map((label, index) => {
          const groupX = PAD.left + index * groupW;
          const offset = (groupW - (barW + 2) * series.length) / 2;
          return (
            <g
              key={label}
              onPointerEnter={() => setHover(index)}
              onPointerLeave={() => setHover(null)}
            >
              <rect
                x={groupX}
                y={PAD.top}
                width={groupW}
                height={innerH}
                fill={hover === index ? "var(--surface-2)" : "transparent"}
                opacity={0.6}
              />
              {series.map((s, seriesIndex) => {
                const value = s.values[index] ?? 0;
                const barH = Math.max(value > 0 ? 2 : 0, PAD.top + innerH - y(value));
                return (
                  <rect
                    key={s.key}
                    x={groupX + offset + seriesIndex * (barW + 2)}
                    y={PAD.top + innerH - barH}
                    width={barW}
                    height={barH}
                    rx={4}
                    fill={s.color}
                  />
                );
              })}
              <text
                x={groupX + groupW / 2}
                y={height - 9}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize={11}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-ink-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            {s.label}
          </span>
        ))}
      </figcaption>

      {hover !== null ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-line bg-surface-1 px-3 py-2 shadow-[var(--shadow-md)]"
          style={
            hover > labels.length / 2
              ? { left: 12 }
              : { right: 12 }
          }
        >
          <p className="mb-1 text-[11px] font-semibold text-ink">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-4 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-ink-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                {s.label}
              </span>
              <span className="tabular font-semibold text-ink">{format(s.values[hover] ?? 0)}</span>
            </p>
          ))}
        </div>
      ) : null}
    </figure>
  );
}

function niceStep(rough: number): number {
  const exponent = Math.floor(Math.log10(Math.max(rough, 1)));
  const base = 10 ** exponent;
  const scaled = rough / base;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * base;
}
