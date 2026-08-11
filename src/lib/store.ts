import fs from "node:fs/promises";
import path from "node:path";
import { usingDb, query } from "./db.js";

export type TableName = "bookings" | "feedback" | "slots";

const dataDir = path.resolve(process.cwd(), "data");

function fileFor(table: TableName): string {
  return path.join(dataDir, `${table}.json`);
}

async function readJsonFile<T>(table: TableName): Promise<T[]> {
  try {
    const raw = await fs.readFile(fileFor(table), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonFile(table: TableName, rows: unknown[]): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(fileFor(table), JSON.stringify(rows, null, 2), "utf-8");
}

export async function readAll<T>(table: TableName): Promise<T[]> {
  if (!usingDb) return readJsonFile<T>(table);
  const { rows } = await query<{ data: T }>(
    `SELECT data FROM ${table} ORDER BY (data->>'createdAt') DESC`,
  );
  return rows.map((r) => r.data);
}

export async function findById<T extends { id: string }>(table: TableName, id: string): Promise<T | undefined> {
  if (!usingDb) {
    return (await readJsonFile<T>(table)).find((r) => r.id === id);
  }
  const { rows } = await query<{ data: T }>(`SELECT data FROM ${table} WHERE id = $1`, [id]);
  return rows[0]?.data;
}

export async function insert<T extends { id: string }>(table: TableName, row: T): Promise<T> {
  if (!usingDb) {
    const rows = await readJsonFile<T>(table);
    rows.push(row);
    await writeJsonFile(table, rows);
    return row;
  }
  await query(`INSERT INTO ${table} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
    row.id,
    JSON.stringify(row),
  ]);
  return row;
}

export async function update<T extends { id: string }>(table: TableName, id: string, patch: Partial<T>): Promise<T | undefined> {
  const existing = await findById<T>(table, id);
  if (!existing) return undefined;
  const merged: T = { ...existing, ...patch, id };
  if (!usingDb) {
    const rows = await readJsonFile<T>(table);
    const idx = rows.findIndex((r) => r.id === id);
    rows[idx] = merged;
    await writeJsonFile(table, rows);
    return merged;
  }
  await query(`UPDATE ${table} SET data = $2 WHERE id = $1`, [id, JSON.stringify(merged)]);
  return merged;
}

export async function remove(table: TableName, id: string): Promise<boolean> {
  if (!usingDb) {
    const rows = await readJsonFile<{ id: string }>(table);
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    await writeJsonFile(table, next);
    return true;
  }
  const result = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

/** Deletes every row in a table (used to purge legacy/bot data). */
export async function clearAll(table: TableName): Promise<void> {
  if (!usingDb) {
    await writeJsonFile(table, []);
    return;
  }
  await query(`TRUNCATE TABLE ${table}`);
}
