import React from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Label } from '@ui/primitives';
import { radius, spacing, useTheme } from '@ui/theme';

/** Labelled text input used by the admin forms. */
export function Field({ label, value, onChangeText, multiline = false, placeholder, keyboardType, autoCapitalize, secure = false, style, testID }: { label: string; value: string; onChangeText: (v: string) => void; multiline?: boolean; placeholder?: string; keyboardType?: TextInputProps['keyboardType']; autoCapitalize?: TextInputProps['autoCapitalize']; secure?: boolean; style?: TextInputProps['style']; testID?: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <>
      <Label style={{ marginTop: spacing.md }}>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secure}
        testID={testID}
        accessibilityLabel={label}
        style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }, multiline ? styles.multiline : null, style]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, fontSize: 16, marginTop: 6 },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
});
