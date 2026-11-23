import { openDatabaseSync } from 'expo-sqlite';

import { SEED_EXERCISES } from '@/src/data/exercises';

export const db = openDatabaseSync('fitlog.db');

const SCHEMA_V1 = `
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT NOT NULL DEFAULT '',
  equipment TEXT NOT NULL DEFAULT '',
  is_custom INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3,
  target_reps INTEGER NOT NULL DEFAULT 10
);
CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  routine_id INTEGER
);
CREATE INDEX idx_workouts_date ON workouts(date);
CREATE TABLE workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  set_index INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'normal'
);
CREATE INDEX idx_sets_workout ON workout_sets(workout_id);
CREATE INDEX idx_sets_exercise ON workout_sets(exercise_id);
CREATE TABLE foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  kcal REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  fiber REAL NOT NULL DEFAULT 0,
  serving_g REAL,
  source TEXT NOT NULL,
  last_used_at INTEGER
);
CREATE TABLE food_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  meal TEXT NOT NULL,
  food_id INTEGER NOT NULL REFERENCES foods(id),
  grams REAL NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_food_logs_date ON food_logs(date);
CREATE TABLE body_weights (
  date TEXT PRIMARY KEY,
  kg REAL NOT NULL
);
CREATE TABLE water_logs (
  date TEXT PRIMARY KEY,
  ml INTEGER NOT NULL
);
CREATE TABLE kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sex TEXT NOT NULL,
  age INTEGER NOT NULL,
  height_cm REAL NOT NULL,
  activity TEXT NOT NULL,
  goal TEXT NOT NULL,
  training_bonus_kcal INTEGER NOT NULL,
  protein_per_kg REAL NOT NULL,
  fat_pct REAL NOT NULL,
  units TEXT NOT NULL,
  rest_seconds INTEGER NOT NULL,
  water_goal_ml INTEGER NOT NULL
);
INSERT INTO settings VALUES (1, 'male', 20, 175, 'light', 'maintain', 250, 2.0, 0.25, 'kg', 90, 3000);
`;

/** Run once at startup, before any screen renders. */
export function migrate() {
  db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const version = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version < 1) {
    db.withTransactionSync(() => {
      db.execSync(SCHEMA_V1);
      const stmt = db.prepareSync(
        'INSERT INTO exercises (name, primary_muscle, secondary_muscles, equipment) VALUES (?, ?, ?, ?)',
      );
      try {
        for (const e of SEED_EXERCISES) stmt.executeSync(e);
      } finally {
        stmt.finalizeSync();
      }
      db.execSync('PRAGMA user_version = 1');
    });
  }
}
