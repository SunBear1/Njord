import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Tailwind classes that fail WCAG AA on dark surfaces — enforced by colorContrast.test.ts
// text-faint in dark mode = #4f5d75 → contrast 1.54–2.40:1 on dark backgrounds
const FORBIDDEN_DARK_CLASSES = ['dark:text-faint']

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Block dark:text-faint in className strings — fails WCAG AA on dark surfaces.
      // Use dark:text-muted (#8e95a8) or dark:text-on-dark-muted (#d0d1d2).
      // See src/tokens/colorPairings.ts for the full contrast reference table.
      'no-restricted-syntax': [
        'error',
        ...FORBIDDEN_DARK_CLASSES.map((cls) => ({
          selector: `Literal[value=/(?:^|\\s)${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)/]`,
          message: `"${cls}" fails WCAG AA on dark surfaces (text-faint dark=#4f5d75, contrast ~1.5-2.4:1). Use "dark:text-muted" or "dark:text-on-dark-muted". See src/tokens/colorPairings.ts.`,
        })),
      ],
    },
  },
  {
    files: ['src/scripts/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
])
