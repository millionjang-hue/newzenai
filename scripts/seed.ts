/**
 * Deterministic demo dataset for NewZen CRM.
 *
 *   npm run db:seed     # (re)creates data/crm.db and fills it
 *   npm run db:reset    # deletes the file first
 *
 * The generator walks a 14-month timeline and produces leads, opportunities,
 * stage transitions and activities that hang together: deals only close after
 * they have moved through earlier stages, activity volume tracks deal size, and
 * rep performance varies enough for the analytics tab to be interesting.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// ---------------------------------------------------------------------------
// deterministic RNG (mulberry32)
// ---------------------------------------------------------------------------
const SEED = Number(process.env.CRM_SEED ?? 20260829);

function makeRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = makeRandom(SEED);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;

function weightedPick<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

let counter = 0;
const id = (prefix: string) => `${prefix}_${(SEED % 9973).toString(36)}${(counter++).toString(36).padStart(5, "0")}`;

// ---------------------------------------------------------------------------
// timeline
// ---------------------------------------------------------------------------
const NOW = new Date(process.env.CRM_SEED_NOW ?? new Date().toISOString());
const WINDOW_MONTHS = 27;
const START = new Date(
  Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - (WINDOW_MONTHS - 1), 1),
);

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString();
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

/** A random business-hours timestamp between two dates (weekends skipped). */
function between(from: Date, to: Date): Date {
  const span = Math.max(1, to.getTime() - from.getTime());
  const d = new Date(from.getTime() + rand() * span);
  const weekday = d.getUTCDay();
  if (weekday === 0) d.setUTCDate(d.getUTCDate() + 1);
  if (weekday === 6) d.setUTCDate(d.getUTCDate() + 2);
  d.setUTCHours(int(9, 18), int(0, 59), int(0, 59), 0);
  return d > to ? to : d;
}

// ---------------------------------------------------------------------------
// reference data
// ---------------------------------------------------------------------------
// [한글, 로마자] - the romanised half is only used to build readable emails.
const SURNAMES: [string, string][] = [
  ["김", "kim"], ["이", "lee"], ["박", "park"], ["최", "choi"], ["정", "jung"],
  ["강", "kang"], ["조", "cho"], ["윤", "yoon"], ["장", "jang"], ["임", "lim"],
  ["한", "han"], ["오", "oh"], ["서", "seo"], ["신", "shin"], ["권", "kwon"],
  ["황", "hwang"], ["안", "ahn"], ["송", "song"], ["류", "ryu"], ["홍", "hong"],
];
const GIVEN: [string, string][] = [
  ["민준", "minjun"], ["서연", "seoyeon"], ["도윤", "doyoon"], ["지우", "jiwoo"],
  ["예준", "yejun"], ["하윤", "hayoon"], ["시우", "siwoo"], ["서준", "seojun"],
  ["지호", "jiho"], ["수아", "sua"], ["지훈", "jihoon"], ["채원", "chaewon"],
  ["준서", "junseo"], ["다은", "daeun"], ["현우", "hyunwoo"], ["유진", "yujin"],
  ["건우", "gunwoo"], ["소율", "soyul"], ["우진", "woojin"], ["예은", "yeeun"],
  ["태윤", "taeyoon"], ["지안", "jian"], ["성민", "seongmin"], ["가은", "gaeun"],
];

const TITLES = [
  "대표이사", "CTO", "CFO", "영업총괄", "마케팅 팀장", "IT 인프라 팀장",
  "프로덕트 매니저", "데이터 분석가", "구매 담당", "경영기획 팀장",
  "Head of Growth", "VP of Engineering", "재무 팀장", "운영 팀장",
];

const INDUSTRIES = ["SaaS", "제조", "금융", "이커머스", "헬스케어", "물류", "교육", "미디어", "게임", "건설", "리테일", "에너지"];
const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
const COUNTRIES = ["KR", "KR", "KR", "KR", "JP", "US", "SG", "VN"];

const COMPANY_HEADS: [string, string][] = [
  ["누리", "nuri"], ["한빛", "hanbit"], ["대현", "daehyun"], ["세종", "sejong"],
  ["미래", "mirae"], ["온다", "onda"], ["코어", "core"], ["링크", "link"],
  ["그린", "green"], ["아이", "ai"], ["블루", "blue"], ["스카이", "sky"],
  ["퍼스트", "first"], ["넥스트", "next"], ["라이트", "light"], ["가온", "gaon"],
  ["다올", "daol"], ["라온", "raon"], ["바로", "baro"], ["새롬", "saerom"],
  ["슈퍼", "super"], ["제로", "zero"], ["픽셀", "pixel"], ["델타", "delta"],
  ["오르카", "orca"], ["루멘", "lumen"], ["노바", "nova"], ["시그마", "sigma"],
  ["카이", "kai"], ["베가", "vega"], ["테라", "terra"], ["아틀라스", "atlas"],
  ["메타", "meta"], ["퀀텀", "quantum"], ["프리즘", "prism"], ["하버", "harbor"],
];
const COMPANY_TAILS: [string, string][] = [
  ["테크", "tech"], ["솔루션", "solution"], ["시스템즈", "systems"], ["랩스", "labs"],
  ["컴퍼니", "co"], ["그룹", "group"], ["네트웍스", "networks"], ["다이나믹스", "dynamics"],
  ["인더스트리", "industry"], ["커머스", "commerce"], ["디지털", "digital"], ["파트너스", "partners"],
];

const LOST_REASONS = ["Price", "Lost to competitor", "No budget", "No decision", "Bad timing", "Missing feature"] as const;

const DEAL_SUFFIXES = [
  "전사 도입", "파일럿 확대", "연간 구독 갱신", "엔터프라이즈 플랜", "부서 단위 도입",
  "데이터 연동 프로젝트", "신규 라이선스", "글로벌 확장", "보안 모듈 추가", "AI 애드온",
];

const ACTIVITY_TEMPLATES = {
  call: ["콜드콜 - 담당자 연결", "니즈 파악 통화", "가격 정책 문의 응대", "도입 일정 조율 통화", "이슈 확인 콜"],
  email: ["소개 자료 발송", "제안서 초안 회신", "견적서 전달", "미팅 후 팔로업 메일", "계약 조건 확인 메일"],
  meeting: ["초도 미팅", "제품 데모", "기술 검토 미팅", "경영진 대상 발표", "계약 조건 협의"],
  note: ["내부 검토 메모", "경쟁사 비교 정보", "예산 확정 시점 공유", "의사결정 구조 정리"],
  task: ["보안 검토 자료 준비", "PoC 환경 세팅", "레퍼런스 고객 연결", "계약서 법무 검토 요청", "온보딩 일정 확정"],
} as const;

// ---------------------------------------------------------------------------
// database
// ---------------------------------------------------------------------------
const dbPath = path.isAbsolute(process.env.CRM_DATABASE_PATH ?? "")
  ? process.env.CRM_DATABASE_PATH!
  : path.join(process.cwd(), process.env.CRM_DATABASE_PATH ?? "data/crm.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = OFF");
db.exec(fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf8"));

for (const table of [
  "deal_stage_events", "activities", "deals", "leads",
  "contacts", "companies", "stages", "pipelines", "users",
]) {
  db.exec(`DELETE FROM ${table}`);
}
db.exec("PRAGMA foreign_keys = ON");
db.exec("BEGIN");

const insert = (sql: string) => db.prepare(sql);

// --- users -----------------------------------------------------------------
const userStmt = insert(
  `INSERT INTO users (id, name, email, role, team, avatar_color, quota_monthly, active, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
);

interface SeedUser {
  id: string;
  name: string;
  role: "admin" | "manager" | "rep";
  quota: number;
  /** 0.7 - 1.35 multiplier applied to win odds and deal size. */
  strength: number;
}

const USER_SPEC: { name: string; email: string; role: "admin" | "manager" | "rep"; team: string; color: string; quota: number; strength: number }[] = [
  { name: "장민석", email: "minseok.jang@newzen.io", role: "admin", team: "Revenue", color: "#4f46e5", quota: 0, strength: 1 },
  { name: "이서현", email: "seohyun.lee@newzen.io", role: "manager", team: "Enterprise", color: "#0e7490", quota: 180_000_000, strength: 1.25 },
  { name: "박도현", email: "dohyun.park@newzen.io", role: "manager", team: "Mid-Market", color: "#b45309", quota: 150_000_000, strength: 1.1 },
  { name: "최유진", email: "yujin.choi@newzen.io", role: "rep", team: "Enterprise", color: "#15803d", quota: 120_000_000, strength: 1.35 },
  { name: "정한결", email: "hangyeol.jung@newzen.io", role: "rep", team: "Enterprise", color: "#be123c", quota: 120_000_000, strength: 0.85 },
  { name: "윤소라", email: "sora.yoon@newzen.io", role: "rep", team: "Mid-Market", color: "#7c3aed", quota: 90_000_000, strength: 1.05 },
  { name: "강태오", email: "taeo.kang@newzen.io", role: "rep", team: "Mid-Market", color: "#0f766e", quota: 90_000_000, strength: 0.72 },
  { name: "한지음", email: "jieum.han@newzen.io", role: "rep", team: "SMB", color: "#c2410c", quota: 70_000_000, strength: 0.95 },
];

const users: SeedUser[] = USER_SPEC.map((spec) => {
  const userId = id("user");
  userStmt.run(userId, spec.name, spec.email, spec.role, spec.team, spec.color, spec.quota, iso(START));
  return { id: userId, name: spec.name, role: spec.role, quota: spec.quota, strength: spec.strength };
});
const sellers = users.filter((u) => u.role !== "admin");

// --- pipelines & stages ----------------------------------------------------
const pipelineStmt = insert(
  `INSERT INTO pipelines (id, name, is_default, created_at) VALUES (?, ?, ?, ?)`,
);
const stageStmt = insert(
  `INSERT INTO stages (id, pipeline_id, name, position, probability, kind) VALUES (?, ?, ?, ?, ?, ?)`,
);

interface SeedStage { id: string; name: string; position: number; probability: number; kind: "open" | "won" | "lost" }

function createPipeline(name: string, isDefault: boolean, spec: [string, number, "open" | "won" | "lost"][]) {
  const pipelineId = id("pipe");
  pipelineStmt.run(pipelineId, name, isDefault ? 1 : 0, iso(START));
  const stages: SeedStage[] = spec.map(([stageName, probability, kind], index) => {
    const stageId = id("stage");
    stageStmt.run(stageId, pipelineId, stageName, index, probability, kind);
    return { id: stageId, name: stageName, position: index, probability, kind };
  });
  return { id: pipelineId, name, stages };
}

const newBusiness = createPipeline("신규 영업", true, [
  ["Qualification", 0.1, "open"],
  ["Discovery", 0.25, "open"],
  ["Proposal", 0.5, "open"],
  ["Negotiation", 0.75, "open"],
  ["Closed Won", 1, "won"],
  ["Closed Lost", 0, "lost"],
]);

const expansion = createPipeline("업셀 / 갱신", false, [
  ["Renewal Review", 0.3, "open"],
  ["Expansion Proposal", 0.55, "open"],
  ["Contract Signed", 1, "won"],
  ["Churned", 0, "lost"],
]);

// --- companies -------------------------------------------------------------
const companyStmt = insert(
  `INSERT INTO companies (id, name, domain, industry, size, country, annual_revenue, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);

interface SeedCompany { id: string; name: string; domain: string; industry: string; size: string }

const usedNames = new Set<string>();
const companies: SeedCompany[] = [];
while (companies.length < 48) {
  const head = pick(COMPANY_HEADS);
  const tail = pick(COMPANY_TAILS);
  const name = `${head[0]}${tail[0]}`;
  if (usedNames.has(name)) continue;
  usedNames.add(name);

  const companyId = id("comp");
  const domain = `${head[1]}${tail[1]}.co.kr`;
  const size = pick(SIZES);
  const industry = pick(INDUSTRIES);
  const revenue = { "1-10": 8, "11-50": 40, "51-200": 180, "201-1000": 900, "1000+": 4200 }[size] * 100_000_000;

  companyStmt.run(
    companyId, name, domain, industry, size, pick(COUNTRIES),
    Math.round(revenue * (0.6 + rand() * 0.9)),
    iso(between(addDays(START, -720), START)),
  );
  companies.push({ id: companyId, name, domain, industry, size });
}

/** Keeps generated addresses unique without making them unreadable. */
function unique(local: string, taken: Set<string>): string {
  if (!taken.has(local)) {
    taken.add(local);
    return local;
  }
  let n = 2;
  while (taken.has(`${local}${n}`)) n += 1;
  taken.add(`${local}${n}`);
  return `${local}${n}`;
}

// --- contacts --------------------------------------------------------------
const contactStmt = insert(
  `INSERT INTO contacts (id, company_id, first_name, last_name, email, phone, title, is_primary, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

interface SeedContact { id: string; companyId: string; name: string; email: string }
const contacts: SeedContact[] = [];

const takenEmails = new Set<string>();

for (const company of companies) {
  const count = int(1, 4);
  for (let i = 0; i < count; i += 1) {
    const [surname, surnameRoman] = pick(SURNAMES);
    const [given, givenRoman] = pick(GIVEN);
    const contactId = id("cont");
    const email = `${unique(`${givenRoman}.${surnameRoman}@${company.domain}`, takenEmails)}`;
    contactStmt.run(
      contactId, company.id, given, surname, email,
      `010-${int(1000, 9999)}-${int(1000, 9999)}`,
      pick(TITLES), i === 0 ? 1 : 0,
      iso(between(addDays(START, -400), START)),
    );
    contacts.push({ id: contactId, companyId: company.id, name: `${surname}${given}`, email });
  }
}

// --- leads -----------------------------------------------------------------
const leadStmt = insert(
  `INSERT INTO leads (id, first_name, last_name, email, phone, title, company_name, company_id,
                      source, status, score, owner_id, estimated_value, notes, converted_deal_id,
                      converted_at, last_touch_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

interface SeedLead {
  id: string; companyId: string | null; companyName: string; contactName: string;
  email: string; ownerId: string; status: string; createdAt: Date; value: number;
  source: string; score: number;
}

const LEAD_COUNT = 560;
const leads: SeedLead[] = [];

for (let i = 0; i < LEAD_COUNT; i += 1) {
  const createdAt = between(START, NOW);
  const ageDays = (NOW.getTime() - createdAt.getTime()) / DAY;

  // Older leads have had time to progress; fresh ones are mostly untouched.
  const status = ageDays < 10
    ? weightedPick([["new", 60], ["working", 30], ["qualified", 10]] as const)
    : ageDays < 45
      ? weightedPick([["new", 10], ["working", 32], ["qualified", 22], ["unqualified", 20], ["converted", 16]] as const)
      : weightedPick([["new", 3], ["working", 10], ["qualified", 12], ["unqualified", 40], ["converted", 35]] as const);

  const source = weightedPick([
    ["Inbound Form", 22], ["Referral", 12], ["Outbound", 20], ["Webinar", 10],
    ["Partner", 9], ["Event", 8], ["Paid Search", 12], ["Content", 7],
  ] as const);

  // Score correlates with source quality and outcome so the analytics tab shows
  // a believable relationship rather than noise.
  const sourceBonus: Record<string, number> = {
    Referral: 22, Partner: 14, Webinar: 8, "Inbound Form": 10,
    Event: 6, Content: 4, "Paid Search": -2, Outbound: -6,
  };
  const statusBonus: Record<string, number> = {
    converted: 26, qualified: 16, working: 2, new: 0, unqualified: -20,
  };
  const score = Math.max(1, Math.min(100, int(28, 62) + (sourceBonus[source] ?? 0) + (statusBonus[status] ?? 0)));

  const attachCompany = chance(0.62);
  const company = attachCompany ? pick(companies) : null;
  const freshHead = pick(COMPANY_HEADS);
  const freshTail = pick(COMPANY_TAILS);
  const companyName = company?.name ?? `${freshHead[0]}${freshTail[0]}`;
  const companyDomain = company?.domain ?? `${freshHead[1]}${freshTail[1]}.com`;
  const [surname, surnameRoman] = pick(SURNAMES);
  const [given, givenRoman] = pick(GIVEN);
  const leadId = id("lead");
  const email = unique(`${givenRoman}.${surnameRoman}@${companyDomain}`, takenEmails);
  const owner = pick(sellers);
  const value = Math.round(weightedPick([
    [int(6, 18) * 1_000_000, 45],
    [int(18, 60) * 1_000_000, 38],
    [int(60, 180) * 1_000_000, 14],
    [int(180, 420) * 1_000_000, 3],
  ] as const) / 500_000) * 500_000;

  const touched = status !== "new";
  const lastTouch = touched ? between(createdAt, NOW) : null;

  leadStmt.run(
    leadId, given, surname, email, `010-${int(1000, 9999)}-${int(1000, 9999)}`,
    pick(TITLES), companyName, company?.id ?? null, source, status, score,
    owner.id, value,
    chance(0.35) ? pick(["예산 확정 대기 중", "경쟁사 검토 병행", "PoC 요청 예정", "결정권자 미팅 필요", "내년 예산으로 이월 가능성"]) : null,
    null, null,
    lastTouch ? iso(lastTouch) : null,
    iso(createdAt), iso(lastTouch ?? createdAt),
  );

  leads.push({
    id: leadId, companyId: company?.id ?? null, companyName,
    contactName: `${surname}${given}`, email, ownerId: owner.id,
    status, createdAt, value, source, score,
  });
}

// --- deals + stage history -------------------------------------------------
const dealStmt = insert(
  `INSERT INTO deals (id, title, pipeline_id, stage_id, company_id, contact_id, owner_id,
                      source_lead_id, amount, currency, probability, status, lost_reason,
                      position, expected_close_date, closed_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'KRW', ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const eventStmt = insert(
  `INSERT INTO deal_stage_events (id, deal_id, from_stage_id, to_stage_id, actor_id, occurred_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const leadConvertStmt = db.prepare(
  `UPDATE leads SET converted_deal_id = ?, converted_at = ?, company_id = COALESCE(company_id, ?),
                    updated_at = ? WHERE id = ?`,
);

interface SeedDeal {
  id: string; ownerId: string; createdAt: Date; closedAt: Date | null;
  status: string; amount: number; contactId: string | null;
}
const deals: SeedDeal[] = [];
const positionByStage = new Map<string, number>();

function nextPosition(stageId: string): number {
  const next = (positionByStage.get(stageId) ?? 0) + 1000;
  positionByStage.set(stageId, next);
  return next;
}

function buildDeal(options: {
  pipeline: { id: string; stages: SeedStage[] };
  createdAt: Date;
  ownerId: string;
  companyId: string;
  contactId: string | null;
  amount: number;
  title: string;
  leadId?: string;
  strength: number;
}) {
  const { pipeline, createdAt, ownerId, companyId, contactId, amount, title, leadId, strength } = options;
  const openStages = pipeline.stages.filter((s) => s.kind === "open");
  const wonStage = pipeline.stages.find((s) => s.kind === "won")!;
  const lostStage = pipeline.stages.find((s) => s.kind === "lost")!;

  const dealId = id("deal");
  const ageDays = (NOW.getTime() - createdAt.getTime()) / DAY;
  const maxIndex = openStages.length - 1;

  // Decide the outcome first, then build a history consistent with it. Young
  // deals are mostly still open; old ones have almost all resolved.
  const openOdds =
    ageDays < 25 ? 0.92 : ageDays < 60 ? 0.62 : ageDays < 120 ? 0.3 : ageDays < 210 ? 0.12 : 0.04;
  const stillOpen = chance(openOdds);
  const won = !stillOpen && chance(Math.min(0.78, 0.34 * strength + 0.14));

  // How deep the deal travelled. Won deals traverse the whole ladder; lost and
  // open ones stall at a stage weighted by how long they have been alive.
  let reached: number;
  if (won) {
    reached = maxIndex;
  } else if (stillOpen) {
    const depth = Math.min(1, ageDays / 90);
    reached = 0;
    for (let i = 1; i <= maxIndex; i += 1) {
      if (chance(0.55 * depth * strength + 0.2)) reached = i;
      else break;
    }
  } else {
    reached = Math.min(maxIndex, weightedPick([[0, 22], [1, 30], [2, 30], [3, 18]] as const));
  }

  // Walk the stage history.
  const events: { from: string | null; to: string; at: Date }[] = [];
  let cursor = new Date(createdAt);
  events.push({ from: null, to: openStages[0]!.id, at: cursor });
  for (let i = 1; i <= reached; i += 1) {
    cursor = addDays(cursor, int(3, 20) / Math.max(0.7, strength));
    if (cursor > NOW) cursor = between(events[events.length - 1]!.at, NOW);
    events.push({ from: openStages[i - 1]!.id, to: openStages[i]!.id, at: cursor });
  }

  let finalStage = openStages[reached]!;
  let closedAt: Date | null = null;
  if (!stillOpen) {
    closedAt = addDays(cursor, int(2, 16));
    if (closedAt > NOW) closedAt = between(cursor, NOW);
    finalStage = won ? wonStage : lostStage;
    events.push({ from: openStages[reached]!.id, to: finalStage.id, at: closedAt });
  }

  const closed = !stillOpen;
  const lastEventAt = events[events.length - 1]!.at;
  const status = closed ? (won ? "won" : "lost") : "open";
  const probability = closed ? (won ? 1 : 0) : finalStage.probability;

  // Open deals get a forward close date; a slice is deliberately overdue so the
  // pipeline board has something worth flagging.
  const expectedClose = closed
    ? isoDay(closedAt!)
    : isoDay(chance(0.1) ? addDays(NOW, -int(1, 21)) : addDays(NOW, int(3, 95)));

  dealStmt.run(
    dealId, title, pipeline.id, finalStage.id, companyId, contactId, ownerId,
    leadId ?? null, amount, probability, status,
    status === "lost" ? pick(LOST_REASONS) : null,
    nextPosition(finalStage.id), expectedClose,
    closedAt ? iso(closedAt) : null,
    iso(createdAt), iso(lastEventAt),
  );

  for (const event of events) {
    eventStmt.run(id("evt"), dealId, event.from, event.to, ownerId, iso(event.at));
  }

  deals.push({ id: dealId, ownerId, createdAt, closedAt, status, amount, contactId });
  return { dealId, events, closedAt, status };
}

const strengthById = new Map(users.map((u) => [u.id, u.strength]));

// Deals born from converted leads.
for (const lead of leads.filter((l) => l.status === "converted")) {
  const createdAt = between(lead.createdAt, addDays(lead.createdAt, 21) > NOW ? NOW : addDays(lead.createdAt, 21));
  const company = lead.companyId
    ? companies.find((c) => c.id === lead.companyId)!
    : pick(companies);
  const contact = contacts.find((c) => c.companyId === company.id) ?? null;
  const strength = strengthById.get(lead.ownerId) ?? 1;
  const amount = Math.round((lead.value * (0.8 + rand() * 0.7)) / 500_000) * 500_000;

  const result = buildDeal({
    pipeline: newBusiness,
    createdAt,
    ownerId: lead.ownerId,
    companyId: company.id,
    contactId: contact?.id ?? null,
    amount: Math.max(3_000_000, amount),
    title: `${company.name} - ${pick(DEAL_SUFFIXES)}`,
    leadId: lead.id,
    strength,
  });

  leadConvertStmt.run(result.dealId, iso(createdAt), company.id, iso(createdAt), lead.id);
}

// Self-sourced new-business deals that never existed as a lead record - real
// pipelines always carry some of these. Skewed toward recent months so the
// board has a healthy number of live opportunities.
for (let i = 0; i < 130; i += 1) {
  const recent = chance(0.62);
  const createdAt = between(recent ? addDays(NOW, -110) : START, NOW);
  const company = pick(companies);
  const contact = contacts.find((c) => c.companyId === company.id) ?? null;
  const owner = pick(sellers);
  buildDeal({
    pipeline: newBusiness,
    createdAt,
    ownerId: owner.id,
    companyId: company.id,
    contactId: contact?.id ?? null,
    amount: Math.round(weightedPick([
      [int(8, 25) * 1_000_000, 40],
      [int(25, 70) * 1_000_000, 40],
      [int(70, 200) * 1_000_000, 20],
    ] as const) / 500_000) * 500_000,
    title: `${company.name} - ${pick(DEAL_SUFFIXES)}`,
    strength: owner.strength,
  });
}

// Expansion / renewal deals on existing customers.
for (let i = 0; i < 95; i += 1) {
  const company = pick(companies);
  const contact = contacts.find((c) => c.companyId === company.id) ?? null;
  const owner = pick(sellers);
  buildDeal({
    pipeline: expansion,
    createdAt: between(START, NOW),
    ownerId: owner.id,
    companyId: company.id,
    contactId: contact?.id ?? null,
    amount: int(8, 140) * 1_000_000,
    title: `${company.name} - ${pick(["연간 갱신", "좌석 확대", "상위 플랜 전환", "추가 모듈 도입"])}`,
    strength: owner.strength,
  });
}

// --- activities ------------------------------------------------------------
const activityStmt = insert(
  `INSERT INTO activities (id, type, subject, body, lead_id, deal_id, contact_id, owner_id,
                           due_at, completed_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

function logActivity(options: {
  type: keyof typeof ACTIVITY_TEMPLATES;
  leadId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  ownerId: string;
  at: Date;
  open?: boolean;
}) {
  const { type, ownerId, at } = options;
  const dueAt = options.open ? addDays(NOW, int(-3, 20)) : type === "task" ? addDays(at, int(1, 7)) : null;
  activityStmt.run(
    id("act"), type, pick(ACTIVITY_TEMPLATES[type]),
    chance(0.45) ? pick([
      "담당자와 요구사항 정리. 다음 단계 합의 완료.",
      "예산 범위와 도입 시점 확인함.",
      "기술 검토 항목 회신 대기 중.",
      "경쟁사 대비 강점 자료 요청받음.",
      "내부 승인 프로세스 2주 소요 예상.",
    ]) : null,
    options.leadId ?? null, options.dealId ?? null, options.contactId ?? null, ownerId,
    dueAt ? iso(dueAt) : null,
    options.open ? null : iso(at),
    iso(at),
  );
}

for (const lead of leads) {
  if (lead.status === "new") {
    if (chance(0.25)) logActivity({ type: "task", leadId: lead.id, ownerId: lead.ownerId, at: between(lead.createdAt, NOW), open: true });
    continue;
  }
  const count = lead.status === "converted" ? int(3, 7) : lead.status === "qualified" ? int(2, 5) : int(1, 3);
  for (let i = 0; i < count; i += 1) {
    logActivity({
      type: weightedPick([["call", 30], ["email", 34], ["meeting", 18], ["note", 12], ["task", 6]] as const),
      leadId: lead.id,
      ownerId: lead.ownerId,
      at: between(lead.createdAt, NOW),
    });
  }
}

for (const deal of deals) {
  const end = deal.closedAt ?? NOW;
  const count = deal.amount > 100_000_000 ? int(5, 11) : deal.amount > 40_000_000 ? int(3, 8) : int(2, 5);
  for (let i = 0; i < count; i += 1) {
    logActivity({
      type: weightedPick([["call", 24], ["email", 30], ["meeting", 26], ["note", 12], ["task", 8]] as const),
      dealId: deal.id,
      contactId: deal.contactId,
      ownerId: deal.ownerId,
      at: between(deal.createdAt, end),
    });
  }
  // Open deals carry a next step so the dashboard task list is populated.
  if (deal.status === "open" && chance(0.55)) {
    logActivity({
      type: weightedPick([["task", 55], ["meeting", 30], ["call", 15]] as const),
      dealId: deal.id,
      contactId: deal.contactId,
      ownerId: deal.ownerId,
      at: between(addDays(NOW, -14), NOW),
      open: true,
    });
  }
}

db.exec("COMMIT");

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------
const count = (table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const wonTotal = (db.prepare(
  `SELECT COALESCE(SUM(amount), 0) AS v FROM deals WHERE status = 'won'`,
).get() as { v: number }).v;
const openTotal = (db.prepare(
  `SELECT COALESCE(SUM(amount), 0) AS v FROM deals WHERE status = 'open'`,
).get() as { v: number }).v;

const won = new Intl.NumberFormat("ko-KR").format(Math.round(wonTotal / 100_000_000));
const open = new Intl.NumberFormat("ko-KR").format(Math.round(openTotal / 100_000_000));

console.log(`Seeded ${dbPath}`);
console.table({
  users: count("users"),
  companies: count("companies"),
  contacts: count("contacts"),
  leads: count("leads"),
  deals: count("deals"),
  stage_events: count("deal_stage_events"),
  activities: count("activities"),
});
console.log(`Closed-won total: ${won}억원 · open pipeline: ${open}억원`);
console.log(`Window: ${isoDay(START)} → ${isoDay(NOW)} (seed=${SEED})`);

db.close();
