// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook'

import css from '@eslint/css'
import tailwindcssV4 from '@poupe/eslint-plugin-tailwindcss'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

const eslintConfig = [
  {
    ...nextPlugin.configs['core-web-vitals'],
    files: ['**/*.{ts,tsx,js,jsx}'],
    // TODO: Next.js still warns that the plugin is missing (vercel/next.js#73389)
    // even though this config loads it. Remove this comment when the warning disappears.
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-check': false,
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    ignores: ['src/stories/**/*.{ts,tsx,js,jsx}', 'src/posthog/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'posthog-js',
              message: 'Import PostHog browser helpers only through @/posthog/client-api.',
            },
            {
              name: 'posthog-node',
              message: 'Import PostHog server helpers only through @/posthog/api.',
            },
            {
              name: '@/posthog',
              message: 'Use @/posthog/api for server code or @/posthog/client-api for client code.',
            },
            {
              name: '@/posthog/server',
              message: 'Use @/posthog/api outside src/posthog/**.',
            },
            {
              name: '@/posthog/client',
              message: 'Use @/posthog/client-api outside src/posthog/**.',
            },
            {
              name: '@/posthog/client-only',
              message: 'Use @/posthog/client-api outside src/posthog/**.',
            },
            {
              name: '@/posthog/analytics',
              message: 'Use @/posthog/client-api outside src/posthog/**.',
            },
            {
              name: '@/posthog/identify',
              message: 'Use @/posthog/api outside src/posthog/**.',
            },
            {
              name: '@/posthog/telemetry',
              message: 'Use @/posthog/api outside src/posthog/**.',
            },
          ],
          patterns: [
            {
              group: ['@/stories/*', '@/stories/**'],
              message: 'Storybook fixtures and assets must stay in Storybook/testing contexts, not runtime src code.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/stories/**/*.{ts,tsx}'],
    ignores: ['src/stories/fixtures/assets.ts'],
    // Enforce correct Storybook framework imports to avoid mixing Next.js/React renderers
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@storybook/nextjs',
              message:
                'Use @storybook/react-vite for Meta/StoryObj typings in stories; do not use Next.js-specific entrypoints.',
            },
            {
              name: '@storybook/nextjs-vite',
              message:
                'Use @storybook/react-vite for Meta/StoryObj typings in stories; do not use Next.js-specific entrypoints.',
            },
            {
              name: '@storybook/react',
              message:
                'Use @storybook/react-vite for story typings to match the configured framework and avoid bundling the legacy renderer.',
            },
          ],
          patterns: [
            {
              group: ['../assets/*', '../../assets/*', '@/stories/assets/*'],
              message:
                'Import Storybook images through src/stories/fixtures/assets.ts instead of direct asset imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.css'],
    language: 'css/css',
    plugins: {
      css,
      tailwindcss: tailwindcssV4,
    },
    rules: {
      ...css.configs.recommended.rules,
      ...tailwindcssV4.configs.recommended.rules,
      'css/no-invalid-at-rules': 'off',
      'css/no-invalid-properties': 'off',
    },
  },

  // File-scoped override: globals.css uses progressive enhancements like
  // `line-clamp` intentionally. Disable Baseline checks and Tailwind
  // baseline rules only for this file so the rest of the codebase keeps
  // strong compatibility linting.
  {
    files: ['src/app/(frontend)/globals.css'],
    language: 'css/css',
    plugins: {
      css,
      tailwindcss: tailwindcssV4,
    },
    rules: {
      'css/use-baseline': 'off',
      'tailwindcss/use-baseline': 'off',
      'tailwindcss/no-invalid-properties': 'off',
    },
  },
  {
    files: ['scripts/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: [
      'src/app/**/route.ts',
      'src/auth/strategies/**/*.ts',
      'src/auth/utilities/**/*.ts',
      'src/collections/**/*.ts',
      'src/endpoints/**/*.ts',
      'src/hooks/**/*.ts',
      'src/instrumentation.ts',
      'src/posthog/**/*.ts',
    ],
    ignores: ['src/auth/utilities/loginHandler.ts', 'src/posthog/client.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    ignores: [
      '.next/',
      '.vercel/',
      'src/migrations/',
      'node_modules/',
      '.github',
      'coverage/',
      'dist/',
      'src/payload-types.ts',
      'src/app/(payload)/**',
      'next-env.d.ts',
      'src/stories/**/*.mdx',
    ],
  },
  ...storybook.configs['flat/recommended'],
  eslintConfigPrettier,
]

export default eslintConfig
