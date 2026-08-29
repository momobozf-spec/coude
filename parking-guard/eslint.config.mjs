import coreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Twee regels dragen hier het echte gewicht.
 *
 * `no-explicit-any` staat op error omdat een verkeerd getypte extractie
 * stilzwijgend doorloopt tot in een dossier dat bij een gemeente belandt.
 *
 * De import-restrictie op `src/domain/**` houdt de beslislaag puur. Zodra
 * `submission-policy.ts` Prisma mag aanraken, is de vraag "mag dit dossier de
 * deur uit" niet meer los te testen — en dat is precies de vraag waarvan je
 * wil kunnen bewijzen dat het antwoord klopt.
 */
const PURE_LAYERS = ['src/domain/**/*.ts']

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'coverage/**',
      '.devdb/**',
      '.storage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: PURE_LAYERS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '@/lib/db', '@/server/*', 'next/*'],
              message:
                'Deze laag rekent en praat niet met de buitenwereld. Geef data door als ' +
                'argument in plaats van de database of het netwerk te bevragen.',
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
                'Componenten instantiëren geen Prisma. Roep een service in src/server aan.',
            },
          ],
        },
      ],
    },
  },
]

export default eslintConfig
