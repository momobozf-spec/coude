import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Architectuurregel uit docs/ARCHITECTURE.md §4:
 * de afhankelijkheden lopen maar één kant op, en `core` blijft framework-vrij.
 */
const forbiddenInCore = [
  { group: ['@orbit/db', '@orbit/db/*'], message: 'core mag niet van de database afhangen.' },
  { group: ['@orbit/auth', '@orbit/auth/*'], message: 'core mag niet van auth afhangen.' },
  { group: ['next', 'next/*'], message: 'core moet framework-agnostisch blijven.' },
  { group: ['react', 'react-dom', 'react-native'], message: 'core bevat geen UI.' },
  { group: ['@prisma/client'], message: 'core kent geen persistentie.' },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/generated/**',
      '**/*.config.js',
      // Door Next gegenereerd; niet onze code.
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSEnumDeclaration",
          message: 'Gebruik `as const`-objecten in plaats van TS enums (betere tree-shaking en runtime-veiligheid).',
        },
      ],
    },
  },
  {
    files: ['packages/core/**/*.ts', 'packages/types/**/*.ts', 'packages/validation/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: forbiddenInCore }],
    },
  },
  {
    files: ['**/*.test.ts', '**/tests/**/*.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    // Node-scripts (seed, migraties, rooktest): draaien buiten de app en mogen loggen.
    files: ['**/prisma/**/*.mjs', '**/scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
);
