/**
 * CLI wrapper around the demo-data generator.
 *
 *   npm run db:seed     # refills the database at $DATABASE_URL
 *
 * The generator itself lives in src/lib/db/seed.ts so the app can also seed
 * itself on first run.
 */
import { Client } from "pg";
import { SCHEMA_SQL } from "../src/lib/db/schema";
import { seedDatabase } from "../src/lib/db/seed";

const url: string | undefined =
  process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
if (!url) {
  console.error(
    "\n  ✗ DATABASE_URL 이 설정되지 않았습니다.\n" +
      "    .env.local 에 PostgreSQL 접속 문자열을 넣거나 환경 변수로 전달해 주세요.\n" +
      "    예: DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require\n",
  );
  process.exit(1);
}

const eok = (value: number) =>
  new Intl.NumberFormat("ko-KR").format(Math.round(value / 100_000_000));

async function main(): Promise<void> {
  const client = new Client({ connectionString: url as string });
  await client.connect();

  try {
    await client.query(SCHEMA_SQL);
    const summary = await seedDatabase(client);

    console.log(`Seeded ${redact(url as string)}`);
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
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/** Never print the password back to the terminal or CI logs. */
function redact(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "the configured database";
  }
}
