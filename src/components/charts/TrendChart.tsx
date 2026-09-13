"use client";

import { useMemo, useRef, useState } from "react";
import { resolveFormat, type ChartFormat } from "@/components/charts/formatters";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  /** Filled area under the line - only for the primary series. */
  area?: boolean;
}

export interface TrendChartProps {
  labels: string[];
  series: TrendSeries[];
  /** Name of a shared formatter - functions cannot cross the RSC boundary. */
  format: ChartFormat;
  height?: number;
  /** Axis title for the shared scale. Both series must share units. */
  valueLabel?: string;
}

const W = 760;
const PAD = { top: 18, right: 18, bottom: 30, left: 60 };

/**
 * Multi-series line chart on a single shared scale, with a crosshair tooltip.
 * Series never use two y-axes: callers must pass measures of the same unit.
 */
export function TrendChart({
  labels,
  series,
  format: formatName,
  height = 260,
  valueLabel,
}: TrendChartProps) {
  const format = resolveFormat(formatName);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const { ticks, maxValue } = useMemo(() => {
    const peak = Math.max(1, ...series.flatMap((s) => s.values));
    const step = niceStep(peak / 4);
    const top = Math.ceil(peak / step) * step;
    const out: number[] = [];
    for (let value = 0; value <= top + 1e-6; value += step) out.push(value);
    return { ticks: out, maxValue: top };
  }, [series]);

  const x = (index: number) =>
    PAD.left + (labels.length <= 1 ? innerW / 2 : (index / (labels.length - 1)) * innerW);
  const y = (value: number) => PAD.top + innerH - (value / maxValue) * innerH;

  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (localX - PAD.left) / innerW;
    const index = Math.round(ratio * (labels.length - 1));
    setHover(Math.min(labels.length - 1, Math.max(0, index)));
  };

  // Keep the tooltip inside the plot area at both ends of the axis.
  const tooltipAnchor = hover === null ? 0 : x(hover);
  const tooltipFlip = tooltipAnchor > PAD.left + innerW * 0.62;

  return (
    <figure className="m-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={`${series.map((s) => s.label).join(", ")} 추이`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
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
              fontSize={10}
            >
              {format(tick)}
            </text>
          </g>
        ))}

        {labels.map((label, index) =>
          index % Math.ceil(labels.length / 12) === 0 || index === labels.length - 1 ? (
            <text
              key={label}
              x={x(index)}
              y={H - 10}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={10}
            >
              {label}
            </text>
          ) : null,
        )}

        {series.map((s) =>
          s.area ? (
            <path
              key={`area-${s.key}`}
              d={`${linePath(s.values, x, y)} L ${x(labels.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
              fill={s.color}
              opacity={0.1}
            />
          ) : null,
        )}

        {series.map((s) => (
          <path
            key={s.key}
            d={linePath(s.values, x, y)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {hover !== null ? (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--border-strong)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {series.map((s) => (
              <circle
                key={`dot-${s.key}`}
                cx={x(hover)}
                cy={y(s.values[hover] ?? 0)}
                r={4.5}
                fill={s.color}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            ))}
          </>
        ) : null}
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
        {valueLabel ? <span className="ml-auto text-[11px] text-ink-3">{valueLabel}</span> : null}
      </figcaption>

      <div
        className="pointer-events-none relative"
        style={{ height: hover === null ? 0 : undefined }}
        aria-live="polite"
      >
        {hover !== null ? (
          <div
            className="absolute -top-2 z-10 min-w-40 rounded-lg border border-line bg-surface-1 px-3 py-2 shadow-[var(--shadow-md)]"
            style={
              tooltipFlip
                ? { right: `${(1 - tooltipAnchor / W) * 100}%`, marginRight: 8 }
                : { left: `${(tooltipAnchor / W) * 100}%`, marginLeft: 8 }
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
                <span className="tabular font-semibold text-ink">
                  {format(s.values[hover] ?? 0)}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </figure>
  );
}

function linePath(values: number[], x: (i: number) => number, y: (v: number) => number): string {
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`)
    .join(" ");
}

function niceStep(rough: number): number {
  const exponent = Math.floor(Math.log10(Math.max(rough, 1)));
  const base = 10 ** exponent;
  const scaled = rough / base;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * base;
}
