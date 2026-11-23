import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Button, Screen, T } from '@/src/components/ui';
import { getFoodByBarcode, Meal, upsertFood } from '@/src/db/queries';
import { fetchByBarcode } from '@/src/lib/off';

export default function ScanBarcode() {
  const { meal, date } = useLocalSearchParams<{ meal: Meal; date: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  if (!permission) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!permission.granted) {
    return (
      <Screen>
        <T>FitLog needs camera access to scan food barcodes.</T>
        <Button title="Allow camera" onPress={requestPermission} />
      </Screen>
    );
  }

  const goToAmount = (foodId: number) =>
    router.replace({ pathname: '/food/amount', params: { foodId: String(foodId), meal, date } });

  const onScanned = async ({ data }: { data: string }) => {
    if (handled.current) return;
    handled.current = true;
    const local = getFoodByBarcode(data);
    if (local) return goToAmount(local.id);
    setBusy(true);
    try {
      const food = await fetchByBarcode(data);
      if (food) return goToAmount(upsertFood(food));
      Alert.alert('Not found', `No nutrition data for barcode ${data}. Add it as a custom food?`, [
        { text: 'Scan again', onPress: () => (handled.current = false) },
        {
          text: 'Create food',
          onPress: () => router.replace({ pathname: '/food/custom', params: { meal, date, barcode: data } }),
        },
      ]);
    } catch {
      Alert.alert('Lookup failed', 'Could not reach Open Food Facts. Check your connection.', [
        { text: 'Try again', onPress: () => (handled.current = false) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={busy ? undefined : onScanned}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={styles.hint}>
        {busy ? <ActivityIndicator color="#fff" /> : <T color="#fff">Point the camera at a food barcode</T>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '35%',
    height: 160,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
  },
  hint: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
});
