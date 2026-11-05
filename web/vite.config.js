import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mochila',
        short_name: 'Mochila',
        description: 'Aprender sin conexión',
        theme_color: '#f5f1e8',
        background_color: '#f5f1e8',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        importScripts: ['segundo-plano.js'], // sincronización con la app cerrada
        // La letra (Archivo, solo caracteres latinos: 35 KB) también se guarda, para que sin conexión se vea igual.
        globPatterns: ['**/*.{js,css,html}', '**/archivo-latin-wght-normal-*.woff2'],
        runtimeCaching: [
          {
            // Lo del profe no: lo guarda api() por profe (si no, otro profe en el mismo aparato lo vería). Ni /api/salud ni los paquetes: dicen si hay conexión y qué hay nuevo.
            urlPattern: /^https?:\/\/[^/]+\/api\/(?!profes|clases|salud|paquetes).*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
