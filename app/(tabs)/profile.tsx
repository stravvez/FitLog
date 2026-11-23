import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Chips, Input, Row, Screen, Stat, T } from '@/src/components/ui';
import {
  DEFAULT_WEIGHT_KG,
  exportAll,
  getSettings,
  latestWeight,
  nutritionProfile,
  saveSettings,
  setBodyWeight,
  Settings,
} from '@/src/db/queries';
import { dateStr, fromDisplayWeight, parseNum, r0, toDisplayWeight, Units } from '@/src/lib/format';
import { Activity, ACTIVITY_LABELS, bmr, dailyTargets, Goal, Sex, tdee } from '@/src/lib/nutrition';
import { useDb } from '@/src/store/version';
import { useColors } from '@/src/theme';

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as Activity[];

export default function ProfileTab() {
  const c = useColors();
  const [initial] = useState(getSettings);
  const [s, setS] = useState<Settings>(initial);
  // null = not edited: show the latest logged weight live (it may change on the Today tab).
  const [weightEdit, setWeightEdit] = useState<string | null>(null);
  const loggedWeight = useDb(() => latestWeight());
  const [text, setText] = useState({
    age: String(initial.age),
    height: String(initial.heightCm),
    bonus: String(initial.trainingBonusKcal),
    protein: String(initial.proteinPerKg),
    fat: String(Math.round(initial.fatPct * 100)),
    rest: String(initial.restSeconds),
    water: String(initial.waterGoalMl),
  });

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  const setT = (k: keyof typeof text) => (v: string) => setText((p) => ({ ...p, [k]: v }));

  // Live preview of the calculation with the values currently on screen.
  const preview: Settings = {
    ...s,
    age: parseNum(text.age) ?? s.age,
    heightCm: parseNum(text.height) ?? s.heightCm,
    trainingBonusKcal: parseNum(text.bonus) ?? s.trainingBonusKcal,
    proteinPerKg: parseNum(text.protein) ?? s.proteinPerKg,
    fatPct: (parseNum(text.fat) ?? s.fatPct * 100) / 100,
    restSeconds: Math.round(parseNum(text.rest) ?? s.restSeconds),
    waterGoalMl: Math.round(parseNum(text.water) ?? s.waterGoalMl),
  };
  const weightText =
    weightEdit ?? (loggedWeight !== null ? String(toDisplayWeight(loggedWeight, s.units)) : '');
  const enteredWeight = weightEdit !== null ? parseNum(weightEdit) : null;
  const profile = {
    ...nutritionProfile(preview),
    weightKg:
      enteredWeight && enteredWeight > 0
        ? fromDisplayWeight(enteredWeight, s.units)
        : (loggedWeight ?? DEFAULT_WEIGHT_KG),
  };
  const rest = dailyTargets(profile, false);
  const train = dailyTargets(profile, true);

  const changeUnits = (u: Units) => {
    if (u === s.units) return;
    if (enteredWeight) setWeightEdit(String(toDisplayWeight(fromDisplayWeight(enteredWeight, s.units), u)));
    set('units', u);
  };

  const onSave = () => {
    const p = preview;
    if (p.age < 13 || p.age > 100) return Alert.alert('Check your age');
    if (p.heightCm < 100 || p.heightCm > 250) return Alert.alert('Height should be in centimetres');
    if (p.fatPct < 0.15 || p.fatPct > 0.5) return Alert.alert('Fat % should be between 15 and 50');
    if (p.proteinPerKg < 0.8 || p.proteinPerKg > 3.5) return Alert.alert('Protein should be 0.8–3.5 g per kg');
    if (p.trainingBonusKcal < 0 || p.trainingBonusKcal > 1500) return Alert.alert('Training bonus should be 0–1500 kcal');
    if (p.restSeconds < 0 || p.restSeconds > 900) return Alert.alert('Rest timer should be 0–900 seconds');
    if (p.waterGoalMl < 500 || p.waterGoalMl > 8000) return Alert.alert('Water goal should be 500–8000 ml');
    if (weightEdit !== null && (!enteredWeight || enteredWeight <= 0)) return Alert.alert('Enter a valid weight');
    saveSettings(p);
    // Only log a weight if the user actually typed one here.
    if (weightEdit !== null && enteredWeight) {
      const kg = fromDisplayWeight(enteredWeight, p.units);
      if (loggedWeight === null || Math.abs(loggedWeight - kg) > 0.05) setBodyWeight(dateStr(), kg);
      setWeightEdit(null);
    }
    Alert.alert('Saved', 'Your targets have been updated.');
  };

  const onExport = async () => {
    try {
      const file = new File(Paths.cache, `fitlog-export-${dateStr()}.json`);
      if (file.exists) file.delete();
      file.create();
      await file.write(JSON.stringify(exportAll(), null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export FitLog data' });
      } else {
        Alert.alert('Exported', file.uri);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen footer={<Button title="Save" onPress={onSave} />}>
      <Card>
        <T v="h2">Your targets</T>
        <Row>
          <Stat label="BMR" value={`${r0(bmr(profile))}`} />
          <Stat label="TDEE" value={`${r0(tdee(profile))}`} />
          <Stat label="Rest day" value={`${rest.kcal}`} />
          <Stat label="Training" value={`${train.kcal}`} />
        </Row>
        <T v="small">
          Macros (rest day): P {rest.protein} g · C {rest.carbs} g · F {rest.fat} g. Training days add carbs.
        </T>
        <T v="small" color={c.muted}>
          BMR via Mifflin-St Jeor × activity factor, then {s.goal === 'cut' ? '−500' : s.goal === 'bulk' ? '+300' : '±0'}{' '}
          kcal for your goal.
        </T>
      </Card>

      <Card>
        <T v="label">Body</T>
        <Chips options={['male', 'female'] as Sex[]} value={s.sex} onChange={(v) => set('sex', v)} labels={{ male: 'Male', female: 'Female' }} />
        <Row>
          <Input label="Age" keyboardType="number-pad" value={text.age} onChangeText={setT('age')} />
          <Input label="Height (cm)" keyboardType="decimal-pad" value={text.height} onChangeText={setT('height')} />
          <Input label={`Weight (${s.units})`} keyboardType="decimal-pad" value={weightText} onChangeText={setWeightEdit} />
        </Row>
      </Card>

      <Card>
        <T v="label">Daily activity (outside workouts)</T>
        <Chips options={ACTIVITIES} value={s.activity} onChange={(v) => set('activity', v)} labels={ACTIVITY_LABELS} />
        <T v="label">Goal</T>
        <Chips
          options={['cut', 'maintain', 'bulk'] as Goal[]}
          value={s.goal}
          onChange={(v) => set('goal', v)}
          labels={{ cut: 'Lose fat', maintain: 'Maintain', bulk: 'Build muscle' }}
        />
      </Card>

      <Card>
        <T v="label">Nutrition settings</T>
        <Row>
          <Input label="Training day bonus (kcal)" keyboardType="number-pad" value={text.bonus} onChangeText={setT('bonus')} />
          <Input label="Protein (g per kg)" keyboardType="decimal-pad" value={text.protein} onChangeText={setT('protein')} />
        </Row>
        <Row>
          <Input label="Fat (% of kcal)" keyboardType="number-pad" value={text.fat} onChangeText={setT('fat')} />
          <Input label="Water goal (ml)" keyboardType="number-pad" value={text.water} onChangeText={setT('water')} />
        </Row>
      </Card>

      <Card>
        <T v="label">Workout settings</T>
        <Chips options={['kg', 'lb'] as Units[]} value={s.units} onChange={changeUnits} />
        <Input label="Rest timer (seconds, 0 = off)" keyboardType="number-pad" value={text.rest} onChangeText={setT('rest')} />
      </Card>

      <Card>
        <T v="label">Data</T>
        <T v="small">Everything is stored only on this phone. Export a backup as JSON:</T>
        <Button variant="secondary" title="Export data" onPress={onExport} />
      </Card>
    </Screen>
  );
}
