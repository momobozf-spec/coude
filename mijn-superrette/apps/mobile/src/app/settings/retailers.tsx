import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { RetailerPicker } from '../../components/RetailerPicker';
import { Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useSession } from '../../state/session';

export default function RetailerSettings(): ReactNode {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  return (
    <Screen narrow title={t('profile.retailers')} back>
      <RetailerPicker
        country={user?.countryCode ?? 'BE'}
        cta={t('common.save')}
        onSaved={() => {
          void qc.invalidateQueries();
          router.back();
        }}
      />
    </Screen>
  );
}
