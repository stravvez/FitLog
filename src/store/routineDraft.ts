import { create } from 'zustand';

import type { RoutineItem } from '@/src/db/queries';

/** Editing state for the routine editor, shared with the exercise picker. */
interface RoutineDraftState {
  name: string;
  items: RoutineItem[];
  reset: (name: string, items: RoutineItem[]) => void;
  setName: (name: string) => void;
  add: (ex: { id: number; name: string }[]) => void;
  update: (index: number, patch: Partial<RoutineItem>) => void;
  remove: (index: number) => void;
  move: (index: number, dir: -1 | 1) => void;
}

export const useRoutineDraft = create<RoutineDraftState>((set) => ({
  name: '',
  items: [],
  reset: (name, items) => set({ name, items }),
  setName: (name) => set({ name }),
  add: (ex) =>
    set((s) => ({
      items: [...s.items, ...ex.map((e) => ({ exerciseId: e.id, name: e.name, targetSets: 3, targetReps: 10 }))],
    })),
  update: (index, patch) =>
    set((s) => ({ items: s.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) })),
  remove: (index) => set((s) => ({ items: s.items.filter((_, i) => i !== index) })),
  move: (index, dir) =>
    set((s) => {
      const j = index + dir;
      if (j < 0 || j >= s.items.length) return s;
      const items = [...s.items];
      [items[index], items[j]] = [items[j], items[index]];
      return { items };
    }),
}));
