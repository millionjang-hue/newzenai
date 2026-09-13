import dns from "node:dns/promises";
import net from "node:net";

/**
 * Best-effort favicon discovery for a user-supplied URL.
 *
 * This fetches an address the user typed, so it is a server-side request
 * forgery risk: every hop is re-validated and anything resolving to a private,
 * loopback, link-local or otherwise reserved address is refused.
 */

const FETCH_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_ICON_BYTES = 128 * 1024;
const MAX_REDIRECTS = 3;

const ICON_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/avif",
]);

export interface ResolvedIcon {
  /** `data:` URI ready to drop into an <img src>. */
  dataUri: string;
  /** Where the icon was found - useful for the settings table. */
  sourceUrl: string;
}

/** `naver.com` -> `https://naver.com/`. Returns null if it cannot be a web URL. */
export function normaliseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  return url.toString();
}

/** Blocks the address ranges that make SSRF useful to an attacker. */
function isBlockedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number) as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("ff")) return true;
    // IPv4-mapped (::ffff:10.0.0.1) - re-check the embedded address.
    const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isBlockedAddress(mapped[1]!);
    return false;
  }

  return true;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error("내부 주소로는 요청할 수 없습니다.");
    return;
  }

  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("주소를 확인할 수 없습니다.");
  }
  if (records.length === 0) throw new Error("주소를 확인할 수 없습니다.");
  // Every record must be public - one private answer is enough to refuse.
  for (const record of records) {
    if (isBlockedAddress(record.address)) throw new Error("내부 주소로는 요청할 수 없습니다.");
  }
}

/**
 * `fetch` with the redirect chain validated by hand, so a public URL cannot
 * bounce us into the private network.
 */
async function safeFetch(target: string, accept: string): Promise<Response> {
  let current = target;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = new URL(current);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("http(s) 주소만 사용할 수 있습니다.");
    }
    await assertPublicHost(url.hostname);

    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: accept,
        // Some sites serve no markup at all without a browser-ish UA.
        "User-Agent": "Mozilla/5.0 (compatible; NewZenCRM/1.0; +icon-discovery)",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      current = new URL(location, url).toString();
      continue;
    }
    return response;
  }

  throw new Error("리다이렉트가 너무 많습니다.");
}

async function readCapped(response: Response, limit: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > limit) return null;

  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Pulls icon candidates out of the document head, best first. */
function iconCandidates(html: string, baseUrl: string): string[] {
  const found: { href: string; score: number }[] = [];

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    if (!/\b(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)\b/.test(rel)) {
      continue;
    }
    const href = /\bhref\s*=\s*["']([^"']+)/i.exec(tag)?.[1];
    if (!href) continue;

    // Prefer bigger, purpose-built icons over a bare /favicon.ico.
    const sizes = /\bsizes\s*=\s*["']?(\d+)/i.exec(tag)?.[1];
    let score = sizes ? Math.min(Number(sizes), 512) : 32;
    if (rel.includes("apple-touch-icon")) score += 64;
    if (/\.svg(\?|$)/i.test(href)) score += 256;

    try {
      found.push({ href: new URL(href, baseUrl).toString(), score });
    } catch {
      // Unparseable href - skip it.
    }
  }

  found.sort((a, b) => b.score - a.score);
  return found.map((item) => item.href);
}

async function downloadIcon(iconUrl: string): Promise<ResolvedIcon | null> {
  let response: Response;
  try {
    response = await safeFetch(iconUrl, "image/*");
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!ICON_TYPES.has(type)) return null;

  const bytes = await readCapped(response, MAX_ICON_BYTES);
  if (!bytes || bytes.byteLength === 0) return null;

  return {
    dataUri: `data:${type};base64,${Buffer.from(bytes).toString("base64")}`,
    sourceUrl: iconUrl,
  };
}

/**
 * Looks for a site icon: declared `<link rel="icon">` first, then the
 * conventional `/favicon.ico`. Returns null when nothing usable is found -
 * the caller falls back to the generated default icon.
 */
export async function resolveFavicon(rawUrl: string): Promise<ResolvedIcon | null> {
  const normalised = normaliseUrl(rawUrl);
  if (!normalised) return null;

  // Validate the target before anything else so a refused address surfaces as
  // a clear error rather than being swallowed into "no icon found" below.
  await assertPublicHost(new URL(normalised).hostname);

  const candidates: string[] = [];
  try {
    const page = await safeFetch(normalised, "text/html,application/xhtml+xml");
    if (page.ok) {
      const body = await readCapped(page, MAX_HTML_BYTES);
      if (body) {
        candidates.push(...iconCandidates(new TextDecoder().decode(body), page.url || normalised));
      }
    }
  } catch {
    // The page may be unreachable while /favicon.ico still works - keep going.
  }

  candidates.push(new URL("/favicon.ico", normalised).toString());

  for (const candidate of candidates.slice(0, 4)) {
    const icon = await downloadIcon(candidate);
    if (icon) return icon;
  }
  return null;
}
