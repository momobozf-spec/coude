import coreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**', '.devdb/**'],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` verstopt precies de fouten die deze pijplijn duur maken: een
      // verkeerd getypte RawListing gaat stilzwijgend door tot in een alert.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // De domeinlaag is puur: hij rekent, hij praat niet met de buitenwereld.
    // Zodra hij Prisma of fetch mag aanraken, is hij niet meer los te testen.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '@/repositories/*', '@/lib/prisma'],
              message:
                'De domeinlaag moet puur blijven. Geef data door als argument in plaats van de database te bevragen.',
            },
          ],
        },
      ],
    },
  },
  {
    // React-componenten renderen; ze bevragen de database niet rechtstreeks.
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              importNames: ['PrismaClient'],
              message:
                'Componenten instantiëren geen Prisma. Roep een service in src/services aan.',
            },
          ],
        },
      ],
    },
  },
]

export default eslintConfig
