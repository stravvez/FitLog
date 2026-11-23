import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { Button, Chip, Empty, Input, ListItem, Row, T } from '@/src/components/ui';
import { Food, Meal, MEAL_LABELS, recentFoods, searchLocalFoods, upsertFood } from '@/src/db/queries';
import { r0 } from '@/src/lib/format';
import { FoodInput, searchFoods } from '@/src/lib/off';
import { useDb } from '@/src/store/version';
import { useColors } from '@/src/theme';

type ResultRow = { key: string; food: FoodInput; id?: number; local: boolean };

export default function AddFood() {
  const c = useColors();
  const { meal, date } = useLocalSearchParams<{ meal: Meal; date: string }>();
  const [q, setQ] = useState('');
  const [online, setOnline] = useState<FoodInput[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'recent' | 'search'>('recent');

  const local = useDb(() => (q.trim() ? searchLocalFoods(q) : []));
  const recent = useDb(() => recentFoods());

  const runSearch = async () => {
    if (q.trim().length < 2) return;
    setTab('search');
    setLoading(true);
    setError(null);
    try {
      setOnline(await searchFoods(q));
    } catch (e) {
      setOnline([]);
      setError(e instanceof Error && e.name === 'AbortError' ? 'Search timed out.' : 'Could not reach Open Food Facts. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const pick = (r: ResultRow) => {
    const foodId = r.id ?? upsertFood(r.food);
    router.push({ pathname: '/food/amount', params: { foodId: String(foodId), meal, date } });
  };

  const toRow = (f: Food): ResultRow => ({ key: `l${f.id}`, food: f, id: f.id, local: true });
  const localBarcodes = new Set(local.map((f) => f.barcode).filter(Boolean));
  const rows: ResultRow[] =
    tab === 'recent' && !q.trim()
      ? recent.map(toRow)
      : [
          ...local.map(toRow),
          ...(online ?? [])
            .filter((f) => !f.barcode || !localBarcodes.has(f.barcode))
            .map((f, i) => ({ key: `o${i}-${f.barcode ?? f.name}`, food: f, local: false })),
        ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: `Add to ${MEAL_LABELS[meal] ?? 'meal'}` }} />
      <View style={{ padding: 16, gap: 10 }}>
        <Row>
          <Input
            style={{ flex: 1 }}
            placeholder="Search foods (e.g. oats, paneer, Amul)"
            value={q}
            onChangeText={(t) => {
              setQ(t);
              setOnline(null);
              if (t.trim()) setTab('search');
            }}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
          <Button title="Search" onPress={runSearch} disabled={q.trim().length < 2} />
        </Row>
        <Row>
          <Button
            small
            variant="secondary"
            title="📷 Scan barcode"
            onPress={() => router.push({ pathname: '/food/scan', params: { meal, date } })}
          />
          <Button
            small
            variant="secondary"
            title="✏️ Custom food"
            onPress={() => router.push({ pathname: '/food/custom', params: { meal, date } })}
          />
        </Row>
        <Row>
          <Chip label="Recent" active={tab === 'recent' && !q.trim()} onPress={() => { setQ(''); setTab('recent'); }} />
          <Chip label="Search results" active={tab === 'search' || !!q.trim()} onPress={() => setTab('search')} />
        </Row>
        {loading && <ActivityIndicator />}
        {error && <T color={c.danger}>{error}</T>}
        {q.trim() && online === null && !loading ? (
          <T v="small">Showing saved foods. Press Search to look up Open Food Facts.</T>
        ) : null}
      </View>
      <FlatList
        style={{ paddingHorizontal: 16 }}
        data={rows}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? undefined : (
            <Empty
              text={
                tab === 'recent' && !q.trim()
                  ? 'Foods you log will appear here for quick re-adding.'
                  : online
                    ? 'No results. Try another name, scan the barcode, or create a custom food.'
                    : 'Type a food name and press Search.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.food.name}
            subtitle={`${item.food.brand ? `${item.food.brand} · ` : ''}per 100 g: P ${r0(item.food.protein)} · C ${r0(
              item.food.carbs,
            )} · F ${r0(item.food.fat)}${item.local ? ' · saved' : ''}`}
            right={<T muted>{r0(item.food.kcal)} kcal</T>}
            onPress={() => pick(item)}
          />
        )}
      />
    </View>
  );
}
