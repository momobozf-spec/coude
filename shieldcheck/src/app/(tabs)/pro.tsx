import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Card, Notice, Screen, SectionTitle, Title, type IconName } from '../../components/ui';
import { useColors } from '../../theme/colors';

const PROPOSED: { icon: IconName; title: string; body: string }[] = [
  { icon: 'time-outline', title: 'Achtergrondscans', body: 'Periodiek je instellingen nakijken en je verwittigen als er iets verandert.' },
  { icon: 'chatbubbles-outline', title: 'Realtime sms- of linkbescherming', body: 'Verdachte berichten herkennen op het moment dat ze binnenkomen, waar het platform dat toelaat.' },
  { icon: 'mail-outline', title: 'Monitoring van maximaal vijf e-mailadressen', body: 'Een melding wanneer een van je adressen in een nieuw datalek opduikt — alleen na expliciete toestemming.' },
  { icon: 'globe-outline', title: 'VPN', body: 'Een versleutelde verbinding voor openbare wifi.' },
];

export default function ProScreen() {
  const colors = useColors();
  const [infoShown, setInfoShown] = useState(false);

  return (
    <Screen>
      <Title subtitle="Een vooruitblik op wat ShieldCheck later zou kunnen bieden.">ShieldCheck Pro</Title>

      <Notice tone="demo">
        Deze functies zijn voorgesteld en nog niet gebouwd. ShieldCheck biedt vandaag geen VPN, geen achtergrondmonitoring en geen
        realtime bescherming.
      </Notice>

      <View className="flex-row gap-3">
        <Card className="flex-1">
          <Text className="text-sm font-semibold text-slate-600 dark:text-navy-200">Maandelijks</Text>
          <Text className="text-2xl font-bold text-navy-900 dark:text-navy-50">€ 3,99</Text>
          <Text className="text-sm text-slate-600 dark:text-navy-200">per maand</Text>
        </Card>
        <Card className="flex-1 border-emerald-300 dark:border-emerald-700">
          <Text className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Jaarlijks</Text>
          <Text className="text-2xl font-bold text-navy-900 dark:text-navy-50">€ 29,99</Text>
          <Text className="text-sm text-slate-600 dark:text-navy-200">per jaar (≈ € 2,50/maand)</Text>
        </Card>
      </View>
      <Body muted>Prijzen incl. btw, indicatief. Er is nog geen betaling of abonnement mogelijk.</Body>

      <SectionTitle>Voorgestelde Pro-functies</SectionTitle>
      {PROPOSED.map((f) => (
        <Card key={f.title}>
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-navy-50 dark:bg-navy-800">
              <Ionicons name={f.icon} size={22} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-navy-900 dark:text-navy-50">{f.title}</Text>
              <Text className="text-sm font-medium text-sun-800 dark:text-sun-200">Voorgesteld — binnenkort beschikbaar</Text>
            </View>
          </View>
          <Body muted>{f.body}</Body>
        </Card>
      ))}

      <Button label="Binnenkort beschikbaar" icon="hourglass-outline" onPress={() => setInfoShown(true)} />
      {infoShown ? (
        <Notice>
          Pro is nog in ontwikkeling. Er wordt niets aangerekend en er worden geen gegevens van je verzameld. Blijf de gratis check
          gebruiken; we tonen hier wanneer Pro beschikbaar wordt.
        </Notice>
      ) : null}
    </Screen>
  );
}
