// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [js.configs.recommended, {
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
}, {
  files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  plugins: {
    '@typescript-eslint': ts,
  },
  rules: {
    ...ts.configs.recommended.rules,
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
}, {
  files: ['**/*.svelte'],
  languageOptions: {
    parserOptions: {
      parser: tsParser,
    },
  },
  plugins: {
    svelte,
  },
  rules: {
    ...svelte.configs.recommended.rules,
  },
}, prettier, {
  ignores: ['node_modules/**', '.svelte-kit/**', 'build/**', 'dist/**'],
}, ...storybook.configs["flat/recommended"]];
