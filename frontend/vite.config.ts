import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // "prompt", not "autoUpdate": a child mid-activity should never have the page
        // swapped underneath them. The new worker waits until they accept the toast.
        registerType: 'prompt',
        injectRegister: null, // registration lives in src/pwa/PwaPrompts.tsx
        // The icons are already matched by the `icons/*.png` glob below; leaving this on
        // listed each of them twice in the precache manifest.
        includeManifestIcons: false,
        manifest: {
          name: 'Learn with Koda',
          short_name: 'Koda',
          description:
            'A playful learning app where children practice skills, explore ideas, and grow with confidence.',
          id: '/',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'any',
          background_color: '#F3F0FC',
          theme_color: '#6B46C1',
          lang: 'en',
          categories: ['education', 'kids'],
          shortcuts: [
            {
              name: 'Student Learn',
              short_name: 'Learn',
              description: 'Open student learning player',
              url: '/?role=student',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'Parent Dashboard',
              short_name: 'Parent',
              description: 'View child progress and achievements',
              url: '/?role=parent',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'Curriculum Studio',
              short_name: 'Studio',
              description: 'Design and preview learning canvases',
              url: '/?role=teacher',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
          ],
          icons: [
            {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
            {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
            // Padded copies: a maskable icon is cropped to the platform's shape, and the
            // full-bleed "K" loses its arms to a circle mask without the safe-zone margin.
            {src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable'},
            {src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
        },
        workbox: {
          // Precache the shell only. `public/assets/` alone is ~12 MB of artwork, and
          // precaching downloads everything before the app is usable; the images are
          // picked up by the runtime cache below as a child actually meets them.
          globPatterns: ['**/*.{js,css,html,woff2}', 'favicon.svg', 'icons/*.png'],
          // `icon-*-v3.png` are unreferenced duplicates of the icons above; precaching
          // them cost ~108 kB of a first install for files nothing ever requests.
          globIgnores: ['**/icons/*-v3.png'],
          // The lazily-loaded role bundles are the largest chunks; keep the ceiling
          // above them so none is silently dropped from the precache manifest.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            // Under Docker the API is same-origin at /api/ — an offline navigation
            // fallback there would answer a fetch with the HTML shell.
            /^\/api\//,
            /^\/learning\/assets\//,
          ],
          runtimeCaching: [
            {
              // Artwork, mascots, level backgrounds: immutable in practice, worth
              // keeping so a lesson replays with no network.
              //
              // Matched by extension as well as by destination: warmAssetCache pulls the
              // artwork for today's queue down ahead of time with `fetch`, whose request
              // destination is empty rather than "image", so a destination-only rule
              // downloaded those files without ever storing them.
              urlPattern: ({request, sameOrigin, url}) =>
                sameOrigin
                && (request.destination === 'image'
                  || /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(url.pathname)),
              handler: 'CacheFirst',
              options: {
                cacheName: 'koda-images',
                expiration: {maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            {
              // Audio effects & speech sound files: cache for complete offline gameplay
              urlPattern: ({request, sameOrigin, url}) =>
                sameOrigin && (request.destination === 'audio' || /\.(mp3|wav|ogg|aac|m4a)$/i.test(url.pathname)),
              handler: 'CacheFirst',
              options: {
                cacheName: 'koda-audio',
                expiration: {maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            {
              // Published release artwork served *by the API* (`/learning/assets/...`).
              // These are files, not data — cached for offline play.
              urlPattern: ({url}) => url.pathname.includes('/learning/assets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'koda-learning-assets',
                expiration: {maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            {
              // Curriculum & student API data endpoints: StaleWhileRevalidate for instant offline loading
              urlPattern: ({url}) => url.pathname.includes('/api/v1/learning/') || url.pathname.includes('/api/v1/curriculum/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'koda-api-data',
                expiration: {maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            {
              urlPattern: ({url}) => url.origin === 'https://fonts.googleapis.com',
              handler: 'StaleWhileRevalidate',
              options: {cacheName: 'google-fonts-stylesheets'},
            },
            {
              urlPattern: ({url}) => url.origin === 'https://fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
          ],
        },
        devOptions: {
          // Off by default: a service worker caching in development hides edits behind
          // a stale shell. `VITE_PWA_DEV=true npm run dev` to exercise the worker.
          enabled: process.env.VITE_PWA_DEV === 'true',
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          // React changes on its own schedule, not ours. Splitting it out means an app
          // deploy does not invalidate a cached copy of the framework.
          //
          // Matched by path rather than by package name: the app imports `react-dom/client`,
          // a deep entry point that the name-keyed form does not catch — it produced a 12 kB
          // "react" chunk while react-dom stayed in the entry.
          manualChunks(id: string) {
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
