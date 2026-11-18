import { Text, View } from 'react-native';

import { scoreLabel, type ScoreBreakdown } from '../scan/score';
import { Body, Card } from './ui';

const TONE = {
  good: { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  attention: { bar: 'bg-sun-400', text: 'text-sun-700 dark:text-sun-300' },
  risk: { bar: 'bg-sun-400', text: 'text-sun-800 dark:text-sun-200' },
  neutral: { bar: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300' },
} as const;

export function ScoreCard({ score }: { score: ScoreBreakdown }) {
  const shown = score.withActions;
  const { label, tone } = scoreLabel(shown);
  const t = TONE[tone];
  const delta = score.measured !== null && score.withActions !== null ? score.withActions - score.measured : 0;

  return (
    <Card>
      <Text className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-navy-200">
        Indicatieve veiligheidsscore
      </Text>
      <View
        accessible
        accessibilityLabel={shown === null ? 'Nog geen score beschikbaar' : `Score ${shown} van 100. ${label}.`}
        className="flex-row items-end gap-2"
      >
        <Text className={`text-6xl font-bold ${t.text}`}>{shown ?? '–'}</Text>
        <Text className="mb-2 text-lg text-slate-600 dark:text-navy-200">/ 100</Text>
      </View>
      <View className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800">
        <View className={`h-3 rounded-full ${t.bar}`} style={{ width: `${shown ?? 0}%` }} />
      </View>
      <Text className={`text-lg font-semibold ${t.text}`}>{label}</Text>

      {shown === null ? (
        <Body muted>Er zijn op dit toestel geen controles die meetellen. Op een iPhone of Android-toestel zie je hier een score.</Body>
      ) : (
        <>
          <Body muted>
            Deze score is een indicatie op basis van {score.countedChecks} controle{score.countedChecks === 1 ? '' : 's'} die
            echt op dit toestel {score.countedChecks === 1 ? 'is' : 'zijn'} uitgevoerd. Controles die beperkt, niet uitgevoerd of
            voorbeeldgegevens zijn, tellen niet mee.
          </Body>
          <View className="rounded-xl bg-navy-50 p-3 dark:bg-navy-800">
            <Body>Gemeten op toestel: {score.measured}</Body>
            <Body>
              Zelf afgevinkte acties: {delta > 0 ? `+${delta}` : '0'}
            </Body>
            {delta > 0 ? (
              <Body muted>
                Afgevinkte acties tellen mee op basis van jouw bevestiging. ShieldCheck past niets aan op je toestel. Scan opnieuw om
                te zien of de meting is veranderd.
              </Body>
            ) : null}
          </View>
        </>
      )}
    </Card>
  );
}
