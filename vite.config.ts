import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import compression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  },
  preview: {
    headers: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon-180.png', 'kurso-logo-full.png'],
      manifest: {
        id: '/',
        name: 'Kurso - Kuentas y Kontrol',
        short_name: 'Kurso',
        description: 'Sistema de gestion escolar: finanzas, alumnos y comunicacion del curso.',
        start_url: '/',
        scope: '/',
        lang: 'es-CL',
        dir: 'ltr',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        orientation: 'portrait',
        categories: ['education', 'productivity', 'finance'],
        screenshots: [
          {
            src: '/app-dashboard.png',
            sizes: '1024x557',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Panel principal de finanzas y estado del curso'
          },
          {
            src: '/app-menu-finanzas.png',
            sizes: '1024x556',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Vista de reportes y resumen financiero'
          },
          {
            src: '/app-menu-pagos.png',
            sizes: '1024x544',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Gestion de pagos y seguimiento'
          }
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Inicio',
            description: 'Abrir panel principal',
            url: '/dashboard'
          },
          {
            name: 'Alumnos',
            short_name: 'Alumnos',
            description: 'Abrir gestion de alumnos',
            url: '/students'
          },
          {
            name: 'Movimientos',
            short_name: 'Movimientos',
            description: 'Registrar ingresos y egresos',
            url: '/movements'
          }
        ],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
