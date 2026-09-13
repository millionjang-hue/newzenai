import { cx } from "@/components/ui/primitives";

/**
 * Renders a shortcut's icon. When the link has no icon of its own we draw a
 * lettered tile instead, so a shortcut is never blank.
 */
export function AppIcon({
  name,
  src,
  size = 48,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const radius = Math.round(size * 0.3);

  if (src) {
    return (
      <span
        className={cx(
          "inline-flex shrink-0 items-center justify-center overflow-hidden border border-line bg-surface-1",
          className,
        )}
        style={{ width: size, height: size, borderRadius: radius }}
      >
        {/* Icons are data: URIs from our own validated store, so next/image
            optimisation would add nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-contain p-[15%]"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: Math.max(11, Math.round(size * 0.4)),
        background: defaultTint(name),
      }}
    >
      {defaultGlyph(name)}
    </span>
  );
}

/**
 * The character drawn on a default icon. Korean names get their first syllable,
 * which separates "Google 캘린더" from "Google 드라이브" - taking the literal
 * first character would render both as "G".
 */
export function defaultGlyph(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "·";

  const hangul = /[가-힣]/.exec(trimmed);
  if (hangul) return hangul[0];

  const alnum = /[a-z0-9]/i.exec(trimmed);
  return alnum ? alnum[0].toUpperCase() : [...trimmed][0]!;
}

/**
 * A stable colour per name so same-initial shortcuts stay distinguishable.
 * Lightness and chroma are fixed, so white text keeps the same contrast at
 * every hue.
 */
export function defaultTint(name: string): string {
  let hash = 0;
  for (const char of name.trim() || "?") {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return `oklch(0.48 0.15 ${hash % 360})`;
}
