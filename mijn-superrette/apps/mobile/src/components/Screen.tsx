import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, IconButton, Row, Text, useTheme } from '@superrette/ui';
import { ApiError } from '../api/client';
import { useI18n } from '../state/i18n';

export function Screen({
  children,
  title,
  back,
  right,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ['top'],
}: {
  children: ReactNode;
  title?: string;
  back?: boolean;
  right?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'bottom')[];
}): ReactNode {
  const { colors } = useTheme();
  const { t } = useI18n();
  const header =
    title || back ? (
      <Row style={{ paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'space-between' }}>
        <Row gap={4} style={{ flex: 1 }}>
          {back ? <IconButton icon="chevron-left" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
          {title ? (
            <Text variant="title" numberOfLines={1} style={{ flex: 1, paddingLeft: back ? 0 : 8 }}>
              {title}
            </Text>
          ) : null}
        </Row>
        {right}
      </Row>
    ) : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Loading(): ReactNode {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <ActivityIndicator color={colors.text} />
    </View>
  );
}

/** Error state; entitlement errors show an upgrade hint instead of a generic failure. */
export function ErrorState({ error, onRetry, lockedMessage }: { error: unknown; onRetry?: () => void; lockedMessage?: string }): ReactNode {
  const { t } = useI18n();
  if (error instanceof ApiError && (error.code === 'ENTITLEMENT_REQUIRED' || error.code === 'LIMIT_REACHED')) {
    return (
      <EmptyState
        icon="sparkle"
        title={t('plans.plus')}
        body={lockedMessage ?? error.message}
        action={<Button title={t('plans.upgrade')} variant="accent" onPress={() => router.push('/settings/plan')} />}
      />
    );
  }
  return <EmptyState icon="info" title={t('common.error')} body={error instanceof Error ? error.message : undefined} action={onRetry ? <Button title={t('common.retry')} variant="secondary" onPress={onRetry} /> : undefined} />;
}
