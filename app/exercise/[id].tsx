import { router, Stack, useLocalSearchParams } from 'expo-router';

import { LineChart } from '@/src/components/charts';
import { Card, Empty, ListItem, Row, Screen, Stat, T } from '@/src/components/ui';
import { exerciseHistory, getExercise, getSettings } from '@/src/db/queries';
import { prettyDate, r0, r1, toDisplayWeight } from '@/src/lib/format';
import { bests, volume } from '@/src/lib/strength';
import { useDb } from '@/src/store/version';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);
  const ex = useDb(() => getExercise(exerciseId));
  const history = useDb(() => exerciseHistory(exerciseId));
  const { units } = useDb(getSettings);

  if (!ex) return <Empty text="Exercise not found." />;

  const all = bests(history.flatMap((h) => h.sets));
  const sessions = history.map((h) => ({ ...h, b: bests(h.sets), vol: volume(h.sets) })).filter((h) => h.b.maxE1rm > 0);
  const w = (kg: number) => toDisplayWeight(kg, units);

  return (
    <>
      <Stack.Screen options={{ title: ex.name }} />
      <Screen>
        <Card>
          <T v="small" style={{ textTransform: 'capitalize' }}>
            {ex.primaryMuscle}
            {ex.secondaryMuscles ? ` · also ${ex.secondaryMuscles.replace(/,/g, ', ')}` : ''} · {ex.equipment}
          </T>
          <Row>
            <Stat label="Heaviest" value={`${w(all.maxWeight)} ${units}`} />
            <Stat label="Best e1RM" value={`${r1(w(all.maxE1rm))} ${units}`} />
            <Stat label="Most reps" value={String(all.maxReps)} />
          </Row>
        </Card>

        <Card>
          <T v="h2">Estimated 1RM</T>
          <LineChart
            values={sessions.map((s) => w(s.b.maxE1rm))}
            format={(n) => `${r0(n)}`}
            startLabel={sessions[0] ? prettyDate(sessions[0].date) : undefined}
            endLabel={sessions.length ? prettyDate(sessions[sessions.length - 1].date) : undefined}
          />
        </Card>

        <Card>
          <T v="h2">Volume per session</T>
          <LineChart values={sessions.map((s) => w(s.vol))} format={(n) => `${r0(n)}`} />
        </Card>

        <Card>
          <T v="h2">History</T>
          {history.length === 0 && <Empty text="You haven't logged this exercise yet." />}
          {[...history].reverse().map((h) => (
            <ListItem
              key={h.workoutId}
              title={prettyDate(h.date)}
              subtitle={h.sets.map((s) => `${w(s.weightKg)}×${s.reps}`).join('  ')}
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(h.workoutId) } })}
            />
          ))}
        </Card>
      </Screen>
    </>
  );
}
