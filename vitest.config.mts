import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    // Aucun test ne touche au DOM. Le générateur du lot 2 est un module pur, et
    // le rester est la condition pour le tester sérieusement.
    environment: 'node',
    include: ['lib/**/*.test.ts', 'scripts/**/*.test.ts'],
    globals: false,
  },
})
