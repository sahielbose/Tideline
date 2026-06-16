import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

/**
 * A single pooled postgres.js client + Drizzle wrapper, cached on the global in
 * dev so Next's hot reload does not open a new pool on every change.
 */
const globalForDb = globalThis as unknown as {
  __tidelineSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__tidelineSql ??
  postgres(config.databaseUrl, { max: 10, prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__tidelineSql = sql;
}

export const db = drizzle(sql, { schema });
export { schema, sql };
export type DB = typeof db;
