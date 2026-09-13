import type { LeadStatus } from "@/lib/types";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "신규",
  working: "진행 중",
  qualified: "검증됨",
  unqualified: "부적합",
  converted: "전환 완료",
};

export const STATUS_TONE: Record<LeadStatus, "neutral" | "accent" | "good" | "warning" | "critical"> = {
  new: "neutral",
  working: "accent",
  qualified: "good",
  unqualified: "critical",
  converted: "warning",
};

export const STATUS_COLOR: Record<LeadStatus, string> = {
  new: "var(--series-7)",
  working: "var(--series-1)",
  qualified: "var(--series-3)",
  unqualified: "var(--series-8)",
  converted: "var(--series-4)",
};

export const ACTIVITY_LABEL: Record<string, string> = {
  call: "통화",
  email: "이메일",
  meeting: "미팅",
  note: "메모",
  task: "할 일",
};

export const ACTIVITY_ICON: Record<string, string> = {
  call: "☎",
  email: "✉",
  meeting: "◷",
  note: "✎",
  task: "☑",
};
