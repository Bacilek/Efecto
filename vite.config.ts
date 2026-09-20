import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Pinned because Supabase only redirects a magic link to an allow-listed URL:
  // a port that quietly drifts to 5174 when a stale dev server still holds 5173
  // breaks sign-in with no obvious cause. `strictPort` makes that collision an
  // error you can see instead.
  server: { port: 5173, strictPort: true },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Efecto',
        short_name: 'Efecto',
        description: 'Routines, todos and a calendar in one place.',
        lang: 'en',
        theme_color: '#12141c',
        background_color: '#12141c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          // Provisional "E" mark. The PNGs are rendered from icon.svg; regenerate
          // both if it changes — Windows takes the installed PWA's taskbar icon
          // from the PNG, not the SVG.
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
