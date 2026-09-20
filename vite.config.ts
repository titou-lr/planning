import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' — indispensable pour le chargement file:// dans Electron packagé
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/core/**/*.test.ts', 'src/store/**/*.test.ts', 'src/*.test.ts'],
  },
})
