import { darkTheme, lightTheme, type Theme } from './tokens/theme';
import { duration, easing, fontSize, lineHeight, radius, spacing } from './tokens/scale';

/**
 * Zet de tokens om naar CSS-variabelen voor de webapp. Zo bestaan de tokens
 * maar één keer: Tailwind en de losse CSS lezen allebei uit deze variabelen,
 * en React Native leest dezelfde objecten rechtstreeks.
 */

function flatten(prefix: string, value: unknown, out: Record<string, string>): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number') {
    out[prefix] = String(value);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      // camelCase naar kebab-case: `successBg` wordt `success-bg`.
      const segment = key
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase();
      flatten(`${prefix}-${segment}`, child, out);
    }
  }
}

export function themeToCssVariables(theme: Theme): Record<string, string> {
  const variables: Record<string, string> = {};
  flatten('--color', theme.color, variables);
  flatten('--shadow', theme.shadow, variables);
  return variables;
}

export function scaleToCssVariables(): Record<string, string> {
  const variables: Record<string, string> = {};
  flatten('--space', spacing, variables);
  flatten('--radius', radius, variables);
  flatten('--font-size', fontSize, variables);
  flatten('--line-height', lineHeight, variables);
  flatten('--duration', duration, variables);
  flatten('--ease', easing, variables);
  return variables;
}

function toCssBlock(selector: string, variables: Record<string, string>): string {
  const body = Object.entries(variables)
    .map(([name, value]) => {
      const unit =
        /^--(space|radius|font-size|line-height)/.test(name) && /^\d+$/.test(value) ? 'px' : '';
      const suffix = /^--duration/.test(name) && /^\d+$/.test(value) ? 'ms' : unit;
      return `  ${name}: ${value}${suffix};`;
    })
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

/**
 * De volledige stylesheet met tokens. Donker volgt zowel de systeemvoorkeur als
 * een expliciete keuze via `data-theme`, zodat de instelling in de app altijd wint.
 */
export function buildTokenStylesheet(): string {
  return [
    toCssBlock(':root', { ...scaleToCssVariables(), ...themeToCssVariables(lightTheme) }),
    toCssBlock('[data-theme="dark"]', themeToCssVariables(darkTheme)),
    `@media (prefers-color-scheme: dark) {\n${toCssBlock(
      ':root:not([data-theme="light"])',
      themeToCssVariables(darkTheme),
    )
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')}\n}`,
  ].join('\n\n');
}
