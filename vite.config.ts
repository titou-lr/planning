import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' — indispensable pour le chargement file:// dans Electron packagé
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/planning.svg'],
      manifest: {
        name: 'Planning',
        short_name: 'Planning',
        description: 'Notes, tâches et calendrier local-first.',
        theme_color: '#0b0b0c',
        background_color: '#0b0b0c',
        display: 'standalone',
        start_url: './',
        scope: './',
        lang: 'fr',
        icons: [{
          src: 'icons/planning.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        }],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/core/**/*.test.ts', 'src/store/**/*.test.ts', 'src/data/**/*.test.ts', 'src/cloud/**/*.test.ts', 'src/*.test.ts'],
  },
})
