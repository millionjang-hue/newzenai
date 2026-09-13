/**
 * Drops every CRM table and rebuilds it from the schema, then reseeds.
 *
 *   npm run db:reset
 */
import { Client } from "pg";
import { SCHEMA_SQL, TABLES_IN_DEPENDENCY_ORDER } from "../src/lib/db/schema";
import { seedDatabase } from "../src/lib/db/seed";

const url: string | undefined =
  process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
if (!url) {
  console.error("\n  ✗ DATABASE_URL 이 설정되지 않았습니다.\n");
  process.exit(1);
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: url as string });
  await client.connect();

  try {
    await client.query(`DROP TABLE IF EXISTS ${TABLES_IN_DEPENDENCY_ORDER.join(", ")} CASCADE`);
    await client.query(SCHEMA_SQL);
    const summary = await seedDatabase(client);
    console.log(
      `Reset complete: 리드 ${summary.leads} · 기회 ${summary.deals} · 활동 ${summary.activities}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
