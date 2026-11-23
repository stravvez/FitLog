import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, ListItem, MacroBar, Row, Screen, Stat, T } from '@/src/components/ui';
import {
  dailyTotals,
  deleteFoodLog,
  logsForDate,
  MEAL_LABELS,
  MEALS,
  targetsFor,
} from '@/src/db/queries';
import { addDays, prettyDate, r0 } from '@/src/lib/format';
import { sumMacros } from '@/src/lib/nutrition';
import { useToday } from '@/src/lib/useToday';
import { useDb } from '@/src/store/version';
import { useWorkout } from '@/src/store/workout';
import { useColors } from '@/src/theme';

export default function FoodTab() {
  const c = useColors();
  const today = useToday();
  // null = follow today (so the tab rolls over at midnight); a string = a day the user picked.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const isToday = date === today;
  const setDate = (d: string) => setPicked(d === today ? null : d);
  const hasDraft = useWorkout((s) => !!s.draft);
  const logs = useDb(() => logsForDate(date));
  const totals = useDb(() => dailyTotals(date));
  const { targets, isTrainingDay } = useDb(() => targetsFor(date, isToday && hasDraft));

  const confirmDelete = (id: number, name: string) =>
    Alert.alert('Remove entry?', name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteFoodLog(id) },
    ]);

  return (
    <Screen>
      <Row between>
        <Button small variant="ghost" title="‹ Prev" onPress={() => setDate(addDays(date, -1))} />
        <T v="h2">{prettyDate(date)}</T>
        <Button small variant="ghost" title="Next ›" onPress={() => setDate(addDays(date, 1))} />
      </Row>

      <Card>
        <Row>
          <Stat label="Target" value={`${targets.kcal}`} />
          <Stat label="Eaten" value={`${r0(totals.kcal)}`} />
          <Stat label="Remaining" value={`${r0(targets.kcal - totals.kcal)}`} />
        </Row>
        {isTrainingDay && (
          <T v="small" color={c.success}>
            Training day target
          </T>
        )}
        <Row gap={12}>
          <MacroBar label="Protein" value={totals.protein} target={targets.protein} color={c.protein} />
          <MacroBar label="Carbs" value={totals.carbs} target={targets.carbs} color={c.carbs} />
          <MacroBar label="Fat" value={totals.fat} target={targets.fat} color={c.fat} />
        </Row>
      </Card>

      {MEALS.map((meal) => {
        const items = logs.filter((l) => l.meal === meal);
        const t = sumMacros(items);
        return (
          <Card key={meal}>
            <Row between>
              <T v="h2">{MEAL_LABELS[meal]}</T>
              <T muted>{r0(t.kcal)} kcal</T>
            </Row>
            {items.map((l) => (
              <ListItem
                key={l.id}
                title={l.name}
                subtitle={`${r0(l.grams)} g · P ${r0(l.protein)} · C ${r0(l.carbs)} · F ${r0(l.fat)}${
                  l.brand ? ` · ${l.brand}` : ''
                }`}
                right={<T>{r0(l.kcal)}</T>}
                onPress={() => router.push({ pathname: '/food/amount', params: { logId: String(l.id) } })}
                onLongPress={() => confirmDelete(l.id, l.name)}
              />
            ))}
            <Button
              small
              variant="secondary"
              title="+ Add food"
              onPress={() => router.push({ pathname: '/food/add', params: { meal, date } })}
            />
          </Card>
        );
      })}
      <T v="small" style={{ textAlign: 'center' }}>
        Tap an entry to edit it, long-press to remove.
      </T>
    </Screen>
  );
}
