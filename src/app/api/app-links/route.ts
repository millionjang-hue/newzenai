import { NextResponse } from "next/server";
import { createAppLink, listAppLinks } from "@/lib/repositories/appLinks";
import { validateIconDataUri } from "@/lib/appLinkValidation";
import { normaliseUrl } from "@/lib/favicon";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const onlyEnabled = new URL(request.url).searchParams.get("enabled") === "1";
  return NextResponse.json({ data: await listAppLinks(onlyEnabled) });
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(payload.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 422 });
  if (name.length > 40) {
    return NextResponse.json({ error: "이름은 40자 이하로 입력해 주세요." }, { status: 422 });
  }

  const url = normaliseUrl(String(payload.url ?? ""));
  if (!url) {
    return NextResponse.json({ error: "올바른 http(s) 주소를 입력해 주세요." }, { status: 422 });
  }

  const icon = validateIconDataUri(payload.icon_data);
  if (!icon.ok) return NextResponse.json({ error: icon.error }, { status: 422 });

  const link = await createAppLink({
    name,
    url,
    icon_data: icon.value || null,
    icon_source: icon.value
      ? payload.icon_source === "favicon"
        ? "favicon"
        : "upload"
      : "default",
    enabled: payload.enabled !== false,
  });

  return NextResponse.json({ data: link }, { status: 201 });
}
