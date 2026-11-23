import { create } from 'zustand';

import { getKv, lastSetsForExercise, NewSet, saveWorkout, setKv } from '@/src/db/queries';
import { fromDisplayWeight, parseNum, toDisplayWeight, Units } from '@/src/lib/format';
import type { LoggedSet, SetType } from '@/src/lib/strength';

export interface DraftSet {
  key: string;
  /** Raw text in the user's display units */
  weight: string;
  reps: string;
  type: SetType;
  done: boolean;
}

export interface DraftExercise {
  key: string;
  exerciseId: number;
  name: string;
  sets: DraftSet[];
  /** Sets from the last time this exercise was done (kg) */
  previous: LoggedSet[];
  targetReps: number | null;
}

export interface Draft {
  name: string;
  startedAt: number;
  routineId: number | null;
  exercises: DraftExercise[];
}

let counter = 0;
const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

const SET_TYPES: SetType[] = ['normal', 'warmup', 'drop', 'failure'];

function newSet(): DraftSet {
  return { key: uid(), weight: '', reps: '', type: 'normal', done: false };
}

function newExercise(exerciseId: number, name: string, setCount: number, targetReps: number | null) {
  const previous = lastSetsForExercise(exerciseId);
  const count = Math.max(1, setCount || previous.length || 3);
  const ex: DraftExercise = {
    key: uid(),
    exerciseId,
    name,
    previous,
    targetReps,
    sets: Array.from({ length: count }, (_, i) => ({
      ...newSet(),
      type: previous[i]?.type === 'warmup' ? 'warmup' : 'normal',
    })),
  };
  return ex;
}

interface WorkoutState {
  draft: Draft | null;
  restEndsAt: number | null;
  hydrate: () => void;
  start: (
    name: string,
    routineId: number | null,
    items?: { exerciseId: number; name: string; targetSets: number; targetReps: number | null }[],
  ) => void;
  rename: (name: string) => void;
  addExercises: (items: { id: number; name: string }[]) => void;
  removeExercise: (exKey: string) => void;
  addSet: (exKey: string) => void;
  removeSet: (exKey: string, setKey: string) => void;
  updateSet: (exKey: string, setKey: string, patch: Partial<Pick<DraftSet, 'weight' | 'reps'>>) => void;
  cycleType: (exKey: string, setKey: string) => void;
  /** Returns true if the set is now marked done. Fills empty fields from previous/target. */
  toggleDone: (exKey: string, setKey: string, units: Units) => boolean;
  setRest: (endsAt: number | null) => void;
  startRest: (seconds: number) => void;
  discard: () => void;
  /** Saves completed sets. Returns the new workout id, or null if nothing was completed. */
  finish: (units: Units) => number | null;
}

const DRAFT_KEY = 'active_workout';

function mapSets(d: Draft, exKey: string, fn: (sets: DraftSet[], ex: DraftExercise) => DraftSet[]): Draft {
  return {
    ...d,
    exercises: d.exercises.map((e) => (e.key === exKey ? { ...e, sets: fn(e.sets, e) } : e)),
  };
}

export const useWorkout = create<WorkoutState>((set, get) => ({
  draft: null,
  restEndsAt: null,

  hydrate: () => {
    const raw = getKv(DRAFT_KEY);
    if (raw) {
      try {
        set({ draft: JSON.parse(raw) as Draft });
      } catch {
        setKv(DRAFT_KEY, null);
      }
    }
  },

  start: (name, routineId, items = []) =>
    set({
      restEndsAt: null,
      draft: {
        name,
        routineId,
        startedAt: Date.now(),
        exercises: items.map((it) => newExercise(it.exerciseId, it.name, it.targetSets, it.targetReps)),
      },
    }),

  rename: (name) => {
    const d = get().draft;
    if (d) set({ draft: { ...d, name } });
  },

  addExercises: (items) => {
    const d = get().draft;
    if (!d) return;
    set({
      draft: { ...d, exercises: [...d.exercises, ...items.map((it) => newExercise(it.id, it.name, 0, null))] },
    });
  },

  removeExercise: (exKey) => {
    const d = get().draft;
    if (d) set({ draft: { ...d, exercises: d.exercises.filter((e) => e.key !== exKey) } });
  },

  addSet: (exKey) => {
    const d = get().draft;
    if (!d) return;
    set({
      draft: mapSets(d, exKey, (sets) => {
        const last = sets[sets.length - 1];
        // Copy the previous row's values, like Hevy does.
        return [...sets, { ...newSet(), weight: last?.weight ?? '', reps: last?.reps ?? '' }];
      }),
    });
  },

  removeSet: (exKey, setKey) => {
    const d = get().draft;
    if (d) set({ draft: mapSets(d, exKey, (sets) => sets.filter((s) => s.key !== setKey)) });
  },

  updateSet: (exKey, setKey, patch) => {
    const d = get().draft;
    if (!d) return;
    set({ draft: mapSets(d, exKey, (sets) => sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s))) });
  },

  cycleType: (exKey, setKey) => {
    const d = get().draft;
    if (!d) return;
    set({
      draft: mapSets(d, exKey, (sets) =>
        sets.map((s) =>
          s.key === setKey ? { ...s, type: SET_TYPES[(SET_TYPES.indexOf(s.type) + 1) % SET_TYPES.length] } : s,
        ),
      ),
    });
  },

  toggleDone: (exKey, setKey, units) => {
    const d = get().draft;
    if (!d) return false;
    let nowDone = false;
    set({
      draft: mapSets(d, exKey, (sets, ex) =>
        sets.map((s, i) => {
          if (s.key !== setKey) return s;
          if (s.done) return { ...s, done: false };
          const prev = ex.previous[i];
          const weight = s.weight || (prev ? String(toDisplayWeight(prev.weightKg, units)) : '0');
          const reps = s.reps || (prev ? String(prev.reps) : ex.targetReps ? String(ex.targetReps) : '');
          if (!parseNum(reps)) return { ...s, weight, reps };
          nowDone = true;
          return { ...s, weight, reps, done: true };
        }),
      ),
    });
    return nowDone;
  },

  setRest: (endsAt) => set({ restEndsAt: endsAt }),

  startRest: (seconds) => set({ restEndsAt: Date.now() + seconds * 1000 }),

  discard: () => set({ draft: null, restEndsAt: null }),

  finish: (units) => {
    const d = get().draft;
    if (!d) return null;
    const sets: NewSet[] = [];
    d.exercises.forEach((ex, position) => {
      let setIndex = 0;
      for (const s of ex.sets) {
        const reps = parseNum(s.reps);
        if (!s.done || !reps || reps <= 0) continue;
        sets.push({
          exerciseId: ex.exerciseId,
          position,
          setIndex: setIndex++,
          weightKg: fromDisplayWeight(parseNum(s.weight) ?? 0, units),
          reps: Math.round(reps),
          type: s.type,
        });
      }
    });
    if (sets.length === 0) return null;
    const id = saveWorkout({
      name: d.name.trim() || 'Workout',
      startedAt: d.startedAt,
      endedAt: Date.now(),
      routineId: d.routineId,
      sets,
    });
    set({ draft: null, restEndsAt: null });
    return id;
  },
}));

/** Persist the draft whenever it changes, so killing the app mid-workout loses nothing. */
let subscribed = false;
export function persistWorkoutDraft() {
  if (subscribed) return;
  subscribed = true;
  useWorkout.subscribe((state, prev) => {
    if (state.draft !== prev.draft) {
      setKv(DRAFT_KEY, state.draft ? JSON.stringify(state.draft) : null);
    }
  });
}
