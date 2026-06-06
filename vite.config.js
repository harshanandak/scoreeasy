import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const isVercelPreview = process.env.VERCEL_ENV === 'preview';

function previewServiceWorkerCleanup() {
  return {
    name: 'preview-service-worker-cleanup',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.clients.claim();
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    await Promise.all(clients.map((client) => client.navigate(client.url)));
  })());
});
`.trim(),
      });
    },
  };
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_VERCEL_PREVIEW': JSON.stringify(isVercelPreview),
  },
  plugins: [
    tailwindcss(),
    react(),
    isVercelPreview ? previewServiceWorkerCleanup() : VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      cleanupOutdatedCaches: true,
      includeAssets: [
        'icons/icon-192.svg',
        'icons/icon-512.svg',
        'icons/icon-192-maskable.png',
        'icons/icon-512-maskable.png',
      ],
      manifest: {
        name: 'Score Easy',
        short_name: 'ScoreEasy',
        description: 'Universal sports score tracking',
        theme_color: '#111111',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Start Match',
            short_name: 'Play',
            description: 'Choose a sport and start scoring.',
            url: '/play',
            icons: [{ src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Match History',
            short_name: 'History',
            description: 'Review saved matches.',
            url: '/history',
            icons: [{ src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Statistics',
            short_name: 'Stats',
            description: 'Open scoring statistics.',
            url: '/statistics',
            icons: [{ src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /https:\/\/.*\.convex\.cloud\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /https:\/\/api\.clerk\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /https:\/\/.*clerk.*\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    testTimeout: 15000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      '**/android/**/build/**',
      '**/ios/App/App/public/**',
    ],
  },
});
