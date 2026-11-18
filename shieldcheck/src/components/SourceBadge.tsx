import { Ionicons } from '@expo/vector-icons';
import { Platform, Text, View } from 'react-native';

import type { Source } from '../scan/types';
import { useColors } from '../theme/colors';
import type { IconName } from './ui';

function platformName() {
  return Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'het platform';
}

export function sourceLabel(source: Source): string {
  switch (source) {
    case 'verified':
      return 'Echt gecontroleerd op dit toestel';
    case 'limited':
      return `Beperkt beschikbaar door ${platformName()}`;
    case 'demo':
      return 'Voorbeeldgegevens — geen echte toestelscan';
    case 'heuristic':
      return 'Lokale inschatting — geen garantie';
    case 'unchecked':
      return 'Niet gecontroleerd';
  }
}

const STYLE: Record<Source, { box: string; text: string; icon: IconName }> = {
  verified: {
    box: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/40 dark:border-emerald-800',
    text: 'text-emerald-800 dark:text-emerald-300',
    icon: 'checkmark-done',
  },
  limited: {
    box: 'bg-navy-50 border-navy-100 dark:bg-navy-800 dark:border-navy-700',
    text: 'text-navy-700 dark:text-navy-100',
    icon: 'lock-closed-outline',
  },
  demo: {
    box: 'bg-sun-50 border-sun-200 dark:bg-sun-900/40 dark:border-sun-800',
    text: 'text-sun-800 dark:text-sun-200',
    icon: 'flask-outline',
  },
  heuristic: {
    box: 'bg-navy-50 border-navy-100 dark:bg-navy-800 dark:border-navy-700',
    text: 'text-navy-700 dark:text-navy-100',
    icon: 'analytics-outline',
  },
  unchecked: {
    box: 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-200',
    icon: 'remove-circle-outline',
  },
};

export function SourceBadge({ source }: { source: Source }) {
  const colors = useColors();
  const s = STYLE[source];
  const iconColor =
    source === 'verified' ? colors.good : source === 'demo' ? colors.attention : source === 'unchecked' ? colors.neutral : colors.primary;
  return (
    <View
      accessible
      accessibilityLabel={`Bron: ${sourceLabel(source)}`}
      className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${s.box}`}
    >
      <Ionicons name={s.icon} size={14} color={iconColor} />
      <Text className={`text-sm font-medium ${s.text}`}>{sourceLabel(source)}</Text>
    </View>
  );
}
