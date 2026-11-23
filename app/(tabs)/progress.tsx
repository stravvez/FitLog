import { router } from 'expo-router';

import { BarChart, HBars, LineChart } from '@/src/components/charts';
import { Card, Empty, ListItem, Row, Screen, Stat, T } from '@/src/components/ui';
import {
  allWorkingSets,
  getSettings,
  kcalByDay,
  listWorkouts,
  muscleSetsSince,
  targetsFor,
  weekAgo,
  weightsSince,
} from '@/src/db/queries';
import { addDays, dateStr, prettyDate, r0, r1, toDisplayWeight } from '@/src/lib/format';
import { e1rm } from '@/src/lib/strength';
import { useDb } from '@/src/store/version';
import { useColors } from '@/src/theme';

function movingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export default function ProgressTab() {
  const c = useColors();
  const today = dateStr();
  const { units } = useDb(getSettings);
  const weights = useDb(() => weightsSince(addDays(today, -90)));
  const kcal = useDb(() => kcalByDay(addDays(today, -13), today));
  const restTarget = useDb(() => targetsFor(today).restDayTargets.kcal);
  const muscles = useDb(() => muscleSetsSince(weekAgo()));
  const workouts = useDb(() => listWorkouts(1000));

  const prs = useDb(() => {
    const best = new Map<number, { name: string; e1rm: number; weightKg: number; reps: number }>();
    for (const s of allWorkingSets()) {
      const est = e1rm(s.weightKg, s.reps);
      const cur = best.get(s.exerciseId);
      if (!cur || est > cur.e1rm) best.set(s.exerciseId, { name: s.exerciseName, e1rm: est, weightKg: s.weightKg, reps: s.reps });
    }
    return [...best.entries()]
      .map(([exerciseId, v]) => ({ exerciseId, ...v }))
      .filter((p) => p.e1rm > 0)
      .sort((a, b) => b.e1rm - a.e1rm);
  });

  // Calories: last 14 days, zero-filled.
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const kcalMap = new Map(kcal.map((k) => [k.date, k.kcal]));
  const kcalValues = days.map((d) => kcalMap.get(d) ?? 0);
  const loggedDays = kcalValues.filter((v) => v > 0);
  const avgKcal = loggedDays.length ? loggedDays.reduce((a, b) => a + b, 0) / loggedDays.length : 0;

  const wValues = weights.map((w) => toDisplayWeight(w.kg, units));
  const wAvg = movingAverage(wValues);
  const change = wAvg.length > 1 ? wAvg[wAvg.length - 1] - wAvg[0] : 0;

  const thisWeek = workouts.filter((w) => w.date >= weekAgo());
  const weekVolume = thisWeek.reduce((t, w) => t + w.volume, 0);

  return (
    <Screen>
      <Card>
        <T v="h2">Last 7 days</T>
        <Row>
          <Stat label="Workouts" value={String(thisWeek.length)} />
          <Stat label="Volume" value={`${r0(toDisplayWeight(weekVolume, units))} ${units}`} />
          <Stat label="Avg kcal" value={avgKcal ? String(r0(avgKcal)) : '—'} />
        </Row>
      </Card>

      <Card>
        <Row between>
          <T v="h2">Body weight</T>
          {wAvg.length > 1 && (
            <T v="small" color={change <= 0 ? c.success : c.warning}>
              {change > 0 ? '+' : ''}
              {r1(change)} {units} (7-day avg)
            </T>
          )}
        </Row>
        <LineChart
          values={wValues}
          secondary={wAvg}
          format={(n) => `${r1(n)}`}
          startLabel={weights[0] ? prettyDate(weights[0].date) : undefined}
          endLabel={weights.length ? prettyDate(weights[weights.length - 1].date) : undefined}
        />
        <T v="small">Faint line: daily entries. Bold line: 7-day moving average.</T>
      </Card>

      <Card>
        <T v="h2">Calories (14 days)</T>
        <BarChart
          values={kcalValues}
          labels={days.map((d, i) => (i % 2 === 1 ? d.slice(8) : ''))}
          target={restTarget}
          color={c.kcal}
        />
        <T v="small">Dashed line: your rest-day target ({restTarget} kcal). Orange bars are over target.</T>
      </Card>

      <Card>
        <T v="h2">Sets per muscle (7 days)</T>
        <HBars rows={muscles.map((m) => ({ label: m.muscle, value: m.sets }))} />
        <T v="small">About 10–20 hard sets per muscle per week is a common target for growth.</T>
      </Card>

      <Card>
        <T v="h2">Personal records</T>
        {prs.length === 0 && <Empty text="Finish a workout to start tracking PRs." />}
        {prs.map((p) => (
          <ListItem
            key={p.exerciseId}
            title={p.name}
            subtitle={`Best set ${toDisplayWeight(p.weightKg, units)} ${units} × ${p.reps}`}
            right={
              <T muted>
                e1RM {r0(toDisplayWeight(p.e1rm, units))} {units}
              </T>
            }
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(p.exerciseId) } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
