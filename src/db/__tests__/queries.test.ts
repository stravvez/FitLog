import { SEED_EXERCISES } from '@/src/data/exercises';
import { migrate } from '@/src/db';
import * as q from '@/src/db/queries';
import { dateStr } from '@/src/lib/format';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => jest.requireActual('@/src/test/sqliteAdapter').openTestDatabase(),
}));

const today = dateStr();
const exId = (name: string) => q.listExercises(name).find((e) => e.name === name)!.id;

beforeAll(() => {
  migrate();
  migrate(); // idempotent
});

describe('schema & settings', () => {
  it('seeds the exercise library once', () => {
    expect(q.listExercises()).toHaveLength(SEED_EXERCISES.length);
    expect(q.listExercises('', 'calves').map((e) => e.name)).toEqual(['Seated Calf Raise', 'Standing Calf Raise']);
  });

  it('round-trips settings', () => {
    const s = q.getSettings();
    expect(s).toMatchObject({ units: 'kg', restSeconds: 90, trainingBonusKcal: 250 });
    q.saveSettings({ ...s, age: 21, units: 'lb' });
    expect(q.getSettings()).toMatchObject({ age: 21, units: 'lb' });
    q.saveSettings(s);
  });

  it('tracks first-time profile setup', () => {
    expect(q.needsProfileSetup()).toBe(true);
    q.markProfileSaved();
    expect(q.needsProfileSetup()).toBe(false);
  });

  it('creates custom exercises', () => {
    const id = q.createExercise('  Zercher Squat ', 'quads');
    expect(q.getExercise(id)).toMatchObject({ name: 'Zercher Squat', primaryMuscle: 'quads', isCustom: 1 });
  });
});

describe('routines', () => {
  it('saves, orders, updates and deletes', () => {
    const bench = exId('Bench Press (Barbell)');
    const fly = exId('Chest Fly (Dumbbell)');
    const id = q.saveRoutine(null, 'Push', [
      { exerciseId: fly, name: '', targetSets: 2, targetReps: 12 },
      { exerciseId: bench, name: '', targetSets: 4, targetReps: 6 },
    ]);
    expect(q.getRoutine(id)!.items.map((i) => i.name)).toEqual(['Chest Fly (Dumbbell)', 'Bench Press (Barbell)']);
    expect(q.listRoutines()[0].exerciseNames).toBe('Chest Fly (Dumbbell), Bench Press (Barbell)');

    q.saveRoutine(id, 'Push A', [{ exerciseId: bench, name: '', targetSets: 5, targetReps: 5 }]);
    expect(q.getRoutine(id)).toMatchObject({ name: 'Push A', items: [{ exerciseId: bench, targetSets: 5 }] });

    q.deleteRoutine(id);
    expect(q.getRoutine(id)).toBeNull();
  });
});

describe('workouts', () => {
  const squat = () => exId('Squat (Barbell)');
  const base = new Date();
  base.setHours(10, 0, 0, 0);
  const t = (daysAgo: number) => base.getTime() - daysAgo * 86_400_000;
  let w1 = 0;
  let w2 = 0;

  beforeAll(() => {
    w1 = q.saveWorkout({
      name: 'Legs 1',
      startedAt: t(3),
      endedAt: t(3) + 3_600_000,
      routineId: null,
      sets: [
        { exerciseId: squat(), position: 0, setIndex: 0, weightKg: 40, reps: 10, type: 'warmup' },
        { exerciseId: squat(), position: 0, setIndex: 1, weightKg: 100, reps: 5, type: 'normal' },
      ],
    });
    w2 = q.saveWorkout({
      name: 'Legs 2',
      startedAt: t(0),
      endedAt: t(0) + 3_000_000,
      routineId: null,
      sets: [
        { exerciseId: squat(), position: 0, setIndex: 0, weightKg: 105, reps: 5, type: 'normal' },
        { exerciseId: squat(), position: 0, setIndex: 1, weightKg: 105, reps: 4, type: 'normal' },
      ],
    });
  });

  it('summarises workouts, excluding warm-ups from volume', () => {
    const list = q.listWorkouts();
    expect(list.map((w) => w.name)).toEqual(['Legs 2', 'Legs 1']);
    expect(list[1]).toMatchObject({ setCount: 2, exerciseCount: 1, volume: 500, date: dateStr(t(3)) });
    expect(q.workoutsOnDate(today).map((w) => w.id)).toEqual([w2]);
  });

  it('returns the latest session for previous values and earlier sets for PRs', () => {
    expect(q.lastSetsForExercise(squat()).map((s) => s.weightKg)).toEqual([105, 105]);
    expect(
      q
        .setsBefore(squat(), t(0))
        .map((s) => s.weightKg)
        .sort((a, b) => a - b),
    ).toEqual([40, 100]);
    expect(q.getWorkout(w2)!.sets[0]).toMatchObject({ exerciseName: 'Squat (Barbell)', reps: 5 });
  });

  it('groups exercise history by workout, oldest first', () => {
    const h = q.exerciseHistory(squat());
    expect(h.map((s) => s.workoutId)).toEqual([w1, w2]);
    expect(h[0].sets).toHaveLength(2);
  });

  it('counts weekly working sets per muscle', () => {
    expect(q.muscleSetsSince(q.weekAgo())).toEqual([{ muscle: 'quads', sets: 3 }]);
  });

  it('marks training days and adds the bonus to targets', () => {
    const train = q.targetsFor(today);
    expect(train.isTrainingDay).toBe(true);
    expect(train.targets.kcal - train.restDayTargets.kcal).toBe(250);
    expect(q.targetsFor('2000-01-01').isTrainingDay).toBe(false);
    expect(q.targetsFor('2000-01-01', true).isTrainingDay).toBe(true);
  });

  it('cascades set deletion with the workout', () => {
    q.deleteWorkout(w1);
    expect(q.getWorkout(w1)).toBeNull();
    expect(q.setsBefore(squat(), t(0))).toEqual([]);
  });
});

describe('food', () => {
  const oats = {
    barcode: '123',
    name: 'Oats',
    brand: 'Brand',
    kcal: 380,
    protein: 13,
    carbs: 66,
    fat: 7,
    fiber: 10,
    servingG: 40,
    source: 'off' as const,
  };

  it('dedupes foods by barcode and updates them', () => {
    const a = q.upsertFood(oats);
    const b = q.upsertFood({ ...oats, kcal: 390 });
    expect(b).toBe(a);
    expect(q.getFoodByBarcode('123')).toMatchObject({ id: a, kcal: 390, servingG: 40 });
    expect(q.searchLocalFoods('bran').map((f) => f.id)).toEqual([a]);
  });

  it('logs food, totals macros by day and tracks recents', () => {
    const id = q.getFoodByBarcode('123')!.id;
    expect(q.recentFoods()).toEqual([]);
    q.addFoodLog(today, 'breakfast', id, 50);
    q.addFoodLog(today, 'snack', id, 100);
    q.addFoodLog('2000-01-01', 'lunch', id, 100);

    const logs = q.logsForDate(today);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ meal: 'breakfast', grams: 50, kcal: 195, name: 'Oats' });
    expect(q.dailyTotals(today)).toEqual({ kcal: 585, protein: 19.5, carbs: 99, fat: 10.5 });
    expect(q.dailyTotals('1999-01-01')).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(q.kcalByDay('2000-01-01', today).map((d) => d.kcal)).toEqual([390, 585]);
    expect(q.recentFoods().map((f) => f.id)).toEqual([id]);

    q.updateFoodLog(logs[0].id, 'lunch', 80);
    expect(q.getFoodLog(logs[0].id)).toMatchObject({ meal: 'lunch', grams: 80 });
    q.deleteFoodLog(logs[1].id);
    expect(q.logsForDate(today)).toHaveLength(1);
  });

  it('inserts barcode-less custom foods separately', () => {
    const a = q.upsertFood({ ...oats, barcode: null, source: 'custom' });
    const b = q.upsertFood({ ...oats, barcode: null, source: 'custom' });
    expect(a).not.toBe(b);
  });
});

describe('body weight & water', () => {
  it('keeps one weight per day and finds the latest on or before a date', () => {
    q.setBodyWeight('2026-01-01', 72);
    q.setBodyWeight('2026-01-05', 71);
    q.setBodyWeight('2026-01-05', 70.5);
    expect(q.weightOn('2026-01-05')).toBe(70.5);
    expect(q.latestWeight('2026-01-03')).toBe(72);
    expect(q.latestWeight('2025-12-31')).toBeNull();
    expect(q.weightsSince('2026-01-02')).toEqual([{ date: '2026-01-05', kg: 70.5 }]);
    expect(q.nutritionProfile(q.getSettings(), '2026-01-04').weightKg).toBe(72);
  });

  it('adds water and never goes below zero', () => {
    q.addWater(today, 500);
    q.addWater(today, 250);
    expect(q.waterOn(today)).toBe(750);
    q.addWater(today, -1000);
    expect(q.waterOn(today)).toBe(0);
  });
});

describe('kv & export', () => {
  it('stores and clears values', () => {
    q.setKv('k', 'v');
    expect(q.getKv('k')).toBe('v');
    q.setKv('k', null);
    expect(q.getKv('k')).toBeNull();
  });

  it('exports every table', () => {
    const data = q.exportAll() as unknown as Record<string, unknown>;
    for (const t of ['settings', 'exercises', 'workouts', 'workout_sets', 'foods', 'food_logs', 'body_weights']) {
      expect(Array.isArray(data[t])).toBe(true);
    }
  });
});
