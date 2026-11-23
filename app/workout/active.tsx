import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Button, Card, Input, Row, Screen, T } from '@/src/components/ui';
import { getSettings } from '@/src/db/queries';
import { clock, duration, toDisplayWeight } from '@/src/lib/format';
import { cancelRestAlert, scheduleRestAlert } from '@/src/lib/restTimer';
import { useDb, useNow } from '@/src/store/version';
import { DraftExercise, useWorkout } from '@/src/store/workout';
import { useColors } from '@/src/theme';

const TYPE_LABEL = { normal: '', warmup: 'W', drop: 'D', failure: 'F' } as const;

/** Ticks every second on its own so the rest of the screen does not re-render. */
function ElapsedTitle({ startedAt }: { startedAt: number }) {
  const c = useColors();
  const now = useNow();
  return <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{duration(now - startedAt)}</Text>;
}

function RestBanner() {
  const c = useColors();
  const now = useNow(250);
  const restEndsAt = useWorkout((s) => s.restEndsAt);
  const setRest = useWorkout((s) => s.setRest);
  const restLeft = restEndsAt ? (restEndsAt - now) / 1000 : 0;

  useEffect(() => {
    if (restEndsAt && restLeft <= 0) setRest(null);
  }, [restEndsAt, restLeft, setRest]);

  if (!restEndsAt || restLeft <= 0) return null;

  const adjust = (delta: number) => {
    const next = restEndsAt + delta * 1000;
    setRest(next);
    scheduleRestAlert((next - Date.now()) / 1000);
  };

  return (
    <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primary }}>
      <Row between>
        <T v="h2" color={c.primary}>
          Rest {clock(restLeft)}
        </T>
        <Row gap={4}>
          <Button small variant="ghost" title="−15s" onPress={() => adjust(-15)} />
          <Button small variant="ghost" title="+15s" onPress={() => adjust(15)} />
          <Button
            small
            title="Skip"
            onPress={() => {
              setRest(null);
              cancelRestAlert();
            }}
          />
        </Row>
      </Row>
    </Card>
  );
}

export default function ActiveWorkout() {
  const settings = useDb(getSettings);
  const draft = useWorkout((s) => s.draft);
  const { rename, discard, finish } = useWorkout.getState();
  const units = settings.units;

  if (!draft) {
    return (
      <Screen>
        <T muted>No workout in progress.</T>
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const doneSets = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  const onFinish = () => {
    if (doneSets === 0) {
      return Alert.alert('Nothing to save', 'Tick at least one set as done (✓) before finishing.');
    }
    const pending = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
    const save = () => {
      const id = finish(units);
      if (id) {
        cancelRestAlert();
        router.replace({ pathname: '/workout/[id]', params: { id: String(id), fresh: '1' } });
      } else Alert.alert('Nothing to save', 'Your ticked sets have no reps entered.');
    };
    if (pending > 0) {
      Alert.alert('Finish workout?', `${pending} unticked set(s) will be discarded.`, [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Finish', onPress: save },
      ]);
    } else save();
  };

  const onDiscard = () =>
    Alert.alert('Discard workout?', 'Everything logged in this session will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          cancelRestAlert();
          discard();
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <ElapsedTitle startedAt={draft.startedAt} />,
          headerRight: () => <Button small title="Finish" onPress={onFinish} />,
        }}
      />
      <Screen>
        <Input value={draft.name} onChangeText={rename} placeholder="Workout name" style={{ fontWeight: '700' }} />

        <RestBanner />

        {draft.exercises.map((ex) => (
          <ExerciseBlock key={ex.key} ex={ex} units={units} restSeconds={settings.restSeconds} />
        ))}

        <Button
          title="+ Add exercise"
          variant="secondary"
          onPress={() => router.push({ pathname: '/exercise-picker', params: { target: 'workout' } })}
        />
        <Button title="Discard workout" variant="danger" onPress={onDiscard} />
      </Screen>
    </>
  );
}

function ExerciseBlock({ ex, units, restSeconds }: { ex: DraftExercise; units: 'kg' | 'lb'; restSeconds: number }) {
  const c = useColors();
  const { addSet, removeSet, updateSet, cycleType, toggleDone, removeExercise, startRest } = useWorkout.getState();
  let workingIndex = 0;

  const onTick = (setKey: string) => {
    const done = toggleDone(ex.key, setKey, units);
    if (done && restSeconds > 0) {
      startRest(restSeconds);
      scheduleRestAlert(restSeconds);
    }
  };

  const cell = { flex: 1, textAlign: 'center' as const };

  return (
    <Card>
      <Row between>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(ex.exerciseId) } })}>
          <T v="h2" color={c.primary}>
            {ex.name}
          </T>
        </Pressable>
        <Button
          small
          variant="ghost"
          title="Remove"
          onPress={() =>
            Alert.alert('Remove exercise?', ex.name, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => removeExercise(ex.key) },
            ])
          }
        />
      </Row>

      <Row gap={6}>
        <T v="label" style={{ width: 34, textAlign: 'center' }}>
          Set
        </T>
        <T v="label" style={[cell, { flex: 1.4 }]}>
          Previous
        </T>
        <T v="label" style={cell}>
          {units}
        </T>
        <T v="label" style={cell}>
          Reps
        </T>
        <View style={{ width: 40 }} />
      </Row>

      {ex.sets.map((s, i) => {
        const prev = ex.previous[i];
        const label = s.type === 'normal' ? String(++workingIndex) : TYPE_LABEL[s.type];
        const prevText = prev ? `${toDisplayWeight(prev.weightKg, units)} × ${prev.reps}` : '—';
        const repsPlaceholder = prev ? String(prev.reps) : ex.targetReps ? String(ex.targetReps) : '0';
        const inputStyle = {
          flex: 1,
          textAlign: 'center' as const,
          backgroundColor: s.done ? 'transparent' : c.input,
          color: c.text,
          borderRadius: 8,
          paddingVertical: 8,
          fontSize: 15,
          fontWeight: '600' as const,
        };
        return (
          <Pressable
            key={s.key}
            onLongPress={() =>
              Alert.alert(`Set ${label}`, undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete set', style: 'destructive', onPress: () => removeSet(ex.key, s.key) },
              ])
            }>
            <Row
              gap={6}
              style={{ backgroundColor: s.done ? c.successSoft : 'transparent', borderRadius: 8, paddingVertical: 2 }}>
              <Pressable
                onPress={() => cycleType(ex.key, s.key)}
                style={{ width: 34, alignItems: 'center', paddingVertical: 8 }}>
                <Text
                  style={{
                    fontWeight: '800',
                    color: s.type === 'warmup' ? c.warning : s.type === 'normal' ? c.text : c.danger,
                  }}>
                  {label}
                </Text>
              </Pressable>
              <T v="small" style={[cell, { flex: 1.4 }]} numberOfLines={1}>
                {prevText}
              </T>
              <TextInput
                style={inputStyle}
                keyboardType="decimal-pad"
                value={s.weight}
                placeholder={prev ? String(toDisplayWeight(prev.weightKg, units)) : '0'}
                placeholderTextColor={c.muted}
                onChangeText={(t) => updateSet(ex.key, s.key, { weight: t })}
                selectTextOnFocus
              />
              <TextInput
                style={inputStyle}
                keyboardType="number-pad"
                value={s.reps}
                placeholder={repsPlaceholder}
                placeholderTextColor={c.muted}
                onChangeText={(t) => updateSet(ex.key, s.key, { reps: t })}
                selectTextOnFocus
              />
              <Pressable
                accessibilityLabel="Mark set done"
                onPress={() => onTick(s.key)}
                style={{
                  width: 40,
                  height: 34,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: s.done ? c.success : c.input,
                }}>
                <Text style={{ color: s.done ? '#fff' : c.muted, fontWeight: '900', fontSize: 16 }}>✓</Text>
              </Pressable>
            </Row>
          </Pressable>
        );
      })}
      <Button small variant="secondary" title="+ Add set" onPress={() => addSet(ex.key)} />
      <T v="small">Tap a set number to mark it warm-up / drop / failure. Long-press a set to delete it.</T>
    </Card>
  );
}
