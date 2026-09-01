export type LeadStatus = "new" | "working" | "qualified" | "unqualified" | "converted";
export type DealStatus = "open" | "won" | "lost";
export type StageKind = "open" | "won" | "lost";
export type ActivityType = "call" | "email" | "meeting" | "note" | "task";
export type UserRole = "admin" | "manager" | "rep";
export type CompanySize = "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "working",
  "qualified",
  "unqualified",
  "converted",
];

export const LEAD_SOURCES = [
  "Inbound Form",
  "Referral",
  "Outbound",
  "Webinar",
  "Partner",
  "Event",
  "Paid Search",
  "Content",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const ACTIVITY_TYPES: ActivityType[] = ["call", "email", "meeting", "note", "task"];

export const LOST_REASONS = [
  "Price",
  "Lost to competitor",
  "No budget",
  "No decision",
  "Bad timing",
  "Missing feature",
] as const;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  team: string;
  avatar_color: string;
  quota_monthly: number;
  active: number;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string;
  size: CompanySize;
  country: string;
  annual_revenue: number | null;
  created_at: string;
}

export interface Contact {
  id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  title: string | null;
  is_primary: number;
  created_at: string;
}

export interface Pipeline {
  id: string;
  name: string;
  is_default: number;
  created_at: string;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  probability: number;
  kind: StageKind;
}

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  title: string | null;
  company_name: string;
  company_id: string | null;
  source: string;
  status: LeadStatus;
  score: number;
  owner_id: string | null;
  estimated_value: number;
  notes: string | null;
  converted_deal_id: string | null;
  converted_at: string | null;
  last_touch_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadWithOwner extends Lead {
  owner_name: string | null;
  owner_color: string | null;
  activity_count: number;
}

export interface Deal {
  id: string;
  title: string;
  pipeline_id: string;
  stage_id: string;
  company_id: string | null;
  contact_id: string | null;
  owner_id: string | null;
  source_lead_id: string | null;
  amount: number;
  currency: string;
  probability: number;
  status: DealStatus;
  lost_reason: string | null;
  position: number;
  expected_close_date: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealWithRelations extends Deal {
  stage_name: string;
  stage_kind: StageKind;
  stage_position: number;
  company_name: string | null;
  contact_name: string | null;
  owner_name: string | null;
  owner_color: string | null;
}

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  lead_id: string | null;
  deal_id: string | null;
  contact_id: string | null;
  owner_id: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ActivityWithOwner extends Activity {
  owner_name: string | null;
  owner_color: string | null;
}
