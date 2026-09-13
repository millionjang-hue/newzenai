import { NextResponse } from "next/server";
import { getSetting, setSetting, STATUS_MESSAGE_KEY } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ data: (await getSetting(STATUS_MESSAGE_KEY)) ?? "" });
}

export async function PUT(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = String(payload.message ?? "").trim();
  if (message.length > 120) {
    return NextResponse.json({ error: "상태 메시지는 120자 이하로 입력해 주세요." }, { status: 422 });
  }

  await setSetting(STATUS_MESSAGE_KEY, message);
  return NextResponse.json({ data: message });
}
