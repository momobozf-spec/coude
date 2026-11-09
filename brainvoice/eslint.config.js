// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*', 'coverage/*', 'proxy/**', 'native/**', '.expo/*', 'node_modules/*'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    // The domain layer must stay free of React Native / Expo / platform imports (ARCHITECTURE.md §3).
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react-native', 'react-native/*'], message: 'src/core is platform-agnostic.' },
            { group: ['expo', 'expo-*', 'expo/*'], message: 'src/core is platform-agnostic.' },
            { group: ['react', 'react/*', 'react-dom'], message: 'src/core has no UI.' },
            { group: ['**/platform/**', '**/features/**', '**/ui/**', '**/runtime/**', '**/app/**'], message: 'src/core must not depend on outer layers.' },
          ],
        },
      ],
    },
  },
]);
