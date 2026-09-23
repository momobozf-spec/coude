import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { BarcodeLookupDto } from '@superrette/validation';
import { Button, Card, IconButton, palette, Row, Text, TextField } from '@superrette/ui';
import { Screen } from '../components/Screen';
import { isWeb } from '../lib/platform';
import { useI18n } from '../state/i18n';
import { useApi } from '../state/session';

function LookupResult({ result, onRetry }: { result: BarcodeLookupDto; onRetry: () => void }): ReactNode {
  const { t } = useI18n();
  return (
    <Card>
      <Text variant="heading">{result.status === 'INVALID' ? t('scanner.invalid') : t('scanner.unknown')}</Text>
      {result.status === 'UNKNOWN' ? (
        <Text tone="muted" style={{ marginTop: 4 }}>
          {t('scanner.unknownBody', { code: result.gtin })}
        </Text>
      ) : null}
      {result.external?.name ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
          {t('scanner.externalInfo', {
            name: [result.external.brand, result.external.name].filter(Boolean).join(' – '),
          })}
        </Text>
      ) : null}
      <Button title={t('common.retry')} style={{ marginTop: 12 }} onPress={onRetry} />
    </Card>
  );
}

/**
 * Scan → EAN lookup → canonical product → compare prices.
 * Works with the phone camera, a webcam (browser BarcodeDetector / polyfill)
 * or by typing the digits. Unknown barcodes are never turned into invented products.
 */
export default function Scan(): ReactNode {
  const api = useApi();
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<BarcodeLookupDto | null>(null);
  const [code, setCode] = useState('');
  // On a computer, start with manual entry; the webcam is opt-in.
  const [cameraOn, setCameraOn] = useState(!isWeb);
  const busy = useRef(false);

  const lookup = async (value: string): Promise<void> => {
    if (busy.current || result) return;
    busy.current = true;
    try {
      const found = await api.barcode(value.replace(/\s/g, ''));
      if (found.status === 'FOUND' && found.product) {
        router.replace(`/product/${found.product.variantId}`);
        return;
      }
      setResult(found);
    } finally {
      busy.current = false;
    }
  };

  const manual = (
    <Card style={{ gap: 10 }}>
      <Text variant="heading">{t('scanner.manualTitle')}</Text>
      <Row gap={8}>
        <View style={{ flex: 1 }}>
          <TextField
            value={code}
            onChangeText={setCode}
            placeholder={t('scanner.manualPlaceholder')}
            keyboardType="number-pad"
            inputMode="numeric"
            onSubmitEditing={() => void lookup(code)}
          />
        </View>
        <Button
          title={t('scanner.lookup')}
          disabled={code.replace(/\D/g, '').length < 8}
          onPress={() => void lookup(code)}
        />
      </Row>
      {isWeb && !cameraOn ? (
        <Text variant="caption" tone="muted">
          {t('scanner.noCamera')}
        </Text>
      ) : null}
    </Card>
  );

  const cameraAllowed = permission?.granted;
  if (!cameraOn || !cameraAllowed) {
    return (
      <Screen narrow title={t('scanner.title')} back>
        <View style={{ gap: 12 }}>
          {result ? (
            <LookupResult
              result={result}
              onRetry={() => {
                setResult(null);
                setCode('');
              }}
            />
          ) : null}
          {manual}
          {cameraOn && permission && !permission.granted ? (
            <Card style={{ gap: 8 }}>
              <Text>{t('scanner.permission')}</Text>
              <Button title={t('scanner.grant')} icon="scan" onPress={() => void requestPermission()} />
            </Card>
          ) : null}
          {!cameraOn ? (
            <Button title={t('scanner.useCamera')} icon="scan" variant="secondary" onPress={() => setCameraOn(true)} />
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.ink }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={result ? undefined : (r: BarcodeScanningResult) => void lookup(r.data)}
      />
      <View style={{ position: 'absolute', top: 56, left: 16 }}>
        <IconButton icon="close" label={t('common.close')} color={palette.paper} onPress={() => router.back()} />
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: 40,
          left: 16,
          right: 16,
          maxWidth: 560,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        {result ? (
          <LookupResult result={result} onRetry={() => setResult(null)} />
        ) : (
          <Text align="center" color={palette.paper}>
            {t('scanner.hint')}
          </Text>
        )}
      </View>
    </View>
  );
}
