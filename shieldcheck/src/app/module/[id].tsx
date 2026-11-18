import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { CheckCard, OutcomeIcon } from '../../components/CheckCard';
import { SourceBadge } from '../../components/SourceBadge';
import { Body, Button, Card, LoadingBlock, Notice, Screen, SectionTitle, Title } from '../../components/ui';
import { DEMO_APPS } from '../../data/demoApps';
import { ownPermissionsText } from '../../scan/apps';
import type { ModuleId } from '../../scan/types';
import { useScan } from '../../state/ScanContext';

const META: Record<Exclude<ModuleId, 'scam'>, { title: string; intro: string }> = {
  system: {
    title: 'Systeem en OS',
    intro: 'Wat we over je besturingssysteem en vergrendeling konden uitlezen.',
  },
  apps: {
    title: 'App-toestemmingen en privacy',
    intro: 'Welke apps aan je gegevens kunnen, en hoe je dat zelf nakijkt.',
  },
  network: {
    title: 'Netwerk en wifi',
    intro: 'Wat we over je huidige verbinding kunnen zeggen — en wat niet.',
  },
};

function isModule(id: string | undefined): id is Exclude<ModuleId, 'scam'> {
  return id === 'system' || id === 'apps' || id === 'network';
}

export default function ModuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { report, status, startScan } = useScan();

  if (!isModule(id)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Niet gevonden' }} />
        <Card>
          <Body>Deze module bestaat niet.</Body>
        </Card>
      </Screen>
    );
  }

  const meta = META[id];
  const results = report?.results.filter((r) => r.module === id) ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ title: meta.title }} />
      <Title subtitle={meta.intro}>{meta.title}</Title>

      {!report ? (
        status === 'error' ? (
          <Card>
            <Body>Er zijn nog geen resultaten.</Body>
            <Button label="Start scan" icon="refresh" onPress={() => void startScan()} />
          </Card>
        ) : (
          <Card>
            <LoadingBlock label="Bezig met controleren…" />
          </Card>
        )
      ) : results.length === 0 ? (
        <Card>
          <Body>Geen controles in deze module.</Body>
        </Card>
      ) : (
        results.map((r) => <CheckCard key={r.id} result={r} />)
      )}

      {id === 'apps' ? (
        <>
          <SectionTitle>Voorbeeld: zo zou een app-overzicht eruitzien</SectionTitle>
          <SourceBadge source="demo" />
          <Notice tone="demo">
            Voorbeeldgegevens — geen echte toestelscan. Deze apps zijn fictief en staan niet (noodzakelijk) op jouw toestel.
          </Notice>
          {DEMO_APPS.map((app) => (
            <Card key={app.name}>
              <View className="flex-row items-center gap-3">
                <OutcomeIcon outcome={app.level === 'ok' ? 'good' : 'attention'} />
                <Text className="flex-1 text-base font-semibold text-navy-900 dark:text-navy-50">{app.name}</Text>
              </View>
              <Body muted>
                Toestemmingen: {app.permissions.length > 0 ? app.permissions.join(', ') : 'geen bijzondere'}
              </Body>
              <Body>{app.note}</Body>
            </Card>
          ))}

          <SectionTitle>En ShieldCheck zelf?</SectionTitle>
          <Card>
            <Body>{ownPermissionsText()}</Body>
            <Body muted>Dit volgt uit de configuratie van de app, niet uit een scan van je toestel.</Body>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
