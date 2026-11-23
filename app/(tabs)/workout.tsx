import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Button, Card, Empty, ListItem, Row, Screen, T } from '@/src/components/ui';
import { getRoutine, getSettings, listRoutines, listWorkouts } from '@/src/db/queries';
import { duration, prettyDate, r0, toDisplayWeight } from '@/src/lib/format';
import { useDb, useNow } from '@/src/store/version';
import { useWorkout } from '@/src/store/workout';

export default function WorkoutTab() {
  const draft = useWorkout((s) => s.draft);
  const now = useNow(30000);
  const start = useWorkout((s) => s.start);
  const routines = useDb(listRoutines);
  const history = useDb(() => listWorkouts(30));
  const { units } = useDb(getSettings);

  const guardStart = (fn: () => void) => {
    if (!draft) return fn();
    Alert.alert('Workout in progress', 'Resume your current workout or discard it first.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resume', onPress: () => router.push('/workout/active') },
    ]);
  };

  const startEmpty = () =>
    guardStart(() => {
      start('Workout', null);
      router.push('/workout/active');
    });

  const startRoutine = (id: number) =>
    guardStart(() => {
      const r = getRoutine(id);
      if (!r) return;
      start(
        r.name,
        r.id,
        r.items.map((it) => ({ ...it, targetReps: it.targetReps })),
      );
      router.push('/workout/active');
    });

  return (
    <Screen>
      {draft ? (
        <Card>
          <T v="h2">{draft.name}</T>
          <T muted>In progress · {duration(now - draft.startedAt)}</T>
          <Button title="Resume workout" onPress={() => router.push('/workout/active')} />
        </Card>
      ) : (
        <Button title="Start empty workout" onPress={startEmpty} />
      )}

      <Card>
        <Row between>
          <T v="h2">Routines</T>
          <Button
            small
            variant="secondary"
            title="+ New"
            onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })}
          />
        </Row>
        {routines.length === 0 && <Empty text="Create a routine (e.g. Push / Pull / Legs) to start faster." />}
        {routines.map((r) => (
          <ListItem
            key={r.id}
            title={r.name}
            subtitle={r.exerciseNames ?? 'No exercises'}
            onPress={() => startRoutine(r.id)}
            right={
              <Button
                small
                variant="ghost"
                title="Edit"
                onPress={() => router.push({ pathname: '/routine/[id]', params: { id: String(r.id) } })}
              />
            }
          />
        ))}
        {routines.length > 0 && <T v="small">Tap a routine to start it.</T>}
      </Card>

      <Card>
        <T v="h2">History</T>
        {history.length === 0 && <Empty text="Your finished workouts will show up here." />}
        {history.map((w) => (
          <ListItem
            key={w.id}
            title={w.name}
            subtitle={`${prettyDate(w.date)} · ${duration(w.endedAt - w.startedAt)} · ${w.setCount} sets · ${r0(
              toDisplayWeight(w.volume, units),
            )} ${units}`}
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(w.id) } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
