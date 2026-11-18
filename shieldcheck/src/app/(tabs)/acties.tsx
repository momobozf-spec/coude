import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Card, LoadingBlock, Notice, Screen, SectionTitle, Title } from '../../components/ui';
import type { ActionItem } from '../../scan/actions';
import { canOpenSettings, openSettings, settingsButtonLabel } from '../../scan/settings';
import { useScan } from '../../state/ScanContext';
import { useColors } from '../../theme/colors';

function ActionCard({ action, done, onToggle }: { action: ActionItem; done: boolean; onToggle: () => void }) {
  const colors = useColors();
  const [openFailed, setOpenFailed] = useState(false);
  const showButton = action.settings && canOpenSettings(action.settings);

  return (
    <Card className={done ? 'opacity-90' : ''}>
      <View className="flex-row items-center gap-2">
        <View
          className={`rounded-full px-2.5 py-1 ${action.kind === 'finding' ? 'bg-sun-100 dark:bg-sun-900/50' : 'bg-navy-50 dark:bg-navy-800'}`}
        >
          <Text
            className={`text-sm font-medium ${action.kind === 'finding' ? 'text-sun-800 dark:text-sun-200' : 'text-navy-700 dark:text-navy-100'}`}
          >
            {action.kind === 'finding' ? 'Op basis van een bevinding' : 'Algemene tip'}
          </Text>
        </View>
      </View>
      <Text className={`text-lg font-semibold text-navy-900 dark:text-navy-50 ${done ? 'line-through' : ''}`}>{action.title}</Text>
      <Body>{action.body}</Body>
      {action.manualSteps ? (
        <View className="rounded-xl bg-navy-50 p-3 dark:bg-navy-800">
          <Text className="text-sm font-semibold text-navy-700 dark:text-navy-100">Zo doe je het</Text>
          <Body>{action.manualSteps}</Body>
        </View>
      ) : null}
      {showButton && action.settings ? (
        <Button
          variant="secondary"
          icon="settings-outline"
          label={settingsButtonLabel(action.settings)}
          onPress={async () => setOpenFailed(!(await openSettings(action.settings!)))}
        />
      ) : null}
      {openFailed ? <Body muted>De instellingen konden niet automatisch geopend worden. Volg de stappen hierboven.</Body> : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Gedaan: ${action.title}`}
        onPress={onToggle}
        className="min-h-12 flex-row items-center gap-3 rounded-xl border border-navy-100 px-3 dark:border-navy-700"
      >
        <Ionicons name={done ? 'checkbox' : 'square-outline'} size={26} color={done ? colors.good : colors.primary} />
        <Text className="flex-1 text-base font-medium text-navy-900 dark:text-navy-50">
          {done ? 'Gedaan — door jou afgevinkt' : 'Ik heb dit gedaan'}
        </Text>
      </Pressable>
    </Card>
  );
}

export default function ActionsScreen() {
  const { report, status, findingActions, tips, completedActions, toggleAction, score, startScan } = useScan();
  const openFindings = findingActions.filter((a) => !completedActions.has(a.id)).length;

  return (
    <Screen>
      <Title subtitle="Concrete stappen op basis van wat we vonden, plus enkele algemene tips.">Los nu op</Title>

      <Notice>
        Afvinken past niets aan op je toestel. Een afgevinkte actie die bij een bevinding hoort, telt mee in je indicatieve score op
        basis van jouw bevestiging. Scan opnieuw om te zien of de meting zelf is veranderd. Algemene tips tellen niet mee.
      </Notice>

      {score.measured !== null ? (
        <Card>
          <Body>
            Gemeten: {score.measured} · Met jouw afgevinkte acties: {score.withActions}
          </Body>
          <Button
            variant="secondary"
            icon="refresh"
            label={status === 'scanning' ? 'Bezig met scannen…' : 'Scan opnieuw'}
            loading={status === 'scanning'}
            onPress={() => void startScan()}
          />
        </Card>
      ) : null}

      <SectionTitle>Op basis van je scan</SectionTitle>
      {!report ? (
        <Card>
          <LoadingBlock label="Wachten op scanresultaten…" />
        </Card>
      ) : findingActions.length === 0 ? (
        <Notice tone="good">
          Op basis van de controles die we echt konden uitvoeren, zijn er geen acties nodig. Bekijk hieronder de algemene tips.
        </Notice>
      ) : (
        <>
          <Body muted>
            {openFindings === 0
              ? 'Je hebt alle acties afgevinkt.'
              : `${openFindings} actie${openFindings === 1 ? '' : 's'} open.`}
          </Body>
          {findingActions.map((a) => (
            <ActionCard key={a.id} action={a} done={completedActions.has(a.id)} onToggle={() => toggleAction(a.id)} />
          ))}
        </>
      )}

      <SectionTitle>Algemene tips</SectionTitle>
      {tips.map((a) => (
        <ActionCard key={a.id} action={a} done={completedActions.has(a.id)} onToggle={() => toggleAction(a.id)} />
      ))}
    </Screen>
  );
}
