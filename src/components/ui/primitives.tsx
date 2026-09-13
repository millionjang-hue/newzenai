import type { ReactNode } from "react";

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-xl border border-line bg-surface-1 shadow-[var(--shadow-sm)]",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type Tone = "neutral" | "accent" | "good" | "warning" | "serious" | "critical";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  accent: "bg-[var(--accent-soft)] text-[var(--accent-ink)] border-[var(--accent-soft)]",
  good: "bg-[color-mix(in_srgb,var(--status-good)_14%,transparent)] text-[var(--status-good)] border-[color-mix(in_srgb,var(--status-good)_30%,transparent)]",
  warning:
    "bg-[color-mix(in_srgb,var(--status-warning)_18%,transparent)] text-[color-mix(in_srgb,var(--status-warning)_70%,var(--text-primary))] border-[color-mix(in_srgb,var(--status-warning)_35%,transparent)]",
  serious:
    "bg-[color-mix(in_srgb,var(--status-serious)_16%,transparent)] text-[color-mix(in_srgb,var(--status-serious)_70%,var(--text-primary))] border-[color-mix(in_srgb,var(--status-serious)_32%,transparent)]",
  critical:
    "bg-[color-mix(in_srgb,var(--status-critical)_14%,transparent)] text-[var(--status-critical)] border-[color-mix(in_srgb,var(--status-critical)_30%,transparent)]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = 24,
  title,
}: {
  name: string;
  color?: string | null;
  size?: number;
  title?: string;
}) {
  const label = initialsOf(name);
  return (
    <span
      title={title ?? name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.36),
        background: color ?? "var(--border-strong)",
      }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  if (/^[가-힣]/.test(trimmed)) return trimmed.slice(-2);
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-1 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs text-ink-3">{description}</p> : null}
      {action}
    </div>
  );
}

/** Thin proportional bar used inside dense tables. */
export function MiniBar({
  value,
  max,
  color = "var(--series-1)",
  label,
}: {
  value: number;
  max: number;
  color?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  // Rendered with spans so the bar stays valid inside <p> and <span> wrappers.
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2" title={label}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%`, background: color }}
      />
    </span>
  );
}
