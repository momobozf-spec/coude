import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { queryKeys } from '@orbit/api-client';
import { Card, EmptyState, Screen, SectionTitle } from '@/components/ui';
import { TaskRow } from '@/components/task-row';
import { api } from '@/lib/client';
import { useSession } from '@/lib/session';
import { spacing, typography, useTheme } from '@/theme';

/** Het dashboard: hetzelfde overzicht als op web, in één verticale kolom. */
export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useSession();

  const dashboard = useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => api().dashboard(),
  });

  const firstName = user?.name.split(' ')[0] ?? '';

  if (dashboard.isLoading) {
    return (
      <Screen title="Home">
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent.default} />
        </View>
      </Screen>
    );
  }

  const data = dashboard.data;

  return (
    <Screen
      title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
      subtitle={
        data ? `${data.summary.todayCount} vandaag · ${data.summary.overdueCount} achterstallig` : undefined
      }
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing[10] }}
        refreshControl={
          <RefreshControl refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()} />
        }
      >
        <View style={styles.stats}>
          <Stat label="Vandaag" value={data?.summary.todayCount ?? 0} />
          <Stat label="Achterstallig" value={data?.summary.overdueCount ?? 0} tone="danger" />
          <Stat label="Komend" value={data?.summary.upcomingCount ?? 0} />
          <Stat label="Inbox" value={data?.summary.inboxCount ?? 0} />
        </View>

        {data && data.overdue.length > 0 ? (
          <>
            <SectionTitle count={data.overdue.length}>Achterstallig</SectionTitle>
            <Card style={styles.card}>
              {data.overdue.map((entry) => (
                <TaskRow
                  key={entry.item.id}
                  entry={entry}
                  today={data.date}
                  onChanged={() => dashboard.refetch()}
                />
              ))}
            </Card>
          </>
        ) : null}

        <SectionTitle count={data?.today.length}>Vandaag</SectionTitle>
        <Card style={styles.card}>
          {data && data.today.length > 0 ? (
            data.today.map((entry) => (
              <TaskRow
                key={entry.item.id}
                entry={entry}
                today={data.date}
                onChanged={() => dashboard.refetch()}
              />
            ))
          ) : (
            <EmptyState
              icon="check-circle"
              title="Niets voor vandaag"
              description="Tik op de plus om iets vast te leggen. Een hele zin mag: Orbit haalt de datum er zelf uit."
            />
          )}
        </Card>

        {data && data.recentIdeas.length > 0 ? (
          <>
            <SectionTitle>Nieuwe ideeën</SectionTitle>
            <Card style={styles.card}>
              {data.recentIdeas.map((idea) => (
                <View
                  key={idea.id}
                  style={[styles.simpleRow, { borderBottomColor: theme.color.border.subtle }]}
                >
                  <Text numberOfLines={1} style={[typography.body, { color: theme.color.text.primary }]}>
                    {idea.title}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {data && data.projects.length > 0 ? (
          <>
            <SectionTitle>Projecten</SectionTitle>
            <Card style={styles.card}>
              {data.projects.map((project) => (
                <View
                  key={project.id}
                  style={[styles.simpleRow, { borderBottomColor: theme.color.border.subtle }]}
                >
                  <View style={styles.projectHeader}>
                    <View style={[styles.dot, { backgroundColor: project.color }]} />
                    <Text style={[typography.body, { color: theme.color.text.primary, flex: 1 }]}>
                      {project.name}
                    </Text>
                    <Text style={[typography.caption, { color: theme.color.text.tertiary }]}>
                      {project.progress.percent}%
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: theme.color.bg.subtle }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${project.progress.percent}%`, backgroundColor: project.color },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {dashboard.isError ? (
          <Text style={[typography.caption, { color: theme.color.status.danger, padding: spacing[4] }]}>
            Kon het overzicht niet laden. Trek omlaag om het opnieuw te proberen.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'danger' }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: theme.color.bg.surface, borderColor: theme.color.border.subtle },
      ]}
    >
      <Text
        style={[
          typography.heading,
          { color: tone === 'danger' && value > 0 ? theme.color.status.danger : theme.color.text.primary },
        ]}
      >
        {value}
      </Text>
      <Text style={[typography.micro, { color: theme.color.text.tertiary }]}>{label}</Text>
    </View>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Goedenacht';
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stats: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing[3],
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: { marginHorizontal: spacing[4] },
  simpleRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  projectHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});
