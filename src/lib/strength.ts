export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface LoggedSet {
  weightKg: number;
  reps: number;
  type: SetType;
}

/** Estimated one-rep max (Epley). A single rep is the weight itself. */
export function e1rm(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

const working = (sets: LoggedSet[]) => sets.filter((s) => s.type !== 'warmup' && s.reps > 0);

export function volume(sets: LoggedSet[]): number {
  return working(sets).reduce((t, s) => t + s.weightKg * s.reps, 0);
}

export interface Bests {
  maxWeight: number;
  maxE1rm: number;
  maxSetVolume: number;
  maxReps: number;
}

export function bests(sets: LoggedSet[]): Bests {
  const b: Bests = { maxWeight: 0, maxE1rm: 0, maxSetVolume: 0, maxReps: 0 };
  for (const s of working(sets)) {
    b.maxWeight = Math.max(b.maxWeight, s.weightKg);
    b.maxE1rm = Math.max(b.maxE1rm, e1rm(s.weightKg, s.reps));
    b.maxSetVolume = Math.max(b.maxSetVolume, s.weightKg * s.reps);
    b.maxReps = Math.max(b.maxReps, s.reps);
  }
  return b;
}

export type PRKind = 'weight' | 'e1rm' | 'setVolume' | 'reps';

export const PR_LABELS: Record<PRKind, string> = {
  weight: 'Heaviest weight',
  e1rm: 'Best est. 1RM',
  setVolume: 'Best set volume',
  reps: 'Most reps',
};

/**
 * PRs set by `current` compared to all `previous` sets of the same exercise.
 * The first time an exercise is done counts as a baseline, not a PR.
 */
export function findPRs(previous: LoggedSet[], current: LoggedSet[]): PRKind[] {
  if (working(previous).length === 0 || working(current).length === 0) return [];
  const p = bests(previous);
  const c = bests(current);
  const prs: PRKind[] = [];
  if (c.maxWeight > p.maxWeight) prs.push('weight');
  if (c.maxE1rm > p.maxE1rm + 1e-9) prs.push('e1rm');
  if (c.maxSetVolume > p.maxSetVolume) prs.push('setVolume');
  if (c.maxReps > p.maxReps) prs.push('reps');
  return prs;
}
