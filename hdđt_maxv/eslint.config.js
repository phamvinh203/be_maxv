import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // File cấu hình module Kế toán (data + icon SVG inline) — không phải
    // component module nên tắt rule fast-refresh ở đây (giống fe_maxv gốc).
    files: ['src/features/accounting/_shared/config/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
