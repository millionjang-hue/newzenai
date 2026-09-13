import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from "@/lib/format";

/**
 * Client chart components take a formatter *name* rather than a function:
 * functions cannot cross the server -> client component boundary.
 */
export const CHART_FORMATTERS = {
  compactCurrency: formatCompactCurrency,
  currency: formatCurrency,
  number: formatNumber,
  percent: (value: number) => formatPercent(value),
} as const;

export type ChartFormat = keyof typeof CHART_FORMATTERS;

export function resolveFormat(name: ChartFormat): (value: number) => string {
  return CHART_FORMATTERS[name];
}
