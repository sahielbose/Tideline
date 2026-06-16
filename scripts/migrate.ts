/**
 * Applies generated Drizzle migrations from ./drizzle to the database.
 * Run via `npm run db:migrate`.
 */
import "./env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "../lib/config";

async function main() {
  const sql = postgres(config.databaseUrl, { max: 1 });
  const db = drizzle(sql);
  console.log("Running migrations against", redact(config.databaseUrl));
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await sql.end();
}

function redact(url: string): string {
  return url.replace(/:\/\/[^@]*@/, "://***@");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
