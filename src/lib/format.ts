/** Currency + date helpers shared by the server pages and the client widgets. */

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

/** Full precision, e.g. `₩128,500,000`. */
export function formatCurrency(amount: number): string {
  return KRW.format(Math.round(amount));
}

/**
 * Compact Korean money, e.g. `1.3억`, `4,500만`, `₩0`.
 * Used wherever the exact figure would crowd the layout (cards, axes, chips).
 */
export function formatCompactCurrency(amount: number): string {
  const value = Math.round(amount);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 100_000_000) {
    const eok = abs / 100_000_000;
    return `${sign}${trim(eok, eok >= 10 ? 0 : 1)}억`;
  }
  if (abs >= 10_000) {
    return `${sign}${new Intl.NumberFormat("ko-KR").format(Math.round(abs / 10_000))}만`;
  }
  return `${sign}${new Intl.NumberFormat("ko-KR").format(abs)}`;
}

function trim(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0$/, "");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

/** `3일 전`, `방금`, `2개월 후` - relative to `now`. */
export function formatRelative(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  const abs = Math.abs(diffDays);
  const suffix = diffMs < 0 ? "전" : "후";

  if (abs === 0) return "오늘";
  if (abs < 7) return `${abs}일 ${suffix}`;
  if (abs < 31) return `${Math.round(abs / 7)}주 ${suffix}`;
  if (abs < 365) return `${Math.round(abs / 30)}개월 ${suffix}`;
  return `${Math.round(abs / 365)}년 ${suffix}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  // Korean names read as one token - take the last two syllables.
  if (/^[가-힣]/.test(trimmed)) return trimmed.slice(-2);
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** ISO day string (`2026-08-29`) in UTC. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** ISO month string (`2026-08`) in UTC. */
export function isoMonth(date: Date | string): string {
  return (typeof date === "string" ? date : date.toISOString()).slice(0, 7);
}

export function monthLabel(isoMonthValue: string): string {
  const [year, month] = isoMonthValue.split("-");
  return `${year?.slice(2)}.${month}`;
}
