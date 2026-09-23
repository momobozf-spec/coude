import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { BarcodeLookupDto } from '@superrette/validation';
import { Button, Card, EmptyState, IconButton, palette, Text } from '@superrette/ui';
import { Screen } from '../components/Screen';
import { useI18n } from '../state/i18n';
import { useApi } from '../state/session';

/**
 * Scan → EAN lookup → canonical product → compare prices.
 * Unknown barcodes are never turned into invented products.
 */
export default function Scan(): ReactNode {
  const api = useApi();
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<BarcodeLookupDto | null>(null);
  const busy = useRef(false);

  const onScanned = async (scan: BarcodeScanningResult): Promise<void> => {
    if (busy.current || result) return;
    busy.current = true;
    try {
      const lookup = await api.barcode(scan.data);
      if (lookup.status === 'FOUND' && lookup.product) {
        router.replace(`/product/${lookup.product.variantId}`);
        return;
      }
      setResult(lookup);
    } finally {
      busy.current = false;
    }
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: palette.ink }} />;
  if (!permission.granted) {
    return (
      <Screen title={t('scanner.title')} back>
        <EmptyState icon="scan" title={t('scanner.permission')} action={<Button title={t('scanner.grant')} onPress={() => void requestPermission()} />} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.ink }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={result ? undefined : (r) => void onScanned(r)}
      />
      <View style={{ position: 'absolute', top: 56, left: 16 }}>
        <IconButton icon="close" label={t('common.close')} color={palette.paper} onPress={() => router.back()} />
      </View>
      <View style={{ position: 'absolute', bottom: 40, left: 16, right: 16 }}>
        {result ? (
          <Card>
            <Text variant="heading">{result.status === 'INVALID' ? t('scanner.invalid') : t('scanner.unknown')}</Text>
            {result.status === 'UNKNOWN' ? (
              <Text tone="muted" style={{ marginTop: 4 }}>
                {t('scanner.unknownBody', { code: result.gtin })}
              </Text>
            ) : null}
            {result.external?.name ? (
              <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
                {t('scanner.externalInfo', { name: [result.external.brand, result.external.name].filter(Boolean).join(' – ') })}
              </Text>
            ) : null}
            <Button title={t('common.retry')} style={{ marginTop: 12 }} onPress={() => setResult(null)} />
          </Card>
        ) : (
          <Text align="center" color={palette.paper}>
            {t('scanner.hint')}
          </Text>
        )}
      </View>
    </View>
  );
}
