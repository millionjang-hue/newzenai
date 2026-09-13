import { NextResponse } from "next/server";
import { normaliseUrl, resolveFavicon } from "@/lib/favicon";

export const dynamic = "force-dynamic";
// Icon discovery makes a couple of outbound requests; give it room.
export const maxDuration = 20;

/**
 * Looks up a site's own icon so the user does not have to supply one.
 * Returns `{ data: null }` when nothing is found - that is a normal outcome,
 * and the caller falls back to the default icon.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = normaliseUrl(String(payload.url ?? ""));
  if (!url) {
    return NextResponse.json({ error: "올바른 http(s) 주소를 입력해 주세요." }, { status: 422 });
  }

  try {
    const icon = await resolveFavicon(url);
    // `null` means "looked, found nothing" - the caller uses the default icon.
    return NextResponse.json({ data: icon });
  } catch (error) {
    // Refused addresses and unresolvable hosts are the user's input problem.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "아이콘을 가져오지 못했습니다." },
      { status: 422 },
    );
  }
}
