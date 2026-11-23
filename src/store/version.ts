import { useEffect, useState } from 'react';
import { create } from 'zustand';

/** Bumped after every DB write so screens re-run their queries. */
export const useDataVersion = create<{ v: number; bump: () => void }>((set) => ({
  v: 0,
  bump: () => set((s) => ({ v: s.v + 1 })),
}));

export const bumpData = () => useDataVersion.getState().bump();

/**
 * Run a synchronous DB query during render. The component re-renders (and so re-queries)
 * whenever any write bumps the data version. Queries are small local SQLite reads, so
 * running them each render is cheap and avoids stale-cache bugs.
 */
export function useDb<T>(fn: () => T): T {
  useDataVersion((s) => s.v);
  return fn();
}

/** Current time, refreshed on an interval (for elapsed-time displays). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
