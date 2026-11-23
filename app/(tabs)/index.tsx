import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Ring } from '@/src/components/charts';
import { Button, Card, Input, MacroBar, ProgressBar, Row, Screen, Stat, T } from '@/src/components/ui';
import {
  addWater,
  dailyTotals,
  getSettings,
  latestWeight,
  setBodyWeight,
  targetsFor,
  waterOn,
  weightOn,
  workoutsOnDate,
} from '@/src/db/queries';
import { duration, fromDisplayWeight, parseNum, prettyDate, r0, toDisplayWeight } from '@/src/lib/format';
import { useToday } from '@/src/lib/useToday';
import { useDb, useNow } from '@/src/store/version';
import { useWorkout } from '@/src/store/workout';
import { useColors } from '@/src/theme';

export default function TodayScreen() {
  const c = useColors();
  const today = useToday();
  const draft = useWorkout((s) => s.draft);
  const now = useNow(30000);
  const settings = useDb(getSettings);
  const totals = useDb(() => dailyTotals(today));
  const workouts = useDb(() => workoutsOnDate(today));
  const { targets, isTrainingDay, bonus } = useDb(() => targetsFor(today, !!draft));
  const water = useDb(() => waterOn(today));
  const todaysWeight = useDb(() => weightOn(today));
  const lastWeight = useDb(() => latestWeight(today));
  const [weightText, setWeightText] = useState('');

  const u = settings.units;
  const remaining = targets.kcal - totals.kcal;

  const saveWeight = () => {
    const n = parseNum(weightText);
    if (!n || n <= 0) return Alert.alert('Enter a valid weight');
    setBodyWeight(today, fromDisplayWeight(n, u));
    setWeightText('');
  };

  return (
    <Screen>
      <T v="label">{prettyDate(today)}</T>

      <Card style={{ alignItems: 'center', gap: 12 }}>
        <Ring value={totals.kcal} max={targets.kcal} color={c.kcal}>
          <T v="big">{r0(Math.abs(remaining))}</T>
          <T v="small">{remaining >= 0 ? 'kcal left' : 'kcal over'}</T>
        </Ring>
        <Row gap={16}>
          <Stat label="Eaten" value={`${r0(totals.kcal)}`} />
          <Stat label="Target" value={`${targets.kcal}`} />
        </Row>
        {isTrainingDay && bonus > 0 ? (
          <T v="small" color={c.success}>
            🏋️ Training day: +{bonus} kcal added to your target
          </T>
        ) : (
          <T v="small">Rest day: log a workout to unlock +{settings.trainingBonusKcal} kcal</T>
        )}
        <Row gap={12}>
          <MacroBar label="Protein" value={totals.protein} target={targets.protein} color={c.protein} />
          <MacroBar label="Carbs" value={totals.carbs} target={targets.carbs} color={c.carbs} />
          <MacroBar label="Fat" value={totals.fat} target={targets.fat} color={c.fat} />
        </Row>
        <Button
          title="Log food"
          variant="secondary"
          style={{ alignSelf: 'stretch' }}
          onPress={() => router.navigate('/(tabs)/food')}
        />
      </Card>

      <Card>
        <T v="h2">Workout</T>
        {draft ? (
          <>
            <T>
              {draft.name} · in progress for {duration(now - draft.startedAt)}
            </T>
            <Button title="Resume workout" onPress={() => router.push('/workout/active')} />
          </>
        ) : workouts.length > 0 ? (
          workouts.map((w) => (
            <Row key={w.id} between>
              <T style={{ flex: 1 }}>
                ✅ {w.name} · {w.exerciseCount} exercises · {w.setCount} sets
              </T>
              <Button
                small
                variant="ghost"
                title="View"
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(w.id) } })}
              />
            </Row>
          ))
        ) : (
          <>
            <T muted>No workout yet today.</T>
            <Button title="Start a workout" onPress={() => router.navigate('/(tabs)/workout')} />
          </>
        )}
      </Card>

      <Card>
        <T v="h2">Body weight</T>
        <T muted>
          {todaysWeight !== null
            ? `Today: ${toDisplayWeight(todaysWeight, u)} ${u}`
            : lastWeight !== null
              ? `Last: ${toDisplayWeight(lastWeight, u)} ${u} (not logged today)`
              : 'Log your weight to personalise your targets.'}
        </T>
        <Row>
          <Input
            style={{ flex: 1 }}
            keyboardType="decimal-pad"
            placeholder={`Weight in ${u}`}
            value={weightText}
            onChangeText={setWeightText}
            onSubmitEditing={saveWeight}
          />
          <Button title="Save" onPress={saveWeight} />
        </Row>
      </Card>

      <Card>
        <Row between>
          <T v="h2">Water</T>
          <T muted>
            {(water / 1000).toFixed(2)} / {(settings.waterGoalMl / 1000).toFixed(1)} L
          </T>
        </Row>
        <ProgressBar value={water} max={settings.waterGoalMl} color={c.fat} />
        <Row>
          <Button small variant="secondary" title="−250 ml" onPress={() => addWater(today, -250)} />
          <Button small variant="secondary" title="+250 ml" onPress={() => addWater(today, 250)} />
          <Button small variant="secondary" title="+500 ml" onPress={() => addWater(today, 500)} />
        </Row>
      </Card>
    </Screen>
  );
}
