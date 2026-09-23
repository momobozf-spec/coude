import type { ReactNode } from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../theme.js';
import type { ColorScheme, Theme } from '../tokens.js';

export type TextVariant = keyof Theme['typography'];
export type TextTone = 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  color?: string;
  align?: 'left' | 'center' | 'right';
  strike?: boolean;
}

const toneColor = (tone: TextTone, c: ColorScheme): string =>
  ({
    default: c.text,
    muted: c.textMuted,
    accent: c.accent,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    info: c.info,
    inverse: c.onPrimary,
  })[tone];

export function Text({
  variant = 'body',
  tone = 'default',
  color,
  align,
  strike,
  style,
  ...rest
}: TextProps): ReactNode {
  const theme = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant],
        { color: color ?? toneColor(tone, theme.colors) },
        align ? { textAlign: align } : null,
        strike ? { textDecorationLine: 'line-through' } : null,
        style,
      ]}
    />
  );
}
