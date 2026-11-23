import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColors } from '@/src/theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function icon(name: SymbolName) {
  // eslint-disable-next-line react/display-name
  return ({ color }: { color: unknown }) => <SymbolView name={name} tintColor={color as string} size={26} />;
}

export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: icon({ ios: 'house.fill', android: 'home', web: 'home' }) }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: icon({ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food',
          tabBarIcon: icon({ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: icon({ ios: 'chart.line.uptrend.xyaxis', android: 'show_chart', web: 'show_chart' }),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: icon({ ios: 'person.crop.circle', android: 'person', web: 'person' }),
        }}
      />
    </Tabs>
  );
}
