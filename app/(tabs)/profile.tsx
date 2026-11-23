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
import { useColors } from '@/src/theme';

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as Activity[];

export default function ProfileTab() {
  const c = useColors();
  const [initial] = useState(getSettings);
  const [s, setS] = useState<Settings>(initial);
  const [weightText, setWeightText] = useState(() => {
    const w = latestWeight();
    return w ? String(toDisplayWeight(w, initial.units)) : '';
  });
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
  const enteredWeight = parseNum(weightText);
  const profile = {
    ...nutritionProfile(preview),
    weightKg: enteredWeight ? fromDisplayWeight(enteredWeight, s.units) : (latestWeight() ?? DEFAULT_WEIGHT_KG),
  };
  const rest = dailyTargets(profile, false);
  const train = dailyTargets(profile, true);

  const changeUnits = (u: Units) => {
    if (u === s.units) return;
    if (enteredWeight) {
      const kg = fromDisplayWeight(enteredWeight, s.units);
      setWeightText(String(toDisplayWeight(kg, u)));
    }
    set('units', u);
  };

  const onSave = () => {
    const p = preview;
    if (p.age < 13 || p.age > 100) return Alert.alert('Check your age');
    if (p.heightCm < 100 || p.heightCm > 250) return Alert.alert('Height should be in centimetres');
    if (p.fatPct < 0.15 || p.fatPct > 0.5) return Alert.alert('Fat % should be between 15 and 50');
    saveSettings(p);
    if (enteredWeight && enteredWeight > 0) {
      const kg = fromDisplayWeight(enteredWeight, p.units);
      const current = latestWeight();
      if (current === null || Math.abs(current - kg) > 0.05) setBodyWeight(dateStr(), kg);
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
          <Input label={`Weight (${s.units})`} keyboardType="decimal-pad" value={weightText} onChangeText={setWeightText} />
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
