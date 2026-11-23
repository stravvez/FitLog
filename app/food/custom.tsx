import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Chips, Input, Row, Screen, T } from '@/src/components/ui';
import { Meal, upsertFood } from '@/src/db/queries';
import { parseNum, r1 } from '@/src/lib/format';

type Basis = '100g' | 'serving';

export default function CustomFood() {
  const { meal, date, barcode } = useLocalSearchParams<{ meal: Meal; date: string; barcode?: string }>();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [serving, setServing] = useState('');
  const [basis, setBasis] = useState<Basis>('100g');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const save = () => {
    const servingG = parseNum(serving);
    if (!name.trim()) return Alert.alert('Enter a name');
    if (basis === 'serving' && (!servingG || servingG <= 0)) {
      return Alert.alert('Enter the serving size in grams', 'Needed to convert per-serving values.');
    }
    const factor = basis === 'serving' ? 100 / servingG! : 1;
    const v = (s: string) => r1((parseNum(s) ?? 0) * factor);
    const id = upsertFood({
      barcode: barcode ?? null,
      name: name.trim(),
      brand: brand.trim(),
      kcal: v(kcal),
      protein: v(protein),
      carbs: v(carbs),
      fat: v(fat),
      fiber: 0,
      servingG: servingG && servingG > 0 ? servingG : null,
      source: 'custom',
    });
    router.replace({ pathname: '/food/amount', params: { foodId: String(id), meal, date } });
  };

  return (
    <Screen footer={<Button title="Save food" onPress={save} />}>
      {barcode ? <T v="small">Barcode: {barcode}</T> : null}
      <Card>
        <Input label="Name" placeholder="e.g. Mom's dal" value={name} onChangeText={setName} />
        <Input label="Brand (optional)" value={brand} onChangeText={setBrand} />
        <Input label="Serving size in grams (optional)" keyboardType="decimal-pad" value={serving} onChangeText={setServing} />
      </Card>
      <Card>
        <T v="label">Nutrition values are per</T>
        <Chips
          options={['100g', 'serving'] as const}
          value={basis}
          onChange={setBasis}
          labels={{ '100g': '100 g', serving: '1 serving' }}
        />
        <Row>
          <Input label="Calories" keyboardType="decimal-pad" value={kcal} onChangeText={setKcal} />
          <Input label="Protein (g)" keyboardType="decimal-pad" value={protein} onChangeText={setProtein} />
        </Row>
        <Row>
          <Input label="Carbs (g)" keyboardType="decimal-pad" value={carbs} onChangeText={setCarbs} />
          <Input label="Fat (g)" keyboardType="decimal-pad" value={fat} onChangeText={setFat} />
        </Row>
      </Card>
    </Screen>
  );
}
