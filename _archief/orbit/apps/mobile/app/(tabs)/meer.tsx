import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Screen, SectionTitle } from '@/components/ui';
import { useSession } from '@/lib/session';
import { spacing, typography, useTheme } from '@/theme';

/** Wat niet in de tabbar past: ideeën, projecten, kalender, tags, instellingen. */
const ENTRIES: { icon: React.ComponentProps<typeof Feather>['name']; label: string }[] = [
  { icon: 'inbox', label: 'Inbox' },
  { icon: 'zap', label: 'Ideeën' },
  { icon: 'folder', label: 'Projecten' },
  { icon: 'calendar', label: 'Kalender' },
  { icon: 'tag', label: 'Tags' },
  { icon: 'search', label: 'Zoeken' },
];

export default function MoreScreen() {
  const theme = useTheme();
  const { user, signOut } = useSession();

  return (
    <Screen title="Meer" subtitle={user?.email}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing[10] }}>
        <SectionTitle>Onderdelen</SectionTitle>
        <Card style={styles.card}>
          {ENTRIES.map((entry) => (
            <Pressable
              key={entry.label}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: theme.color.border.subtle, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name={entry.icon} size={20} color={theme.color.text.tertiary} />
              <Text style={[typography.body, { color: theme.color.text.primary, flex: 1 }]}>
                {entry.label}
              </Text>
              <Feather name="chevron-right" size={18} color={theme.color.text.disabled} />
            </Pressable>
          ))}
        </Card>

        <SectionTitle>Account</SectionTitle>
        <Card style={styles.card}>
          <Pressable
            onPress={() => void signOut()}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: theme.color.border.subtle, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Feather name="log-out" size={20} color={theme.color.status.danger} />
            <Text style={[typography.body, { color: theme.color.status.danger, flex: 1 }]}>
              Uitloggen
            </Text>
          </Pressable>
        </Card>

        <View style={styles.footer}>
          <Text style={[typography.micro, { color: theme.color.text.disabled }]}>Orbit 0.1.0</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing[4] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: { alignItems: 'center', paddingTop: spacing[6] },
});
