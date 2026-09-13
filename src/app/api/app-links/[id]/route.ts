import { NextResponse } from "next/server";
import { deleteAppLink, getAppLink, updateAppLink } from "@/lib/repositories/appLinks";
import { validateIconDataUri } from "@/lib/appLinkValidation";
import { normaliseUrl } from "@/lib/favicon";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!(await getAppLink(id))) {
    return NextResponse.json({ error: "App link not found" }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 422 });
    if (name.length > 40) {
      return NextResponse.json({ error: "이름은 40자 이하로 입력해 주세요." }, { status: 422 });
    }
    patch.name = name;
  }

  if (payload.url !== undefined) {
    const url = normaliseUrl(String(payload.url));
    if (!url) {
      return NextResponse.json({ error: "올바른 http(s) 주소를 입력해 주세요." }, { status: 422 });
    }
    patch.url = url;
  }

  if (payload.icon_data !== undefined) {
    const icon = validateIconDataUri(payload.icon_data);
    if (!icon.ok) return NextResponse.json({ error: icon.error }, { status: 422 });
    patch.icon_data = icon.value || null;
    patch.icon_source = icon.value
      ? payload.icon_source === "favicon"
        ? "favicon"
        : "upload"
      : "default";
  }

  if (payload.enabled !== undefined) patch.enabled = Boolean(payload.enabled);

  return NextResponse.json({ data: await updateAppLink(id, patch) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!(await getAppLink(id))) {
    return NextResponse.json({ error: "App link not found" }, { status: 404 });
  }
  await deleteAppLink(id);
  return NextResponse.json({ ok: true });
}
