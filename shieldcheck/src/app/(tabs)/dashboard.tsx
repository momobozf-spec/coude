import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { OutcomeIcon } from '../../components/CheckCard';
import { ScoreCard } from '../../components/ScoreCard';
import { SourceBadge } from '../../components/SourceBadge';
import { Body, Button, Card, LoadingBlock, Notice, Screen, SectionTitle, Title, type IconName } from '../../components/ui';
import type { CheckResult, ModuleId, Outcome } from '../../scan/types';
import { useScan } from '../../state/ScanContext';
import { useColors } from '../../theme/colors';

const MODULES: { id: ModuleId; letter: string; title: string; icon: IconName; href: Href }[] = [
  { id: 'system', letter: 'A', title: 'Systeem en OS', icon: 'phone-portrait-outline', href: '/module/system' },
  { id: 'apps', letter: 'B', title: 'App-toestemmingen en privacy', icon: 'apps-outline', href: '/module/apps' },
  { id: 'network', letter: 'C', title: 'Netwerk en wifi', icon: 'wifi-outline', href: '/module/network' },
  { id: 'scam', letter: 'D', title: 'Datalek- en anti-scamcheck', icon: 'mail-unread-outline', href: '/check' },
];

function worstOutcome(results: CheckResult[]): Outcome {
  const order: Outcome[] = ['risk', 'attention', 'good', 'info', 'unknown'];
  for (const o of order) if (results.some((r) => r.outcome === o)) return o;
  return 'unknown';
}

function moduleSummary(id: ModuleId, results: CheckResult[]): string {
  if (id === 'scam') return 'Plak een link of bericht voor een lokale inschatting. Datalekcheck is een demo.';
  const verified = results.filter((r) => r.source === 'verified').length;
  const notAvailable = results.length - verified;
  const parts = [];
  if (verified > 0) parts.push(`${verified} echt gecontroleerd`);
  if (notAvailable > 0) parts.push(`${notAvailable} beperkt of niet gecontroleerd`);
  if (id === 'apps') parts.push('voorbeeldgegevens');
  return parts.join(' · ');
}

export default function Dashboard() {
  const { status, report, error, startScan, score } = useScan();
  const colors = useColors();
  const scanning = status === 'scanning';

  return (
    <Screen>
      <Title subtitle="Een rustig overzicht van wat we op dit toestel konden nagaan.">ShieldCheck</Title>

      {status === 'error' ? (
        <Card>
          <Body>De scan kon niet worden afgerond.</Body>
          {error ? <Body muted>Technische melding: {error}</Body> : null}
          <Button label="Probeer opnieuw" icon="refresh" onPress={() => void startScan()} />
        </Card>
      ) : !report ? (
        <Card>
          <LoadingBlock label="Je toestel wordt gecontroleerd…" />
        </Card>
      ) : (
        <>
          <ScoreCard score={score} />
          <Button
            label={scanning ? 'Bezig met scannen…' : 'Scan opnieuw'}
            icon="refresh"
            variant="secondary"
            loading={scanning}
            onPress={() => void startScan()}
          />
          <Text className="text-center text-sm text-slate-600 dark:text-navy-200">
            Laatste scan: {new Date(report.finishedAt).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </>
      )}

      <SectionTitle>Scanmodules</SectionTitle>
      {MODULES.map((m) => {
        const results = report?.results.filter((r) => r.module === m.id) ?? [];
        const outcome = m.id === 'scam' ? 'info' : worstOutcome(results);
        return (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`${m.letter}. ${m.title}. Open details.`}
            onPress={() => router.push(m.href)}
            className="active:opacity-80"
          >
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-navy-50 dark:bg-navy-800">
                  <Ionicons name={m.icon} size={22} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-600 dark:text-navy-200">Module {m.letter}</Text>
                  <Text className="text-base font-semibold text-navy-900 dark:text-navy-50">{m.title}</Text>
                </View>
                {report || m.id === 'scam' ? <OutcomeIcon outcome={outcome} /> : null}
                <Ionicons name="chevron-forward" size={20} color={colors.neutral} />
              </View>
              {report || m.id === 'scam' ? <Body muted>{moduleSummary(m.id, results)}</Body> : null}
            </Card>
          </Pressable>
        );
      })}

      <SectionTitle>Wat betekenen de labels?</SectionTitle>
      <Card>
        <SourceBadge source="verified" />
        <Body muted>Uitgelezen via een ondersteunde systeem-API. Alleen deze controles tellen mee in de score.</Body>
        <SourceBadge source="limited" />
        <Body muted>iOS of Android geeft deze informatie niet (betrouwbaar) aan apps. Je krijgt uitleg om het zelf na te kijken.</Body>
        <SourceBadge source="demo" />
        <Body muted>Fictieve gegevens om te tonen hoe een functie eruit zou zien.</Body>
        <SourceBadge source="heuristic" />
        <Body muted>Een inschatting op basis van herkenbare signalen. Geen garantie.</Body>
        <SourceBadge source="unchecked" />
        <Body muted>We tonen geen resultaat, omdat we het niet betrouwbaar konden vaststellen.</Body>
      </Card>

      <Notice>
        ShieldCheck is een prototype: geen antivirus, geen VPN, geen achtergrond- of realtime bescherming en geen echte
        datalekmonitoring.
      </Notice>
    </Screen>
  );
}
