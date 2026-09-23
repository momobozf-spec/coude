import type { ReactNode } from 'react';
import type { Locale } from '@superrette/domain';
import { Card, Divider, ListRow, Icon } from '@superrette/ui';
import { Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi, useSession } from '../../state/session';

const LANGUAGES: [Locale, string][] = [
  ['nl', 'Nederlands'],
  ['fr', 'Français'],
  ['en', 'English'],
];

export default function LanguageSettings(): ReactNode {
  const { t, locale, setLocale } = useI18n();
  const api = useApi();
  const { refreshUser } = useSession();
  return (
    <Screen title={t('profile.language')} back>
      <Card>
        {LANGUAGES.map(([code, name], i) => (
          <ListRowWithDivider key={code} first={i === 0}>
            <ListRow
              title={name}
              right={code === locale ? <Icon name="check" size={18} /> : <></>}
              onPress={async () => {
                setLocale(code);
                await api.updateMe({ locale: code });
                await refreshUser();
              }}
            />
          </ListRowWithDivider>
        ))}
      </Card>
    </Screen>
  );
}

function ListRowWithDivider({ first, children }: { first: boolean; children: ReactNode }): ReactNode {
  return (
    <>
      {first ? null : <Divider />}
      {children}
    </>
  );
}
