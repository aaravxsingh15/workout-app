import { ALL_TABLES, INDEX_SQL, createTableSql } from './schema';

/** The subset of expo-sqlite's SQLiteDatabase used by the app. Also implemented by the node:sqlite test adapter. */
export interface Db {
  runAsync(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

/** Ordered migrations. Never edit a shipped migration - append a new one. */
export const MIGRATIONS: string[][] = [
  // v1
  [
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
    ...ALL_TABLES.map(createTableSql),
    ...INDEX_SQL,
  ],
];

export async function runMigrations(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    for (const stmt of MIGRATIONS[v]!) await db.execAsync(stmt);
    await db.execAsync(`PRAGMA user_version = ${v + 1}`);
  }
}

let current: Db | null = null;
let currentUserId: string | null = null;
let closer: (() => Promise<void>) | null = null;

export function getDb(): Db {
  if (!current) throw new Error('Database is not open. Sign in first.');
  return current;
}

export function getUserId(): string {
  if (!currentUserId) throw new Error('No signed-in user.');
  return currentUserId;
}

export function isDbOpen(): boolean {
  return current !== null;
}

/** Test hook and internal setter. */
export function setDb(db: Db | null, userId: string | null, close?: () => Promise<void>): void {
  current = db;
  currentUserId = userId;
  closer = close ?? null;
}

function dbNameFor(userId: string): string {
  return `ironlog_${userId.replace(/[^a-zA-Z0-9]/g, '')}.db`;
}

/**
 * One SQLite file per account: signing out closes it (data stays on disk for the next sign-in),
 * and a second account on the same phone can never see the first account's data.
 */
export async function openDatabaseForUser(userId: string): Promise<void> {
  if (currentUserId === userId && current) return;
  await closeDatabase();
  // Imported lazily so pure-logic tests never need the native module.
  const SQLite = await import('expo-sqlite');
  const native = await SQLite.openDatabaseAsync(dbNameFor(userId));
  await native.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;');
  const db = native as unknown as Db;
  await runMigrations(db);
  setDb(db, userId, () => native.closeAsync());
}

export async function closeDatabase(): Promise<void> {
  const c = closer;
  current = null;
  currentUserId = null;
  closer = null;
  if (c) {
    try {
      await c();
    } catch {
      // Closing is best effort.
    }
  }
}

export async function deleteUserDatabase(userId: string): Promise<void> {
  await closeDatabase();
  try {
    const SQLite = await import('expo-sqlite');
    await SQLite.deleteDatabaseAsync(dbNameFor(userId));
  } catch {
    // Nothing to delete.
  }
}

export async function getMeta(key: string): Promise<string | null> {
  const r = await getDb().getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return r?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await getDb().runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export async function deleteMeta(key: string): Promise<void> {
  await getDb().runAsync('DELETE FROM meta WHERE key = ?', [key]);
}
