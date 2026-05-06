import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      base: '/crm/',
      scope: '/crm/',
      manifest: false,
      includeAssets: ['offline.html', 'favicon.jpeg', 'favicon.svg', 'icons/*.png'],
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/crm/offline.html',
        navigateFallbackDenylist: [/^\/crm\/api\//, /^\/crm\/embed\//],
        runtimeCaching: [
          // Google Fonts: cache largo
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Auth/login: NUNCA cachear
          {
            urlPattern: /\/crm\/api\/auth(\/|$)/,
            handler: 'NetworkOnly',
          },
          // Endpoints autenticados (lectura): NetworkFirst con timeout corto
          {
            urlPattern: /\/crm\/api\/(leads|clients|products|users|matriculas|conversions|reports|dashboard|email-sequences|forms|webhooks|projects|notifications|payroll|commissions|accounting|webhook-tokens|field-definitions|status|ia|claude|seo|campaigns|woocommerce|documents|reports-ia|audiences)(\/|$|\?)/i,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-data',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Imagenes/avatares/logos (assets binarios servidos por API)
          {
            urlPattern: /\/crm\/api\/.*\/(logo|avatar)/i,
            handler: 'StaleWhileRevalidate',
            method: 'GET',
            options: {
              cacheName: 'api-images',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Fuentes Google (binarios fonts.gstatic.com)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-static',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Imagenes/iconos servidos desde el origen
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // Estaticos JS/CSS (revalida en background)
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && (request.destination === 'script' || request.destination === 'style'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  base: '/crm/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/playwright-report/**', '**/test-results/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-ui': ['@phosphor-icons/react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-uploads': ['react-dropzone'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/crm/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/crm/, ''),
      },
    },
  },
});
