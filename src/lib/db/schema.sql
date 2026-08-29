-- ---------------------------------------------------------------------------
-- NewZen CRM relational schema (SQLite)
-- ---------------------------------------------------------------------------
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'rep')),
  team          TEXT NOT NULL,
  avatar_color  TEXT NOT NULL,
  quota_monthly INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  domain      TEXT,
  industry    TEXT NOT NULL,
  size        TEXT NOT NULL CHECK (size IN ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  country     TEXT NOT NULL,
  annual_revenue INTEGER,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  company_id  TEXT REFERENCES companies(id) ON DELETE SET NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  title       TEXT,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

-- Pipelines are configurable so the board is data-driven, not hard-coded.
CREATE TABLE IF NOT EXISTS pipelines (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stages (
  id          TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  probability REAL NOT NULL DEFAULT 0,
  kind        TEXT NOT NULL CHECK (kind IN ('open', 'won', 'lost')) DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS idx_stages_pipeline ON stages(pipeline_id, position);

CREATE TABLE IF NOT EXISTS leads (
  id            TEXT PRIMARY KEY,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  title         TEXT,
  company_name  TEXT NOT NULL,
  company_id    TEXT REFERENCES companies(id) ON DELETE SET NULL,
  source        TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('new', 'working', 'qualified', 'unqualified', 'converted')),
  score         INTEGER NOT NULL DEFAULT 0,
  owner_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  estimated_value INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  converted_deal_id TEXT,
  converted_at  TEXT,
  last_touch_at TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

CREATE TABLE IF NOT EXISTS deals (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  pipeline_id   TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id      TEXT NOT NULL REFERENCES stages(id),
  company_id    TEXT REFERENCES companies(id) ON DELETE SET NULL,
  contact_id    TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  owner_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  source_lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  amount        INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'KRW',
  probability   REAL NOT NULL DEFAULT 0,
  status        TEXT NOT NULL CHECK (status IN ('open', 'won', 'lost')) DEFAULT 'open',
  lost_reason   TEXT,
  position      REAL NOT NULL DEFAULT 0,
  expected_close_date TEXT,
  closed_at     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id, position);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_closed ON deals(closed_at);

-- Every stage transition is recorded so analytics can compute velocity and
-- stage-to-stage conversion without guessing from the current state.
CREATE TABLE IF NOT EXISTS deal_stage_events (
  id            TEXT PRIMARY KEY,
  deal_id       TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_stage_id TEXT REFERENCES stages(id),
  to_stage_id   TEXT NOT NULL REFERENCES stages(id),
  actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  occurred_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stage_events_deal ON deal_stage_events(deal_id, occurred_at);

CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task')),
  subject     TEXT NOT NULL,
  body        TEXT,
  lead_id     TEXT REFERENCES leads(id) ON DELETE CASCADE,
  deal_id     TEXT REFERENCES deals(id) ON DELETE CASCADE,
  contact_id  TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  owner_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  due_at      TEXT,
  completed_at TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_due ON activities(due_at);
