// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import css from '@eslint/css'
import tailwindcssV4 from '@poupe/eslint-plugin-tailwindcss'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

const eslintConfig = [{
  ...nextPlugin.configs['core-web-vitals'],
  files: ['**/*.{ts,tsx,js,jsx}'],
  // TODO: Next.js still warns that the plugin is missing (vercel/next.js#73389)
  // even though this config loads it. Remove this comment when the warning disappears.
}, ...tseslint.configs.recommended, {
  files: ['**/*.{ts,tsx,js,jsx}'],
  plugins: {
    'react-hooks': reactHooks,
  },
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-empty-object-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
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
}, {
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
}, {
  files: ['scripts/**'],
  rules: {
    '@typescript-eslint/no-require-imports': 'off',
  },
}, {
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
  ],
}, ...storybook.configs["flat/recommended"]]

export default eslintConfig
