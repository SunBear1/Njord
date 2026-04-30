/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    modulePreload: { polyfill: false },
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**/*.ts'],
      exclude: ['src/utils/hmm.ts'], // tested indirectly via sellAnalysis
      thresholds: {
        lines: 40,
        functions: 50,
      },
    },
  },
})
