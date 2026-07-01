import {
  SQLiteProvider,
  useSQLiteContext,
  type SQLiteDatabase,
} from 'expo-sqlite';

export type PrayerStatus =
  | 'Jamāʾah'
  | 'On-Time'
  | 'Late'
  | 'Missed';

export interface PrayerRow {
  id: number;
  name: string;
  status: PrayerStatus | null;
  date: string;
  created_at: string;
}

export interface HabitRow {
  id: number;
  key: string;
  completed: 0 | 1;
  date: string;
  created_at: string;
}

export interface DatabaseProviderProps {
  children: React.ReactNode;
}

const DB_VERSION = 2;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const { user_version: current } = (await db.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version')) ?? { user_version: 0 };

  if (current >= DB_VERSION) {
    return;
  }

  if (current === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE IF NOT EXISTS prayers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  if (current < 2) {
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_prayers_name_date ON prayers(name, date);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_habits_key_date ON habits(key, date);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
}

export function useDatabase() {
  const db = useSQLiteContext();
  return { db };
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  return (
    <SQLiteProvider databaseName="jamah.db" onInit={migrateDbIfNeeded}>
      {children}
    </SQLiteProvider>
  );
}

export const prayers = {
  today: async (db: SQLiteDatabase): Promise<PrayerRow[]> =>
    db.getAllAsync<PrayerRow>(
      `SELECT * FROM prayers WHERE date = date('now') ORDER BY name`
    ),
  byDate: async (db: SQLiteDatabase, date: string): Promise<PrayerRow[]> =>
    db.getAllAsync<PrayerRow>(
      `SELECT * FROM prayers WHERE date = ? ORDER BY name`,
      [date]
    ),
  upsert: async (
    db: SQLiteDatabase,
    name: string,
    status: PrayerStatus | null,
    date: string
  ): Promise<void> => {
    await db.runAsync(
      `INSERT INTO prayers (name, status, date) VALUES (?, ?, ?)
       ON CONFLICT(name, date) DO UPDATE SET
         status = excluded.status,
         created_at = datetime('now')`,
      [name, status ?? '', date]
    );
  },
  batchUpsert: async (
    db: SQLiteDatabase,
    rows: { name: string; status: PrayerStatus }[],
    date: string
  ): Promise<void> => {
    await db.withTransactionAsync(async () => {
      for (const row of rows) {
        await db.runAsync(
          `INSERT INTO prayers (name, status, date) VALUES (?, ?, ?)
           ON CONFLICT(name, date) DO UPDATE SET status = excluded.status, created_at = datetime('now')`,
          [row.name, row.status, date]
        );
      }
    });
  },
};

export const habits = {
  listByDate: async (db: SQLiteDatabase, date: string): Promise<HabitRow[]> =>
    db.getAllAsync<HabitRow>(`SELECT * FROM habits WHERE date = ?`, [date]),
  upsert: async (
    db: SQLiteDatabase,
    key: string,
    completed: 0 | 1,
    date: string
  ): Promise<void> => {
    await db.runAsync(
      `INSERT INTO habits (key, completed, date) VALUES (?, ?, ?)
       ON CONFLICT(key, date) DO UPDATE SET completed = excluded.completed`,
      [key, completed, date]
    );
  },
};

type SettingValue = string | number | boolean | object;

export const settings = {
  get: async <T = SettingValue>(
    db: SQLiteDatabase,
    key: string,
    fallback?: T
  ): Promise<T> => {
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [key]
    );
    if (!row) {
      if (fallback !== undefined) {
        await db.runAsync(
          `INSERT INTO settings (key, value) VALUES (?, ?)`,
          [key, JSON.stringify(fallback)]
        );
        return fallback;
      }
      throw new Error(`Missing setting: ${key}`);
    }
    return JSON.parse(row.value) as T;
  },
  set: async (db: SQLiteDatabase, key: string, value: SettingValue): Promise<void> => {
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, JSON.stringify(value)]
    );
  },
};
