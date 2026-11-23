import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { Button, Card, Empty, Row, Screen, Stat, T } from '@/src/components/ui';
import { deleteWorkout, getSettings, getWorkout, SetRow, setsBefore } from '@/src/db/queries';
import { duration, prettyDate, r0, toDisplayWeight } from '@/src/lib/format';
import { e1rm, findPRs, PR_LABELS, PRKind } from '@/src/lib/strength';
import { useDb } from '@/src/store/version';
import { useColors } from '@/src/theme';

export default function WorkoutDetail() {
  const c = useColors();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const workoutId = Number(id);
  const data = useDb(() => getWorkout(workoutId));
  const { units } = useDb(getSettings);

  const groups = useDb(() => {
    if (!data) return [];
    const byExercise = new Map<number, SetRow[]>();
    for (const s of data.sets) {
      const arr = byExercise.get(s.exerciseId) ?? [];
      arr.push(s);
      byExercise.set(s.exerciseId, arr);
    }
    return [...byExercise.entries()].map(([exerciseId, sets]) => ({
      exerciseId,
      name: sets[0].exerciseName,
      sets,
      prs: findPRs(setsBefore(exerciseId, data.workout.startedAt), sets) as PRKind[],
    }));
  });

  if (!data) {
    return (
      <Screen>
        <Empty text="Workout not found." />
      </Screen>
    );
  }
  const w = data.workout;
  const prCount = groups.reduce((n, g) => n + g.prs.length, 0);

  const onDelete = () =>
    Alert.alert('Delete workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteWorkout(workoutId);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: w.name }} />
      <Screen>
        {fresh ? (
          <Card style={{ backgroundColor: c.successSoft, borderColor: c.success }}>
            <T v="h2">Workout saved 🎉</T>
            <T>
              {prCount > 0 ? `You set ${prCount} personal record${prCount > 1 ? 's' : ''}!` : 'Nice work, keep it up.'}
            </T>
          </Card>
        ) : null}

        <Card>
          <T v="small">
            {prettyDate(w.date)} ·{' '}
            {new Date(w.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </T>
          <Row>
            <Stat label="Duration" value={duration(w.endedAt - w.startedAt)} />
            <Stat label="Volume" value={`${r0(toDisplayWeight(w.volume, units))} ${units}`} />
            <Stat label="Sets" value={String(w.setCount)} />
            <Stat label="PRs" value={String(prCount)} />
          </Row>
        </Card>

        {groups.map((g) => (
          <Card key={g.exerciseId}>
            <Button
              small
              variant="ghost"
              title={g.name}
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(g.exerciseId) } })}
            />
            {g.prs.length > 0 && (
              <T v="small" color={c.warning}>
                🏆 {g.prs.map((p) => PR_LABELS[p]).join(' · ')}
              </T>
            )}
            {g.sets.map((s, i) => (
              <Row key={s.id} between>
                <T muted style={{ width: 30 }}>
                  {s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : i + 1}
                </T>
                <T style={{ flex: 1 }}>
                  {toDisplayWeight(s.weightKg, units)} {units} × {s.reps}
                </T>
                <T v="small">e1RM {r0(toDisplayWeight(e1rm(s.weightKg, s.reps), units))}</T>
              </Row>
            ))}
          </Card>
        ))}

        <Button title="Delete workout" variant="danger" onPress={onDelete} />
      </Screen>
    </>
  );
}
