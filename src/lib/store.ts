import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");

export type TableName = "bookings" | "feedback";

function fileFor(table: TableName): string {
  return path.join(dataDir, `${table}.json`);
}

export function readAll<T>(table: TableName): T[] {
  try {
    const raw = fs.readFileSync(fileFor(table), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeAll(table: TableName, rows: unknown[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(fileFor(table), JSON.stringify(rows, null, 2), "utf-8");
}

export function insert<T extends { id: string }>(table: TableName, row: T): T {
  const rows = readAll<T>(table);
  rows.push(row);
  writeAll(table, rows);
  return row;
}

export function update<T extends { id: string }>(table: TableName, id: string, patch: Partial<T>): T | undefined {
  const rows = readAll<T>(table);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx], ...patch, id };
  writeAll(table, rows);
  return rows[idx];
}

export function findById<T extends { id: string }>(table: TableName, id: string): T | undefined {
  return readAll<T>(table).find((r) => r.id === id);
}

export function remove(table: TableName, id: string): boolean {
  const rows = readAll<{ id: string }>(table);
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return false;
  writeAll(table, next);
  return true;
}
