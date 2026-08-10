import pg from "pg";
import { config } from "../config.js";

// When DATABASE_URL is set the store persists in Postgres (used on Render).
// Without it, the store falls back to local JSON files so development works
// with zero setup.
export const usingDb = Boolean(config.databaseUrl);

const pool = usingDb
  ? new pg.Pool({ connectionString: config.databaseUrl, max: 10, idleTimeoutMillis: 30_000 })
  : null;

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>> {
  if (!pool) throw new Error("Database not configured");
  return pool.query<T>(text, params);
}

/** Creates the tables if they don't exist. Throws on failure so a misconfigured DB is surfaced at boot. */
export async function initDb(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id   TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id   TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `);
}
