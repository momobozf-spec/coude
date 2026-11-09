import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { queryKeys } from '@orbit/api-client';
import { describeRecurrence, parseQuickCapture } from '@orbit/core';
import { ItemType, type CaptureResult, type ItemType as ItemTypeValue } from '@orbit/types';
import { describeRelativeDate, todayInTimeZone } from '@orbit/utils';
import { Button } from '@/components/ui';
import { api } from '@/lib/client';
import { spacing, typography, useTheme } from '@/theme';

/**
 * Quick capture op mobiel.
 *
 * Dezelfde parser als op web, dus dezelfde chips terwijl je typt — hij draait
 * lokaal en heeft geen netwerk nodig. De server parseert daarna opnieuw, zodat
 * ook de share-extensie via hetzelfde endpoint kan.
 */

const TYPES: { value: ItemTypeValue; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { value: ItemType.Task, label: 'Taak', icon: 'check-circle' },
  { value: ItemType.Note, label: 'Notitie', icon: 'file-text' },
  { value: ItemType.Idea, label: 'Idee', icon: 'zap' },
];

const RELATIVE_LABELS: Record<string, string> = {
  today: 'Vandaag',
  tomorrow: 'Morgen',
  thisWeek: 'Deze week',
  nextWeek: 'Volgende week',
};

export default function CaptureScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<ItemTypeValue>(ItemType.Task);
  const [typeLocked, setTypeLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = todayInTimeZone(new Date(), timeZone);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    const result = parseQuickCapture(text, {
      now: new Date(),
      timeZone,
      locale: 'nl',
      weekStartsOn: 1,
    });
    if (!typeLocked && result.type !== type) setType(result.type);
    return result;
  }, [text, timeZone, type, typeLocked]);

  async function save() {
    if (!parsed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api().quickCapture({ text, type, body: body || undefined });
      await queryClient.invalidateQueries({ queryKey: queryKeys.all });
      router.back();
    } catch {
      setError('Opslaan mislukt. Controleer je verbinding.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.color.bg.canvas, paddingTop: insets.top }}
    >
      <View style={[styles.header, { borderBottomColor: theme.color.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Sluiten">
          <Feather name="x" size={22} color={theme.color.text.tertiary} />
        </Pressable>
        <Text style={[typography.heading, { color: theme.color.text.primary, flex: 1 }]}>Nieuw</Text>
        <Button label="Opslaan" variant="primary" onPress={() => void save()} loading={busy} disabled={!parsed} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }}>
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          multiline
          placeholder="Bel morgen om 14:00 met de boekhouder"
          placeholderTextColor={theme.color.text.disabled}
          style={[
            typography.heading,
            styles.input,
            { color: theme.color.text.primary, backgroundColor: theme.color.bg.surface, borderColor: theme.color.border.subtle },
          ]}
        />

        {parsed ? <Chips parsed={parsed} today={today} /> : null}

        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder={type === ItemType.Note ? 'Begin je notitie...' : 'Extra details (optioneel)'}
          placeholderTextColor={theme.color.text.disabled}
          style={[
            typography.body,
            styles.input,
            {
              color: theme.color.text.secondary,
              backgroundColor: theme.color.bg.surface,
              borderColor: theme.color.border.subtle,
              minHeight: type === ItemType.Note ? 160 : 80,
            },
          ]}
        />

        <View style={styles.types}>
          {TYPES.map((option) => {
            const active = option.value === type;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setType(option.value);
                  setTypeLocked(true);
                }}
                style={[
                  styles.typeButton,
                  {
                    backgroundColor: active ? theme.color.accent.subtle : theme.color.bg.surface,
                    borderColor: active ? 'transparent' : theme.color.border.subtle,
                  },
                ]}
              >
                <Feather
                  name={option.icon}
                  size={16}
                  color={active ? theme.color.accent.text : theme.color.text.tertiary}
                />
                <Text
                  style={[
                    typography.callout,
                    { color: active ? theme.color.accent.text : theme.color.text.secondary },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text style={[typography.caption, { color: theme.color.status.danger }]}>{error}</Text>
        ) : null}

        {parsed && parsed.title !== parsed.raw.trim() ? (
          <Text style={[typography.caption, { color: theme.color.text.tertiary }]}>
            Wordt opgeslagen als: {parsed.title}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chips({ parsed, today }: { parsed: CaptureResult; today: string }) {
  const theme = useTheme();
  const chips: { icon: React.ComponentProps<typeof Feather>['name']; label: string }[] = [];

  if (parsed.dueDate) {
    const relative = describeRelativeDate(parsed.dueDate, today);
    const label = RELATIVE_LABELS[relative.key] ?? parsed.dueDate;
    chips.push({ icon: 'calendar', label: parsed.dueTime ? `${label} ${parsed.dueTime}` : label });
  }
  if (parsed.recurrence) {
    chips.push({ icon: 'repeat', label: describeRecurrence(parsed.recurrence, 'nl') });
  }
  if (parsed.priority && parsed.priority !== 'NONE') {
    chips.push({ icon: 'flag', label: parsed.priority });
  }
  if (parsed.projectName) chips.push({ icon: 'folder', label: parsed.projectName });
  for (const tag of parsed.tagNames) chips.push({ icon: 'tag', label: tag });

  if (chips.length === 0) return null;

  return (
    <View style={styles.chips}>
      {chips.map((chip) => (
        <View
          key={`${chip.icon}-${chip.label}`}
          style={[styles.chip, { backgroundColor: theme.color.accent.subtle }]}
        >
          <Feather name={chip.icon} size={12} color={theme.color.accent.text} />
          <Text style={[typography.micro, { color: theme.color.accent.text }]}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    minHeight: 60,
    textAlignVertical: 'top',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: 6,
  },
  types: { flexDirection: 'row', gap: spacing[2] },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
