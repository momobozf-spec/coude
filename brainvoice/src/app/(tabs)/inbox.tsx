import { router } from 'expo-router';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import type { ItemType } from '@core/domain/entities';
import { useCaptures, useLanguage, useTimezone, useUnprocessedCaptures } from '@runtime/hooks';
import { getRuntime, useAppStore } from '@runtime/stores/appStore';
import { AppText, Button, Card, Chip, EmptyState, ListRow, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { spacing, useTheme } from '@ui/theme';

const FILTERS: { key: 'all' | 'NOTE' | 'IDEA' | 'TASK' | 'REMINDER' | 'EVENT'; icon: 'apps-outline' | 'document-text-outline' | 'bulb-outline' | 'checkmark-circle-outline' | 'notifications-outline' | 'calendar-outline' }[] = [
  { key: 'all', icon: 'apps-outline' },
  { key: 'NOTE', icon: 'document-text-outline' },
  { key: 'IDEA', icon: 'bulb-outline' },
  { key: 'TASK', icon: 'checkmark-circle-outline' },
  { key: 'REMINDER', icon: 'notifications-outline' },
  { key: 'EVENT', icon: 'calendar-outline' },
];

/** The Brain Inbox: everything captured, unprocessed first. */
export default function InboxScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const timezone = useTimezone();
  const strings = ui(language);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const unprocessed = useUnprocessedCaptures();
  const captures = useCaptures(100);
  const bump = useAppStore((s) => s.bumpData);

  const list = (captures.data ?? []).filter((c) => c.processed && (filter === 'all' || c.type === (filter as ItemType) || (filter === 'NOTE' && ['THOUGHT', 'QUESTION', 'REFERENCE'].includes(c.type))));

  const archive = (id: string) => {
    Alert.alert(strings.archive, undefined, [
      { text: strings.cancel, style: 'cancel' },
      {
        text: strings.archive,
        style: 'destructive',
        onPress: () => {
          void getRuntime().services.captures.archive(id).then(bump);
        },
      },
    ]);
  };

  const open = (linked: { type: string; id: string } | undefined) => {
    if (!linked) return;
    if (linked.type === 'TASK') router.push({ pathname: '/task/[id]', params: { id: linked.id } });
    else if (['NOTE', 'IDEA', 'THOUGHT', 'QUESTION', 'REFERENCE'].includes(linked.type)) router.push({ pathname: '/note/[id]', params: { id: linked.id } });
  };

  return (
    <Screen>
      <AppText variant="title">{strings.brainInbox}</AppText>

      {(unprocessed.data ?? []).length > 0 ? (
        <>
          <SectionHeader title={`${unprocessed.data?.length ?? 0} ${strings.unprocessed}`} />
          {(unprocessed.data ?? []).map((c) => (
            <Card key={c.id} tone="accent" style={{ marginBottom: spacing.sm }}>
              <AppText>{c.originalText}</AppText>
              <AppText variant="caption" faint style={{ marginTop: 4 }}>
                {DateTime.fromISO(c.createdAt).setZone(timezone).setLocale(language).toRelative()}
              </AppText>
              <Row style={{ marginTop: spacing.md, justifyContent: 'flex-end' }}>
                <Button title={strings.archive} variant="ghost" compact onPress={() => archive(c.id)} />
                <Button title={strings.review} compact icon="sparkles-outline" onPress={() => router.push({ pathname: '/capture', params: { text: c.originalText, source: 'text' } })} />
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.xl }}>
        {FILTERS.map((f) => (
          <Chip key={f.key} icon={f.icon} label={f.key === 'all' ? strings.all : f.key} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </Row>

      {list.length === 0 ? (
        <EmptyState icon="file-tray-outline" text={strings.emptyInbox} />
      ) : (
        list.map((c) => (
          <ListRow
            key={c.id}
            title={c.title || c.cleanedText}
            subtitle={`${DateTime.fromISO(c.createdAt).setZone(timezone).setLocale(language).toFormat('ccc d LLL HH:mm')}${c.category ? ` · ${c.category}` : ''}`}
            trailing={<Pill label={c.type} tone="muted" />}
            onPress={() => open(c.linkedItems[0])}
          />
        ))
      )}
      <AppText variant="caption" faint style={{ marginTop: spacing.xl }} onPress={() => router.push('/history')} accessibilityRole="link">
        {strings.history} · {strings.search}
      </AppText>
      <AppText variant="caption" faint onPress={() => router.push('/search')} accessibilityRole="link" style={{ color: theme.colors.accent }}>
        {strings.search} →
      </AppText>
    </Screen>
  );
}
