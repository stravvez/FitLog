import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useId } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Empty, Input, Row, Screen, T } from '@/src/components/ui';
import { deleteRoutine, getRoutine, saveRoutine } from '@/src/db/queries';
import { useRoutineDraft } from '@/src/store/routineDraft';

function Stepper({ label, value, onChange, min = 1 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <Row gap={4}>
      <T v="small">{label}</T>
      <Button small variant="secondary" title="−" onPress={() => onChange(Math.max(min, value - 1))} />
      <T style={{ minWidth: 22, textAlign: 'center' }}>{value}</T>
      <Button small variant="secondary" title="+" onPress={() => onChange(value + 1)} />
    </Row>
  );
}

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const session = useId();
  const { session: loadedFor, name, items, setName, update, remove, move } = useRoutineDraft();

  useEffect(() => {
    const r = isNew ? null : getRoutine(Number(id));
    useRoutineDraft.getState().reset(session, r?.name ?? '', r?.items ?? []);
  }, [id, isNew, session]);

  const onSave = () => {
    if (!name.trim()) return Alert.alert('Give your routine a name');
    if (items.length === 0) return Alert.alert('Add at least one exercise');
    saveRoutine(isNew ? null : Number(id), name.trim(), items);
    router.back();
  };

  const onDelete = () =>
    Alert.alert('Delete routine?', name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRoutine(Number(id));
          router.back();
        },
      },
    ]);

  // Until this screen has loaded its routine, the shared store may hold another routine.
  if (loadedFor !== session) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'New routine' : 'Edit routine',
          headerRight: () => <Button small title="Save" onPress={onSave} />,
        }}
      />
      <Screen>
        <Input label="Name" placeholder="e.g. Push Day" value={name} onChangeText={setName} />
        {items.length === 0 && <Empty text="No exercises yet." />}
        {items.map((it, i) => (
          <Card key={`${it.exerciseId}-${i}`}>
            <Row between>
              <T v="h2" style={{ flex: 1 }}>
                {it.name}
              </T>
              <Button small variant="ghost" title="↑" onPress={() => move(i, -1)} />
              <Button small variant="ghost" title="↓" onPress={() => move(i, 1)} />
              <Button small variant="ghost" title="✕" onPress={() => remove(i)} />
            </Row>
            <Row between>
              <Stepper label="Sets" value={it.targetSets} onChange={(n) => update(i, { targetSets: n })} />
              <Stepper label="Reps" value={it.targetReps} onChange={(n) => update(i, { targetReps: n })} />
            </Row>
          </Card>
        ))}
        <Button
          title="+ Add exercises"
          variant="secondary"
          onPress={() => router.push({ pathname: '/exercise-picker', params: { target: 'routine' } })}
        />
        {!isNew && <Button title="Delete routine" variant="danger" onPress={onDelete} />}
      </Screen>
    </>
  );
}
