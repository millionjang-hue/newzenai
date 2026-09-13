import { ALLOWED_ICON_TYPES, MAX_ICON_BYTES } from "@/lib/types";

/**
 * Validates an uploaded icon that arrived as a `data:` URI.
 * Icons are rendered back into an <img src>, so anything but a known image
 * media type is refused - a stray `text/html` payload would be an XSS vector.
 */
export function validateIconDataUri(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false, error: "아이콘 형식이 올바르지 않습니다." };

  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(value.trim());
  if (!match) return { ok: false, error: "아이콘은 base64 data URI 여야 합니다." };

  const [, mediaType, base64] = match as unknown as [string, string, string];
  if (!(ALLOWED_ICON_TYPES as readonly string[]).includes(mediaType.toLowerCase())) {
    return { ok: false, error: `지원하지 않는 이미지 형식입니다: ${mediaType}` };
  }

  // base64 expands 3 bytes into 4 characters.
  const approximateBytes = Math.floor((base64.length * 3) / 4);
  if (approximateBytes > MAX_ICON_BYTES) {
    return { ok: false, error: `아이콘이 너무 큽니다. ${Math.round(MAX_ICON_BYTES / 1024)}KB 이하로 올려 주세요.` };
  }

  return { ok: true, value: value.trim() };
}
