import { NextResponse } from "next/server";
import {
  countLeads,
  createLead,
  leadStatusCounts,
  listLeads,
  type LeadSort,
} from "@/lib/repositories/leads";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filter = {
    search: params.get("q") ?? "",
    status: (params.get("status") ?? "all") as LeadStatus | "all",
    ownerId: params.get("owner") ?? "all",
    source: params.get("source") ?? "all",
    minScore: Number(params.get("minScore") ?? 0),
    sort: (params.get("sort") ?? "created_desc") as LeadSort,
    limit: Math.min(500, Number(params.get("limit") ?? 100)),
    offset: Math.max(0, Number(params.get("offset") ?? 0)),
  };

  // Counts cover the whole filtered set, not just the returned page.
  const [data, total, counts] = await Promise.all([
    listLeads(filter),
    countLeads(filter),
    leadStatusCounts(filter),
  ]);

  return NextResponse.json({ data, total, counts });
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const required = ["first_name", "last_name", "email", "company_name"] as const;
  const missing = required.filter((key) => !String(payload[key] ?? "").trim());
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 422 },
    );
  }

  const email = String(payload.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 422 });
  }

  const lead = await createLead({
    first_name: String(payload.first_name).trim(),
    last_name: String(payload.last_name).trim(),
    email: email.trim(),
    phone: payload.phone ? String(payload.phone).trim() : null,
    title: payload.title ? String(payload.title).trim() : null,
    company_name: String(payload.company_name).trim(),
    source: String(payload.source ?? "Inbound Form"),
    status: (payload.status as LeadStatus) ?? "new",
    score: Number(payload.score ?? 40),
    owner_id: payload.owner_id ? String(payload.owner_id) : null,
    estimated_value: Number(payload.estimated_value ?? 0),
    notes: payload.notes ? String(payload.notes) : null,
  });

  return NextResponse.json({ data: lead }, { status: 201 });
}
