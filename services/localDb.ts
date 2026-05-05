import SQLite from 'react-native-sqlite-storage';

import type { SQLiteDatabase, SQLiteValue } from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DATABASE_NAME = 'healthrec_relational.db';
const SCHEMA_VERSION = '4';

let databasePromise: Promise<SQLiteDatabase> | null = null;

const SCHEMA_STATEMENTS = [
  'PRAGMA foreign_keys = ON;',
  `CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );`,
  `CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      timezone TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      avatar_label TEXT,
      age INTEGER,
      height_cm REAL,
      weight_kg REAL,
      goal TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS daily_logs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      mood TEXT NOT NULL,
      sleep_quality INTEGER NOT NULL,
      sleep_hours REAL NOT NULL,
      hydration_liters REAL NOT NULL,
      symptom_summary TEXT NOT NULL,
      food_note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL
    );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_user_local_date ON daily_logs(user_id, local_date);',
  `CREATE TABLE IF NOT EXISTS food_entries (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity_value REAL NOT NULL,
      quantity_unit TEXT NOT NULL,
      caffeine_mg REAL NOT NULL,
      is_caffeinated INTEGER NOT NULL,
      estimated_calories REAL,
      estimated_protein_g REAL,
      estimated_carbs_g REAL,
      estimated_fat_g REAL,
      source TEXT NOT NULL,
      source_ref_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL
    );`,
  'CREATE INDEX IF NOT EXISTS idx_food_entries_user_local_date ON food_entries(user_id, local_date, occurred_at);',
  `CREATE TABLE IF NOT EXISTS step_daily_summaries (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      step_count INTEGER NOT NULL,
      step_calories_burned REAL NOT NULL DEFAULT 0,
      activity_calories_burned REAL NOT NULL DEFAULT 0,
      calories_burned REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL
    );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_step_summary_user_local_date ON step_daily_summaries(user_id, local_date);',
  `CREATE TABLE IF NOT EXISTS physical_activity_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      category TEXT NOT NULL,
      option_key TEXT NOT NULL,
      title TEXT NOT NULL,
      intensity_label TEXT NOT NULL,
      met_value REAL NOT NULL,
      duration_seconds INTEGER NOT NULL,
      calories_burned REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL
    );`,
  'CREATE INDEX IF NOT EXISTS idx_activity_sessions_user_local_date ON physical_activity_sessions(user_id, local_date, started_at);',
  `CREATE TABLE IF NOT EXISTS symptom_entries (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      symptom_name TEXT NOT NULL,
      severity INTEGER NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS nutrition_scans (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      foods_count INTEGER NOT NULL,
      total_calories REAL NOT NULL,
      protein_g REAL NOT NULL,
      carbs_g REAL NOT NULL,
      fat_g REAL NOT NULL,
      raw_payload_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS insight_snapshots (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      confidence TEXT NOT NULL,
      sample_size INTEGER NOT NULL,
      metric_delta REAL NOT NULL,
      generated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status_created_at ON sync_queue(user_id, status, created_at);',
];

async function hasColumn(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const [result] = await db.executeSql(`PRAGMA table_info(${tableName})`);

  for (let index = 0; index < result.rows.length; index += 1) {
    const row = result.rows.item(index) as { name?: string };
    if (row.name === columnName) {
      return true;
    }
  }

  return false;
}

async function ensureSchema(db: SQLiteDatabase): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.executeSql(statement);
  }

  if (!(await hasColumn(db, 'sync_queue', 'user_id'))) {
    await db.executeSql(
      "ALTER TABLE sync_queue ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
    );
  }

  if (!(await hasColumn(db, 'step_daily_summaries', 'calories_burned'))) {
    await db.executeSql(
      'ALTER TABLE step_daily_summaries ADD COLUMN calories_burned REAL NOT NULL DEFAULT 0',
    );
  }

  if (!(await hasColumn(db, 'step_daily_summaries', 'step_calories_burned'))) {
    await db.executeSql(
      'ALTER TABLE step_daily_summaries ADD COLUMN step_calories_burned REAL NOT NULL DEFAULT 0',
    );
    await db.executeSql(
      'UPDATE step_daily_summaries SET step_calories_burned = calories_burned WHERE step_calories_burned = 0',
    );
  }

  if (!(await hasColumn(db, 'step_daily_summaries', 'activity_calories_burned'))) {
    await db.executeSql(
      'ALTER TABLE step_daily_summaries ADD COLUMN activity_calories_burned REAL NOT NULL DEFAULT 0',
    );
  }

  await db.executeSql(
    `UPDATE step_daily_summaries
     SET calories_burned = COALESCE(step_calories_burned, 0) + COALESCE(activity_calories_burned, 0)
     WHERE COALESCE(calories_burned, 0) != COALESCE(step_calories_burned, 0) + COALESCE(activity_calories_burned, 0)`,
  );

  await db.executeSql(
    'INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)',
    ['schema_version', SCHEMA_VERSION],
  );
}

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabase({
      name: DATABASE_NAME,
      location: 'default',
    }).then(async db => {
      await ensureSchema(db);
      return db;
    });
  }

  return databasePromise;
}

export async function executeSql(
  sql: string,
  params: SQLiteValue[] = [],
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(sql, params);
}

export async function queryRows<T>(
  sql: string,
  params: SQLiteValue[] = [],
): Promise<T[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql(sql, params);
  const rows: T[] = [];

  for (let index = 0; index < result.rows.length; index += 1) {
    rows.push(result.rows.item(index) as T);
  }

  return rows;
}

export async function queryFirst<T>(
  sql: string,
  params: SQLiteValue[] = [],
): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows[0] ?? null;
}
