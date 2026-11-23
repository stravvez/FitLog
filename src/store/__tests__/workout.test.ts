import { lastSetsForExercise, saveWorkout } from '@/src/db/queries';
import { useWorkout } from '@/src/store/workout';

jest.mock('@/src/db/queries', () => ({
  getKv: jest.fn(() => null),
  setKv: jest.fn(),
  lastSetsForExercise: jest.fn(() => []),
  saveWorkout: jest.fn(() => 42),
}));

const mockLast = lastSetsForExercise as jest.Mock;
const mockSave = saveWorkout as jest.Mock;
const store = () => useWorkout.getState();
const draft = () => store().draft!;

beforeEach(() => {
  jest.clearAllMocks();
  mockLast.mockReturnValue([]);
  useWorkout.setState({ draft: null, restEndsAt: null });
});

describe('workout draft', () => {
  it('starts from a routine with target set counts and previous sets', () => {
    mockLast.mockImplementation((id: number) =>
      id === 1
        ? [
            { weightKg: 40, reps: 10, type: 'warmup' },
            { weightKg: 60, reps: 8, type: 'normal' },
          ]
        : [],
    );
    store().start('Push', 7, [
      { exerciseId: 1, name: 'Bench', targetSets: 3, targetReps: 8 },
      { exerciseId: 2, name: 'Fly', targetSets: 2, targetReps: 12 },
    ]);
    const [bench, fly] = draft().exercises;
    expect(draft().routineId).toBe(7);
    expect(bench.sets).toHaveLength(3);
    expect(bench.sets.map((s) => s.type)).toEqual(['warmup', 'normal', 'normal']);
    expect(bench.previous).toHaveLength(2);
    expect(fly.sets).toHaveLength(2);
    expect(new Set([...bench.sets, ...fly.sets].map((s) => s.key)).size).toBe(5);
  });

  it('defaults to the previous session set count for ad-hoc exercises, else 3', () => {
    store().start('W', null);
    mockLast.mockReturnValueOnce([
      { weightKg: 50, reps: 5, type: 'normal' },
      { weightKg: 50, reps: 5, type: 'normal' },
    ]);
    store().addExercises([{ id: 1, name: 'Squat' }, { id: 2, name: 'New thing' }]);
    expect(draft().exercises.map((e) => e.sets.length)).toEqual([2, 3]);
  });

  it('fills empty fields from the previous session when a set is ticked (in lb)', () => {
    mockLast.mockReturnValue([{ weightKg: 100, reps: 5, type: 'normal' }]);
    store().start('W', null, [{ exerciseId: 1, name: 'Squat', targetSets: 1, targetReps: null }]);
    const ex = draft().exercises[0];
    expect(store().toggleDone(ex.key, ex.sets[0].key, 'lb')).toBe(true);
    expect(draft().exercises[0].sets[0]).toMatchObject({ weight: '220.5', reps: '5', done: true });
    // Ticking again un-ticks without clearing the values.
    expect(store().toggleDone(ex.key, ex.sets[0].key, 'lb')).toBe(false);
    expect(draft().exercises[0].sets[0]).toMatchObject({ weight: '220.5', reps: '5', done: false });
  });

  it('uses target reps when there is no history, and refuses a set with no reps', () => {
    store().start('W', null, [
      { exerciseId: 1, name: 'A', targetSets: 1, targetReps: 12 },
      { exerciseId: 2, name: 'B', targetSets: 1, targetReps: null },
    ]);
    const [a, b] = draft().exercises;
    expect(store().toggleDone(a.key, a.sets[0].key, 'kg')).toBe(true);
    expect(draft().exercises[0].sets[0]).toMatchObject({ weight: '0', reps: '12' });
    expect(store().toggleDone(b.key, b.sets[0].key, 'kg')).toBe(false);
    expect(draft().exercises[1].sets[0].done).toBe(false);
  });

  it('copies the last row when adding a set, and cycles set types', () => {
    store().start('W', null, [{ exerciseId: 1, name: 'A', targetSets: 1, targetReps: null }]);
    const ex = draft().exercises[0];
    store().updateSet(ex.key, ex.sets[0].key, { weight: '80', reps: '6' });
    store().addSet(ex.key);
    const sets = draft().exercises[0].sets;
    expect(sets[1]).toMatchObject({ weight: '80', reps: '6', done: false });
    const k = sets[1].key;
    const types = [1, 2, 3, 4].map(() => {
      store().cycleType(ex.key, k);
      return draft().exercises[0].sets[1].type;
    });
    expect(types).toEqual(['warmup', 'drop', 'failure', 'normal']);
  });

  it('saves only ticked sets, converting to kg, then clears the draft', () => {
    store().start('  ', 3, [
      { exerciseId: 10, name: 'A', targetSets: 3, targetReps: null },
      { exerciseId: 20, name: 'B', targetSets: 1, targetReps: null },
    ]);
    const [a, b] = draft().exercises;
    store().updateSet(a.key, a.sets[0].key, { weight: '135', reps: '10' });
    store().updateSet(a.key, a.sets[2].key, { weight: '155', reps: '8' });
    store().updateSet(b.key, b.sets[0].key, { weight: '', reps: '15' });
    store().toggleDone(a.key, a.sets[0].key, 'lb');
    store().toggleDone(a.key, a.sets[2].key, 'lb'); // middle set left unticked
    store().toggleDone(b.key, b.sets[0].key, 'lb');

    expect(store().finish('lb')).toBe(42);
    const arg = mockSave.mock.calls[0][0];
    expect(arg.name).toBe('Workout');
    expect(arg.routineId).toBe(3);
    expect(arg.sets).toHaveLength(3);
    expect(arg.sets[0]).toMatchObject({ exerciseId: 10, position: 0, setIndex: 0, reps: 10 });
    expect(arg.sets[0].weightKg).toBeCloseTo(61.235, 2);
    expect(arg.sets[1]).toMatchObject({ exerciseId: 10, position: 0, setIndex: 1, reps: 8 });
    expect(arg.sets[2]).toMatchObject({ exerciseId: 20, position: 1, setIndex: 0, weightKg: 0, reps: 15 });
    expect(store().draft).toBeNull();
  });

  it('returns null and keeps the draft when nothing is ticked', () => {
    store().start('W', null, [{ exerciseId: 1, name: 'A', targetSets: 1, targetReps: 5 }]);
    expect(store().finish('kg')).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
    expect(store().draft).not.toBeNull();
  });

  it('restores a saved draft and recovers from a corrupt one', () => {
    const queries = jest.requireMock('@/src/db/queries');
    queries.getKv.mockReturnValueOnce(JSON.stringify({ name: 'Saved', startedAt: 1, routineId: null, exercises: [] }));
    store().hydrate();
    expect(draft().name).toBe('Saved');

    useWorkout.setState({ draft: null });
    queries.getKv.mockReturnValueOnce('{not json');
    store().hydrate();
    expect(store().draft).toBeNull();
    expect(queries.setKv).toHaveBeenCalledWith('active_workout', null);
  });
});
