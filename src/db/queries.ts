import { db } from '@/src/db';
import { addDays, dateStr, Units } from '@/src/lib/format';
import {
  Activity,
  dailyTargets,
  Goal,
  Macros,
  NutritionProfile,
  Sex,
} from '@/src/lib/nutrition';
import type { FoodInput } from '@/src/lib/off';
import type { LoggedSet } from '@/src/lib/strength';
import { bumpData } from '@/src/store/version';

// ---------- Settings ----------

export interface Settings {
  sex: Sex;
  age: number;
  heightCm: number;
  activity: Activity;
  goal: Goal;
  trainingBonusKcal: number;
  proteinPerKg: number;
  fatPct: number;
  units: Units;
  restSeconds: number;
  waterGoalMl: number;
}

export function getSettings(): Settings {
  return db.getFirstSync<Settings>(
    `SELECT sex, age, height_cm AS heightCm, activity, goal,
       training_bonus_kcal AS trainingBonusKcal, protein_per_kg AS proteinPerKg,
       fat_pct AS fatPct, units, rest_seconds AS restSeconds, water_goal_ml AS waterGoalMl
     FROM settings WHERE id = 1`,
  )!;
}

export function saveSettings(s: Settings) {
  db.runSync(
    `UPDATE settings SET sex=?, age=?, height_cm=?, activity=?, goal=?, training_bonus_kcal=?,
       protein_per_kg=?, fat_pct=?, units=?, rest_seconds=?, water_goal_ml=? WHERE id = 1`,
    [
      s.sex,
      s.age,
      s.heightCm,
      s.activity,
      s.goal,
      s.trainingBonusKcal,
      s.proteinPerKg,
      s.fatPct,
      s.units,
      s.restSeconds,
      s.waterGoalMl,
    ],
  );
  bumpData();
}

// ---------- Key/value (in-progress workout draft) ----------

export function getKv(key: string): string | null {
  return db.getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key])?.value ?? null;
}

export function setKv(key: string, value: string | null) {
  if (value === null) db.runSync('DELETE FROM kv WHERE key = ?', [key]);
  else db.runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]);
}

// ---------- Exercises ----------

export interface Exercise {
  id: number;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string;
  equipment: string;
  isCustom: number;
}

const EX_COLS = `id, name, primary_muscle AS primaryMuscle, secondary_muscles AS secondaryMuscles,
  equipment, is_custom AS isCustom`;

export function listExercises(q = '', muscle: string | null = null): Exercise[] {
  return db.getAllSync<Exercise>(
    `SELECT ${EX_COLS} FROM exercises
     WHERE name LIKE ? AND (? IS NULL OR primary_muscle = ?)
     ORDER BY name COLLATE NOCASE`,
    [`%${q.trim()}%`, muscle, muscle],
  );
}

export function getExercise(id: number): Exercise | null {
  return db.getFirstSync<Exercise>(`SELECT ${EX_COLS} FROM exercises WHERE id = ?`, [id]);
}

export function createExercise(name: string, primaryMuscle: string, equipment = 'other'): number {
  const r = db.runSync(
    'INSERT INTO exercises (name, primary_muscle, equipment, is_custom) VALUES (?, ?, ?, 1)',
    [name.trim(), primaryMuscle, equipment],
  );
  bumpData();
  return r.lastInsertRowId;
}

// ---------- Routines ----------

export interface RoutineSummary {
  id: number;
  name: string;
  exerciseNames: string | null;
}

export interface RoutineItem {
  exerciseId: number;
  name: string;
  targetSets: number;
  targetReps: number;
}

export function listRoutines(): RoutineSummary[] {
  return db.getAllSync<RoutineSummary>(
    `SELECT r.id, r.name,
       (SELECT GROUP_CONCAT(name, ', ') FROM (
          SELECT e.name FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
          WHERE re.routine_id = r.id ORDER BY re.position)) AS exerciseNames
     FROM routines r ORDER BY r.name COLLATE NOCASE`,
  );
}

export function getRoutine(id: number): { id: number; name: string; items: RoutineItem[] } | null {
  const r = db.getFirstSync<{ id: number; name: string }>('SELECT id, name FROM routines WHERE id = ?', [
    id,
  ]);
  if (!r) return null;
  const items = db.getAllSync<RoutineItem>(
    `SELECT re.exercise_id AS exerciseId, e.name, re.target_sets AS targetSets, re.target_reps AS targetReps
     FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
     WHERE re.routine_id = ? ORDER BY re.position`,
    [id],
  );
  return { ...r, items };
}

export function saveRoutine(id: number | null, name: string, items: RoutineItem[]): number {
  let routineId = id;
  db.withTransactionSync(() => {
    if (routineId === null) {
      routineId = db.runSync('INSERT INTO routines (name, created_at) VALUES (?, ?)', [
        name,
        Date.now(),
      ]).lastInsertRowId;
    } else {
      db.runSync('UPDATE routines SET name = ? WHERE id = ?', [name, routineId]);
      db.runSync('DELETE FROM routine_exercises WHERE routine_id = ?', [routineId]);
    }
    items.forEach((it, i) =>
      db.runSync(
        `INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets, target_reps)
         VALUES (?, ?, ?, ?, ?)`,
        [routineId, it.exerciseId, i, it.targetSets, it.targetReps],
      ),
    );
  });
  bumpData();
  return routineId!;
}

export function deleteRoutine(id: number) {
  db.runSync('DELETE FROM routines WHERE id = ?', [id]);
  bumpData();
}

// ---------- Workouts ----------

export interface NewSet extends LoggedSet {
  exerciseId: number;
  position: number;
  setIndex: number;
}

export function saveWorkout(w: {
  name: string;
  startedAt: number;
  endedAt: number;
  routineId: number | null;
  sets: NewSet[];
}): number {
  let id = 0;
  db.withTransactionSync(() => {
    id = db.runSync(
      'INSERT INTO workouts (name, date, started_at, ended_at, routine_id) VALUES (?, ?, ?, ?, ?)',
      [w.name, dateStr(w.startedAt), w.startedAt, w.endedAt, w.routineId],
    ).lastInsertRowId;
    for (const s of w.sets) {
      db.runSync(
        `INSERT INTO workout_sets (workout_id, exercise_id, position, set_index, weight_kg, reps, type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, s.exerciseId, s.position, s.setIndex, s.weightKg, s.reps, s.type],
      );
    }
  });
  bumpData();
  return id;
}

export interface WorkoutSummary {
  id: number;
  name: string;
  date: string;
  startedAt: number;
  endedAt: number;
  setCount: number;
  volume: number;
  exerciseCount: number;
}

const WORKOUT_SUMMARY = `
  SELECT w.id, w.name, w.date, w.started_at AS startedAt, w.ended_at AS endedAt,
    COUNT(s.id) AS setCount,
    COUNT(DISTINCT s.exercise_id) AS exerciseCount,
    COALESCE(SUM(CASE WHEN s.type != 'warmup' THEN s.weight_kg * s.reps END), 0) AS volume
  FROM workouts w LEFT JOIN workout_sets s ON s.workout_id = w.id`;

export function listWorkouts(limit = 50): WorkoutSummary[] {
  return db.getAllSync<WorkoutSummary>(
    `${WORKOUT_SUMMARY} GROUP BY w.id ORDER BY w.started_at DESC LIMIT ?`,
    [limit],
  );
}

export function workoutsOnDate(date: string): WorkoutSummary[] {
  return db.getAllSync<WorkoutSummary>(
    `${WORKOUT_SUMMARY} WHERE w.date = ? GROUP BY w.id ORDER BY w.started_at`,
    [date],
  );
}

export interface SetRow extends LoggedSet {
  id: number;
  exerciseId: number;
  exerciseName: string;
  position: number;
  setIndex: number;
}

export function getWorkout(id: number): { workout: WorkoutSummary; sets: SetRow[] } | null {
  const workout = db.getFirstSync<WorkoutSummary>(`${WORKOUT_SUMMARY} WHERE w.id = ? GROUP BY w.id`, [id]);
  if (!workout) return null;
  const sets = db.getAllSync<SetRow>(
    `SELECT s.id, s.exercise_id AS exerciseId, e.name AS exerciseName, s.position, s.set_index AS setIndex,
       s.weight_kg AS weightKg, s.reps, s.type
     FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id
     WHERE s.workout_id = ? ORDER BY s.position, s.set_index`,
    [id],
  );
  return { workout, sets };
}

export function deleteWorkout(id: number) {
  db.runSync('DELETE FROM workouts WHERE id = ?', [id]);
  bumpData();
}

/** Sets of this exercise from the most recent workout that included it. */
export function lastSetsForExercise(exerciseId: number): LoggedSet[] {
  return db.getAllSync<LoggedSet>(
    `SELECT weight_kg AS weightKg, reps, type FROM workout_sets
     WHERE exercise_id = ? AND workout_id = (
       SELECT s.workout_id FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
       WHERE s.exercise_id = ? ORDER BY w.started_at DESC LIMIT 1)
     ORDER BY set_index`,
    [exerciseId, exerciseId],
  );
}

/** All sets of an exercise done before a given time (for PR comparison). */
export function setsBefore(exerciseId: number, beforeStartedAt: number): LoggedSet[] {
  return db.getAllSync<LoggedSet>(
    `SELECT s.weight_kg AS weightKg, s.reps, s.type FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     WHERE s.exercise_id = ? AND w.started_at < ?`,
    [exerciseId, beforeStartedAt],
  );
}

export interface ExerciseSession {
  workoutId: number;
  date: string;
  startedAt: number;
  sets: LoggedSet[];
}

export function exerciseHistory(exerciseId: number): ExerciseSession[] {
  const rows = db.getAllSync<LoggedSet & { workoutId: number; date: string; startedAt: number }>(
    `SELECT w.id AS workoutId, w.date, w.started_at AS startedAt, s.weight_kg AS weightKg, s.reps, s.type
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE s.exercise_id = ? ORDER BY w.started_at, s.set_index`,
    [exerciseId],
  );
  const out: ExerciseSession[] = [];
  for (const r of rows) {
    let last = out[out.length - 1];
    if (!last || last.workoutId !== r.workoutId) {
      last = { workoutId: r.workoutId, date: r.date, startedAt: r.startedAt, sets: [] };
      out.push(last);
    }
    last.sets.push({ weightKg: r.weightKg, reps: r.reps, type: r.type });
  }
  return out;
}

/** Working sets per primary muscle since `fromDate`. */
export function muscleSetsSince(fromDate: string): { muscle: string; sets: number }[] {
  return db.getAllSync(
    `SELECT e.primary_muscle AS muscle, COUNT(*) AS sets
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
     WHERE w.date >= ? AND s.type != 'warmup'
     GROUP BY e.primary_muscle ORDER BY sets DESC`,
    [fromDate],
  );
}

/** Every working set with its exercise — used to compute PR tables in JS. */
export function allWorkingSets(): (LoggedSet & { exerciseId: number; exerciseName: string })[] {
  return db.getAllSync(
    `SELECT s.exercise_id AS exerciseId, e.name AS exerciseName, s.weight_kg AS weightKg, s.reps, s.type
     FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id WHERE s.type != 'warmup'`,
  );
}

// ---------- Foods ----------

export interface Food extends FoodInput {
  id: number;
}

const FOOD_COLS = `id, barcode, name, brand, kcal, protein, carbs, fat, fiber, serving_g AS servingG, source`;

export function upsertFood(f: FoodInput): number {
  if (f.barcode) {
    const existing = db.getFirstSync<{ id: number }>('SELECT id FROM foods WHERE barcode = ?', [f.barcode]);
    if (existing) {
      db.runSync(
        `UPDATE foods SET name=?, brand=?, kcal=?, protein=?, carbs=?, fat=?, fiber=?, serving_g=?, source=?
         WHERE id = ?`,
        [f.name, f.brand, f.kcal, f.protein, f.carbs, f.fat, f.fiber, f.servingG, f.source, existing.id],
      );
      bumpData();
      return existing.id;
    }
  }
  const r = db.runSync(
    `INSERT INTO foods (barcode, name, brand, kcal, protein, carbs, fat, fiber, serving_g, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [f.barcode, f.name, f.brand, f.kcal, f.protein, f.carbs, f.fat, f.fiber, f.servingG, f.source],
  );
  bumpData();
  return r.lastInsertRowId;
}

export function getFood(id: number): Food | null {
  return db.getFirstSync<Food>(`SELECT ${FOOD_COLS} FROM foods WHERE id = ?`, [id]);
}

export function getFoodByBarcode(barcode: string): Food | null {
  return db.getFirstSync<Food>(`SELECT ${FOOD_COLS} FROM foods WHERE barcode = ?`, [barcode]);
}

export function searchLocalFoods(q: string): Food[] {
  const like = `%${q.trim()}%`;
  return db.getAllSync<Food>(
    `SELECT ${FOOD_COLS} FROM foods WHERE name LIKE ? OR brand LIKE ?
     ORDER BY last_used_at IS NULL, last_used_at DESC, name LIMIT 30`,
    [like, like],
  );
}

export function recentFoods(limit = 40): Food[] {
  return db.getAllSync<Food>(
    `SELECT ${FOOD_COLS} FROM foods WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC LIMIT ?`,
    [limit],
  );
}

// ---------- Food logs ----------

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export interface FoodLogRow extends Macros {
  id: number;
  date: string;
  meal: Meal;
  grams: number;
  foodId: number;
  name: string;
  brand: string;
}

const LOG_SELECT = `
  SELECT l.id, l.date, l.meal, l.grams, f.id AS foodId, f.name, f.brand,
    f.kcal * l.grams / 100.0 AS kcal, f.protein * l.grams / 100.0 AS protein,
    f.carbs * l.grams / 100.0 AS carbs, f.fat * l.grams / 100.0 AS fat
  FROM food_logs l JOIN foods f ON f.id = l.food_id`;

export function logsForDate(date: string): FoodLogRow[] {
  return db.getAllSync<FoodLogRow>(`${LOG_SELECT} WHERE l.date = ? ORDER BY l.created_at`, [date]);
}

export function getFoodLog(id: number): FoodLogRow | null {
  return db.getFirstSync<FoodLogRow>(`${LOG_SELECT} WHERE l.id = ?`, [id]);
}

export function addFoodLog(date: string, meal: Meal, foodId: number, grams: number) {
  const now = Date.now();
  db.runSync('INSERT INTO food_logs (date, meal, food_id, grams, created_at) VALUES (?, ?, ?, ?, ?)', [
    date,
    meal,
    foodId,
    grams,
    now,
  ]);
  db.runSync('UPDATE foods SET last_used_at = ? WHERE id = ?', [now, foodId]);
  bumpData();
}

export function updateFoodLog(id: number, meal: Meal, grams: number) {
  db.runSync('UPDATE food_logs SET meal = ?, grams = ? WHERE id = ?', [meal, grams, id]);
  bumpData();
}

export function deleteFoodLog(id: number) {
  db.runSync('DELETE FROM food_logs WHERE id = ?', [id]);
  bumpData();
}

export function dailyTotals(date: string): Macros {
  return db.getFirstSync<Macros>(
    `SELECT COALESCE(SUM(f.kcal * l.grams / 100.0), 0) AS kcal,
       COALESCE(SUM(f.protein * l.grams / 100.0), 0) AS protein,
       COALESCE(SUM(f.carbs * l.grams / 100.0), 0) AS carbs,
       COALESCE(SUM(f.fat * l.grams / 100.0), 0) AS fat
     FROM food_logs l JOIN foods f ON f.id = l.food_id WHERE l.date = ?`,
    [date],
  )!;
}

export function kcalByDay(from: string, to: string): { date: string; kcal: number }[] {
  return db.getAllSync(
    `SELECT l.date, SUM(f.kcal * l.grams / 100.0) AS kcal
     FROM food_logs l JOIN foods f ON f.id = l.food_id
     WHERE l.date BETWEEN ? AND ? GROUP BY l.date ORDER BY l.date`,
    [from, to],
  );
}

// ---------- Body weight & water ----------

export function setBodyWeight(date: string, kg: number) {
  db.runSync('INSERT OR REPLACE INTO body_weights (date, kg) VALUES (?, ?)', [date, kg]);
  bumpData();
}

export function weightOn(date: string): number | null {
  return db.getFirstSync<{ kg: number }>('SELECT kg FROM body_weights WHERE date = ?', [date])?.kg ?? null;
}

/** Most recent weight on or before `date`. */
export function latestWeight(date = dateStr()): number | null {
  return (
    db.getFirstSync<{ kg: number }>(
      'SELECT kg FROM body_weights WHERE date <= ? ORDER BY date DESC LIMIT 1',
      [date],
    )?.kg ?? null
  );
}

export function weightsSince(from: string): { date: string; kg: number }[] {
  return db.getAllSync('SELECT date, kg FROM body_weights WHERE date >= ? ORDER BY date', [from]);
}

export function waterOn(date: string): number {
  return db.getFirstSync<{ ml: number }>('SELECT ml FROM water_logs WHERE date = ?', [date])?.ml ?? 0;
}

export function addWater(date: string, ml: number) {
  const next = Math.max(0, waterOn(date) + ml);
  db.runSync('INSERT OR REPLACE INTO water_logs (date, ml) VALUES (?, ?)', [date, next]);
  bumpData();
}

// ---------- Targets (where training and nutrition meet) ----------

export const DEFAULT_WEIGHT_KG = 70;

export function nutritionProfile(s: Settings, date = dateStr()): NutritionProfile {
  return {
    sex: s.sex,
    age: s.age,
    heightCm: s.heightCm,
    weightKg: latestWeight(date) ?? DEFAULT_WEIGHT_KG,
    activity: s.activity,
    goal: s.goal,
    trainingBonusKcal: s.trainingBonusKcal,
    proteinPerKg: s.proteinPerKg,
    fatPct: s.fatPct,
  };
}

export function targetsFor(date: string, extraTraining = false) {
  const s = getSettings();
  const isTrainingDay = extraTraining || workoutsOnDate(date).length > 0;
  return {
    isTrainingDay,
    bonus: isTrainingDay ? s.trainingBonusKcal : 0,
    targets: dailyTargets(nutritionProfile(s, date), isTrainingDay),
    restDayTargets: dailyTargets(nutritionProfile(s, date), false),
  };
}

// ---------- Export ----------

export function exportAll() {
  const tables = [
    'settings',
    'exercises',
    'routines',
    'routine_exercises',
    'workouts',
    'workout_sets',
    'foods',
    'food_logs',
    'body_weights',
    'water_logs',
  ];
  const out: Record<string, unknown[]> = {};
  for (const t of tables) out[t] = db.getAllSync(`SELECT * FROM ${t}`);
  return { exportedAt: new Date().toISOString(), app: 'FitLog', version: 1, ...out };
}

export const weekAgo = () => addDays(dateStr(), -6);
