import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { migrate } from '@/src/db';
import { setupNotifications } from '@/src/lib/restTimer';
import { persistWorkoutDraft, useWorkout } from '@/src/store/workout';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

function init() {
  migrate();
  useWorkout.getState().hydrate();
  persistWorkoutDraft();
  setupNotifications();
  return true;
}

export default function RootLayout() {
  // Runs synchronously once, before the first screen renders.
  useState(init);
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workout/active" options={{ title: 'Workout', gestureEnabled: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
        <Stack.Screen name="exercise-picker" options={{ title: 'Add exercises', presentation: 'modal' }} />
        <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
        <Stack.Screen name="food/add" options={{ title: 'Add food' }} />
        <Stack.Screen name="food/scan" options={{ title: 'Scan barcode' }} />
        <Stack.Screen name="food/amount" options={{ title: 'Amount' }} />
        <Stack.Screen name="food/custom" options={{ title: 'Custom food' }} />
      </Stack>
    </ThemeProvider>
  );
}
