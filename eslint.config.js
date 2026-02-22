import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    '.venv/**',
    'public/WorldJS.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['vite.config.js', 'vitest*.config.js', 'playwright.config.js', 'eslint.config.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['tests/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['src/test-utils/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/components/EventForm.jsx', 'src/components/Timeline.jsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
