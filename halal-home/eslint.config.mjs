/**
 * ESLint flat config.
 *
 * `eslint-config-next` 16 exporteert zelf al flat-config-arrays, dus we
 * gebruiken die rechtstreeks. De FlatCompat-brug uit `@eslint/eslintrc` is hier
 * bewust niet gebruikt: die valt om op ESLint 9.39 met een circulaire
 * plugin-structuur.
 */
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: ['node_modules/**', '.next/**', 'next-env.d.ts', '.storage/**', 'src/generated/**'],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Ongebruikte argumenten met een underscore zijn een bewuste keuze:
      // route handlers krijgen een `_request` mee die ze niet nodig hebben.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]

export default config
