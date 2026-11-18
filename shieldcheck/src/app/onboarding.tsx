import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Card, Notice, Screen, type IconName } from '../components/ui';
import { useScan } from '../state/ScanContext';
import { useColors } from '../theme/colors';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'phone-portrait-outline',
    title: 'Wat er op je toestel gebeurt',
    body:
      'De controles lezen enkele instellingen van je toestel uit en analyseren geplakte links of berichten op je toestel zelf. ' +
      'Deze prototypeversie bevat geen code die je scanresultaten, e-mailadres of geplakte berichten naar een server stuurt.',
  },
  {
    icon: 'git-compare-outline',
    title: 'Wat wel en niet kan op iOS en Android',
    body:
      'We lezen o.a. je systeemversie, of er een schermvergrendeling is en je type verbinding. ' +
      'Een lijst van je andere apps, de versleuteling van je wifi of de datum van je beveiligingspatch kunnen we niet (betrouwbaar) uitlezen. ' +
      'Dat zie je eerlijk bij elke controle.',
  },
  {
    icon: 'key-outline',
    title: 'Welke toestemmingen nodig zijn',
    body:
      'Geen. Je krijgt geen toestemmingsvraag. ShieldCheck vraagt geen toegang tot locatie, contacten, camera, microfoon, sms of je bestanden. ' +
      'Op Android gebruikt de app alleen standaardrechten zonder pop-up, zoals de netwerkstatus lezen.',
  },
];

export default function Onboarding() {
  const { completeOnboarding } = useScan();
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <View className="items-center gap-2 pt-6">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-navy-600 dark:bg-navy-300">
          <Ionicons name="shield-checkmark" size={36} color={colors.onPrimary} />
        </View>
        <Text accessibilityRole="header" className="text-3xl font-bold text-navy-900 dark:text-navy-50">
          ShieldCheck
        </Text>
        <Text className="text-center text-base text-slate-600 dark:text-navy-200">
          In ongeveer 30 seconden inzicht in enkele beveiligingsinstellingen van je toestel, met rustige tips om ze te verbeteren.
        </Text>
      </View>

      {POINTS.map((p) => (
        <Card key={p.title}>
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-navy-50 dark:bg-navy-800">
              <Ionicons name={p.icon} size={22} color={colors.primary} />
            </View>
            <Text className="flex-1 text-lg font-semibold text-navy-900 dark:text-navy-50">{p.title}</Text>
          </View>
          <Body muted>{p.body}</Body>
        </Card>
      ))}

      <Notice>
        Dit is een prototype. ShieldCheck is geen antivirus, geen VPN en biedt geen realtime bescherming of datalekmonitoring.
      </Notice>

      <Button
        label="Start gratis veiligheidscheck"
        icon="play"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await completeOnboarding();
          router.replace('/dashboard');
        }}
      />
    </Screen>
  );
}
