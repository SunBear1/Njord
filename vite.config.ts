/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Framework vendor chunk — changes less often than app code, so it
          // stays cached across deploys. Match only exact package boundaries
          // to avoid pulling recharts deps (react-smooth, react-is, etc.).
          if (
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/react-router/')
          ) {
            return 'framework';
          }
          // react (core) is matched separately — it's small but must be in
          // the same chunk as react-dom for coherence.
          if (id.includes('node_modules/react/')) {
            return 'framework';
          }
        },
      },
    },
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
