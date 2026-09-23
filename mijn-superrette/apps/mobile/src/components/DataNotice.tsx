import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { DataOrigin } from '@superrette/domain';
import { SampleDataBanner, Text } from '@superrette/ui';
import { useI18n } from '../state/i18n';

/**
 * Honest labelling of where prices come from. Sample (development) data gets
 * a prominent banner; crowdsourced prices are named as such.
 */
export function DataNotice({ origins }: { origins: readonly (DataOrigin | null | undefined)[] }): ReactNode {
  const { t } = useI18n();
  const set = new Set(origins.filter(Boolean));
  if (set.size === 0) return null;
  return (
    <View style={{ gap: 6, marginBottom: 12 }}>
      {set.has('DEVELOPMENT_SEED') ? <SampleDataBanner label={t('dataOrigin.sampleBanner')} /> : null}
      {set.has('CROWDSOURCED') ? (
        <Text variant="caption" tone="muted">
          {t('dataOrigin.CROWDSOURCED')}
        </Text>
      ) : null}
    </View>
  );
}
