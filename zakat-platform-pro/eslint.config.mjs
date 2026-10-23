import coreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**', 'src/generated/**', '.storage/**'],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Business logic never lives in React components (§58). The server layer is
    // the only place allowed to touch Prisma.
    files: ['src/components/**/*.{ts,tsx}', 'src/modules/**/*.{ts,tsx}', 'src/app/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/generated/prisma/client',
              importNames: ['PrismaClient'],
              message:
                'Components must not instantiate Prisma. Call a service in src/server/modules.',
            },
            {
              name: '@/server/db/prisma',
              message:
                'Components must not query the database directly. Call a service in src/server/modules.',
            },
          ],
        },
      ],
    },
  },
]

export default eslintConfig
