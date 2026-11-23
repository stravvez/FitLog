import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';

import { Button, Chip, Input, ListItem, Row, T } from '@/src/components/ui';
import { MUSCLES } from '@/src/data/exercises';
import { createExercise, Exercise, listExercises } from '@/src/db/queries';
import { useRoutineDraft } from '@/src/store/routineDraft';
import { useDb } from '@/src/store/version';
import { useWorkout } from '@/src/store/workout';
import { useColors } from '@/src/theme';

export default function ExercisePicker() {
  const c = useColors();
  const { target } = useLocalSearchParams<{ target: 'workout' | 'routine' }>();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise[]>([]);
  const results = useDb(() => listExercises(q, muscle));

  const toggle = (e: Exercise) =>
    setSelected((s) => (s.some((x) => x.id === e.id) ? s.filter((x) => x.id !== e.id) : [...s, e]));

  const confirm = (items: { id: number; name: string }[]) => {
    if (target === 'routine') useRoutineDraft.getState().add(items);
    else useWorkout.getState().addExercises(items);
    router.back();
  };

  const createCustom = () => {
    const name = q.trim();
    const id = createExercise(name, muscle ?? 'other');
    setSelected((s) => [...s, { id, name, primaryMuscle: muscle ?? 'other', secondaryMuscles: '', equipment: 'other', isCustom: 1 }]);
    setQ('');
  };

  const exactMatch = results.some((r) => r.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Input placeholder="Search exercises" value={q} onChangeText={setQ} autoFocus />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Chip label="All" active={muscle === null} onPress={() => setMuscle(null)} />
          {MUSCLES.map((m) => (
            <Chip key={m} label={m} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </ScrollView>
        {q.trim().length > 1 && !exactMatch && (
          <Button
            small
            variant="secondary"
            title={`+ Create "${q.trim()}" (${muscle ?? 'other'})`}
            onPress={createCustom}
          />
        )}
      </View>
      <FlatList
        style={{ paddingHorizontal: 16 }}
        data={results}
        keyExtractor={(e) => String(e.id)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const on = selected.some((s) => s.id === item.id);
          return (
            <ListItem
              title={item.name}
              subtitle={`${item.primaryMuscle} · ${item.equipment}${item.isCustom ? ' · custom' : ''}`}
              onPress={() => toggle(item)}
              right={<T color={on ? c.primary : c.muted} style={{ fontSize: 20 }}>{on ? '●' : '○'}</T>}
            />
          );
        }}
      />
      <Row style={{ padding: 16, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
        <Button
          style={{ flex: 1 }}
          title={selected.length ? `Add ${selected.length} exercise${selected.length > 1 ? 's' : ''}` : 'Select exercises'}
          disabled={selected.length === 0}
          onPress={() => confirm(selected)}
        />
      </Row>
    </View>
  );
}
