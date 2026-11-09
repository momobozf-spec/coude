import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import type { BriefingKind } from '@core/domain/ops';
import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { openRef } from '@features/butler/ToolResultView';
import { useLanguage } from '@runtime/hooks';
import { opsAction, useBriefing } from '@runtime/opsHooks';
import { AppText, Button, Card, Chip, EmptyState, ListRow, Row, Screen, SectionHeader } from '@ui/primitives';
import { opsUi } from '@ui/opsI18n';
import { spacing } from '@ui/theme';

/** Morning briefing, evening review and night-shift report (§156–§157, §171). */
export default function BriefingScreen(): React.JSX.Element {
  const language = useLanguage();
  const s = opsUi(language);
  const [kind, setKind] = useState<BriefingKind>('morning');
  const briefing = useBriefing(kind);
  const b = briefing.data;

  const build = async () => {
    try {
      await opsAction((c) => c.runBriefing(kind));
    } catch (e) {
      Alert.alert(explainError(DomainError.from(e).code, language));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.briefing }} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label={s.morning} selected={kind === 'morning'} onPress={() => setKind('morning')} />
        <Chip label={s.evening} selected={kind === 'evening'} onPress={() => setKind('evening')} />
        <Chip label={s.nightShift} selected={kind === 'night_shift'} onPress={() => setKind('night_shift')} />
      </Row>
      <Row style={{ justifyContent: 'flex-end', marginTop: spacing.sm }}>
        <Button title={s.runBriefing} compact icon="refresh-outline" onPress={() => void build()} />
      </Row>
      {!b ? (
        <EmptyState icon="sunny-outline" text={s.noBriefing} />
      ) : (
        <>
          <AppText variant="caption" muted>
            {b.date} · {b.createdAt.slice(11, 16)}
          </AppText>
          {b.sections.map((section) => (
            <React.Fragment key={section.id}>
              <SectionHeader title={section.title} />
              <Card>
                {section.lines.length === 0 ? <AppText muted>—</AppText> : null}
                {section.lines.map((line, i) => (
                  <ListRow key={`${section.id}-${i}`} title={line} onPress={section.refs[i] ? () => openRef(section.refs[i] ?? null) : undefined} />
                ))}
              </Card>
            </React.Fragment>
          ))}
          <AppText variant="caption" faint style={{ marginTop: spacing.md }}>
            {s.deliveries}: {b.deliveries.map((d) => `${d.channel} ${d.status}${d.detail ? ` (${d.detail})` : ''}`).join(' · ') || '—'}
          </AppText>
        </>
      )}
    </Screen>
  );
}
