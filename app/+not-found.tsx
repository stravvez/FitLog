import { router, Stack } from 'expo-router';

import { Button, Screen, T } from '@/src/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <Screen>
        <T v="h2">This screen doesn&apos;t exist.</T>
        <Button title="Go to Today" onPress={() => router.replace('/')} />
      </Screen>
    </>
  );
}
