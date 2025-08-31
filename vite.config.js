import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Prompt users when a new SW is available
      workbox: {
        // Precache all built assets; tweak globPatterns if you add other file types
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Cache static resources from CDNs used by your app (safe defaults):
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
            },
          },
          {
            // Google fonts & gstatic (if you add fonts later)
            urlPattern: /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 year
            },
          },
          {
            // gapi/gsi scripts are safe to cache with SWR
            urlPattern: /^https:\/\/(apis\.google\.com|accounts\.google\.com)\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-apis',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
            },
          },
        ],
        // Don’t try to cache Drive upload/download POST/PATCH calls.
        // Those go through gapi and need network/auth.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'MedBox — Medicine Inventory',
        short_name: 'MedBox',
        description: 'Sort and track your home medicines with custom categories, expiry alerts, and sync.',
        theme_color: '#0ea5e9',
        background_color: '#0b1220',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
      },
    }),
  ],
})
