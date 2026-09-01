export interface CompositionSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * One stacked row for part-to-whole. Segments get a 2px surface gap so adjacent
 * fills stay separable, and every segment is legend-labelled with its share.
 */
export function CompositionBar({
  segments,
  format,
}: {
  segments: CompositionSegment[];
  format?: (value: number) => string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;

  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(segment.value / total) * 100}%`,
              background: segment.color,
              minWidth: segment.value > 0 ? 3 : 0,
            }}
            title={`${segment.label} · ${segment.value}`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-ink-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: segment.color }}
                aria-hidden="true"
              />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="tabular shrink-0 font-semibold text-ink">
              {format ? format(segment.value) : segment.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
