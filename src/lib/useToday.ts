import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { dateStr } from '@/src/lib/format';

/**
 * Today's local date (YYYY-MM-DD) that stays correct when the app is left open past
 * midnight or resumed from the background the next day.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => dateStr());
  useEffect(() => {
    const check = () => setToday(dateStr()); // same string → no re-render
    const timer = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return today;
}
