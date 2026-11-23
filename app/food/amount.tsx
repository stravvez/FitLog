import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Chips, Empty, Input, Row, Screen, Stat, T } from '@/src/components/ui';
import {
  addFoodLog,
  deleteFoodLog,
  getFood,
  getFoodLog,
  Meal,
  MEAL_LABELS,
  MEALS,
  updateFoodLog,
} from '@/src/db/queries';
import { dateStr, parseNum, r0, r1 } from '@/src/lib/format';
import { macrosFor } from '@/src/lib/nutrition';
import { useColors } from '@/src/theme';

function defaultMeal(): Meal {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export default function FoodAmount() {
  const c = useColors();
  const params = useLocalSearchParams<{ foodId?: string; logId?: string; meal?: Meal; date?: string }>();
  // Read once on mount so edits in this screen aren't overwritten by re-renders.
  const [initial] = useState(() => {
    const log = params.logId ? getFoodLog(Number(params.logId)) : null;
    const food = getFood(log ? log.foodId : Number(params.foodId));
    return { log, food };
  });
  const { log, food } = initial;
  const [grams, setGrams] = useState(() =>
    String(log ? r1(log.grams) : (food?.servingG ?? 100)),
  );
  const [meal, setMeal] = useState<Meal>(log?.meal ?? params.meal ?? defaultMeal());

  if (!food) return <Empty text="Food not found." />;

  const g = parseNum(grams) ?? 0;
  const m = macrosFor(food, g);

  const save = () => {
    if (g <= 0) return Alert.alert('Enter an amount in grams');
    if (log) updateFoodLog(log.id, meal, g);
    else addFoodLog(params.date ?? dateStr(), meal, food.id, g);
    router.dismissTo('/(tabs)/food');
  };

  const remove = () => {
    if (!log) return;
    deleteFoodLog(log.id);
    router.back();
  };

  const servings = food.servingG ? [0.5, 1, 1.5, 2] : [];

  return (
    <>
      <Stack.Screen options={{ title: log ? 'Edit entry' : 'Add food' }} />
      <Screen footer={<Button title={log ? 'Save changes' : `Add to ${MEAL_LABELS[meal]}`} onPress={save} />}>
        <Card>
          <T v="h2">{food.name}</T>
          {food.brand ? <T muted>{food.brand}</T> : null}
          <T v="small">
            Per 100 g: {r0(food.kcal)} kcal · P {r1(food.protein)} · C {r1(food.carbs)} · F {r1(food.fat)}
          </T>
        </Card>

        <Card>
          <Input label="Amount (grams)" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} selectTextOnFocus />
          <Row style={{ flexWrap: 'wrap' }}>
            {servings.map((s) => (
              <Button
                key={s}
                small
                variant="secondary"
                title={`${s} serving${s === 1 ? '' : 's'} (${r0(s * food.servingG!)} g)`}
                onPress={() => setGrams(String(r1(s * food.servingG!)))}
              />
            ))}
            {[50, 100, 200].map((n) => (
              <Button key={n} small variant="secondary" title={`${n} g`} onPress={() => setGrams(String(n))} />
            ))}
          </Row>
        </Card>

        <Card>
          <T v="label">Meal</T>
          <Chips options={MEALS} value={meal} onChange={setMeal} labels={MEAL_LABELS} />
        </Card>

        <Card>
          <Row>
            <Stat label="Calories" value={`${r0(m.kcal)}`} />
            <Stat label="Protein" value={`${r1(m.protein)} g`} />
            <Stat label="Carbs" value={`${r1(m.carbs)} g`} />
            <Stat label="Fat" value={`${r1(m.fat)} g`} />
          </Row>
        </Card>

        {log && (
          <Button
            title="Remove entry"
            variant="danger"
            onPress={() =>
              Alert.alert('Remove entry?', food.name, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: remove },
              ])
            }
          />
        )}
        <T v="small" color={c.muted}>
          {food.source === 'off' ? 'Nutrition data from Open Food Facts (ODbL).' : 'Custom food.'}
        </T>
      </Screen>
    </>
  );
}
