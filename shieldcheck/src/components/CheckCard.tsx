import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { canOpenSettings, openSettings, settingsButtonLabel } from '../scan/settings';
import type { CheckResult, Outcome } from '../scan/types';
import { useColors } from '../theme/colors';
import { SourceBadge } from './SourceBadge';
import { Body, Button, Card, type IconName } from './ui';

export function OutcomeIcon({ outcome, size = 24 }: { outcome: Outcome; size?: number }) {
  const colors = useColors();
  const map: Record<Outcome, { icon: IconName; color: string; label: string }> = {
    good: { icon: 'checkmark-circle', color: colors.good, label: 'In orde' },
    attention: { icon: 'alert-circle', color: colors.attention, label: 'Aandachtspunt' },
    risk: { icon: 'alert-circle', color: colors.attention, label: 'Actie aanbevolen' },
    info: { icon: 'information-circle', color: colors.primary, label: 'Informatie' },
    unknown: { icon: 'help-circle-outline', color: colors.neutral, label: 'Geen uitspraak' },
  };
  const m = map[outcome];
  return <Ionicons name={m.icon} size={size} color={m.color} accessibilityLabel={m.label} />;
}

export function outcomeText(outcome: Outcome): string {
  return {
    good: 'In orde',
    attention: 'Aandachtspunt',
    risk: 'Actie aanbevolen',
    info: 'Informatie',
    unknown: 'Geen uitspraak',
  }[outcome];
}

export function CheckCard({ result }: { result: CheckResult }) {
  const [open, setOpen] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const colors = useColors();
  const showButton = result.settings && canOpenSettings(result.settings);

  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <OutcomeIcon outcome={result.outcome} />
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-navy-900 dark:text-navy-50">{result.title}</Text>
          <Text className="text-sm font-medium text-slate-600 dark:text-navy-200">{outcomeText(result.outcome)}</Text>
        </View>
      </View>
      <SourceBadge source={result.source} />
      <Body>{result.summary}</Body>

      {result.detail ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? 'Verberg uitleg' : 'Hoe is dit bepaald?'}
          onPress={() => setOpen((v) => !v)}
          className="min-h-11 flex-row items-center gap-1"
        >
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
          <Text className="text-base font-medium text-navy-600 dark:text-navy-300">
            {open ? 'Verberg uitleg' : 'Hoe is dit bepaald?'}
          </Text>
        </Pressable>
      ) : null}
      {open && result.detail ? <Body muted>{result.detail}</Body> : null}

      {result.manualSteps && (result.outcome !== 'good' || !showButton) ? (
        <View className="rounded-xl bg-navy-50 p-3 dark:bg-navy-800">
          <Text className="text-sm font-semibold text-navy-700 dark:text-navy-100">Zelf nakijken</Text>
          <Body>{result.manualSteps}</Body>
        </View>
      ) : null}

      {showButton && result.settings ? (
        <Button
          variant="secondary"
          icon="settings-outline"
          label={settingsButtonLabel(result.settings)}
          onPress={async () => {
            const ok = await openSettings(result.settings!);
            setOpenFailed(!ok);
          }}
        />
      ) : null}
      {openFailed ? <Body muted>De instellingen konden niet automatisch geopend worden. Volg de stappen hierboven.</Body> : null}
    </Card>
  );
}
