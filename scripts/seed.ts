/**
 * CLI wrapper around the demo-data generator.
 *
 *   npm run db:seed     # refills data/crm.db
 *   npm run db:reset    # deletes the file first, then refills
 *
 * The generator itself lives in src/lib/db/seed.ts so the app can also seed
 * itself on first run.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL } from "../src/lib/db/schema";
import { seedDatabase } from "../src/lib/db/seed";

const configured = process.env.CRM_DATABASE_PATH?.trim();
const relative = configured && configured.length > 0 ? configured : "data/crm.db";
const dbPath = path.isAbsolute(relative) ? relative : path.join(process.cwd(), relative);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(SCHEMA_SQL);

const summary = seedDatabase(db);

const eok = (value: number) =>
  new Intl.NumberFormat("ko-KR").format(Math.round(value / 100_000_000));

console.log(`Seeded ${dbPath}`);
console.table({
  users: summary.users,
  companies: summary.companies,
  contacts: summary.contacts,
  leads: summary.leads,
  deals: summary.deals,
  stage_events: summary.stageEvents,
  activities: summary.activities,
});
console.log(
  `Closed-won total: ${eok(summary.wonValue)}억원 · open pipeline: ${eok(summary.openValue)}억원`,
);
console.log(`Window: ${summary.from} → ${summary.to} (seed=${summary.seed})`);

db.close();
