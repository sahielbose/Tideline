import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ??
  "postgresql://localhost:5432/tideline";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
