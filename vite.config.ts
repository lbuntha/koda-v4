import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    // Vitest runs the same resolution as the app, so a test imports a skill by
    // the path the app uses. jsdom because activities are React components a
    // child clicks; there is nothing to assert about a round without a DOM.
    test: {
      environment: 'jsdom',
      globals: false,
      // `tutor/` too: the Koda character frame is the tutor server's, not the
      // browser's, but it is the one place a character becomes a prompt and it
      // has to be pinned somewhere the normal test run reaches.
      include: ['src/**/*.test.{ts,tsx}', 'tutor/**/*.test.ts'],
      setupFiles: ['src/skills/kit/testing/setup.ts'],
      restoreMocks: true,
      /*
       * A round test drives five whole questions through a real React tree —
       * mounting an activity, tapping every object, waiting on springs and on
       * the pause that lets the last number be heard. That is comfortably under
       * a second on an idle machine and intermittently over five when the suite
       * runs its files in parallel and the workers contend for CPU.
       *
       * Raised rather than shaved, because the tests are not doing anything
       * wasteful: the default budget was written for unit tests and these are
       * closer to integration. A flaky suite is worse than a slow one — it
       * teaches everybody to re-run rather than to read the failure.
       */
      testTimeout: 20_000,
    },
    build: {
      rollupOptions: {
        output: {
          /*
           * Keep the Firebase SDK in a chunk with a name we can point at.
           *
           * It is loaded only when a parent turns notifications on, and the
           * precache glob below excludes it by that name — otherwise every
           * child's tablet would download 100KB of messaging SDK during
           * install, for a feature most of them will never use. Rollup names
           * these `index.esm-<hash>.js` on its own, which is not something a
           * glob can single out.
           */
          manualChunks(id: string) {
            if (id.includes("node_modules/@firebase") || id.includes("node_modules/firebase")) {
              return "firebase";
            }
            return undefined;
          },
        },
      },
    },

    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // The child is told about an update and chooses when to take it. With
        // `autoUpdate` a new deploy can swap the app out mid-round and lose the
        // question they are on; nothing here is urgent enough to justify that.
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],

        manifest: {
          name: 'Learn with Koda',
          short_name: 'Koda',
          // What a parent reads on the install prompt and the store card. The
          // same sentence as the sign-in screen, kept specific for the same
          // reason: the techniques are what make this app recognisable, and the
          // age band alone is what every other children's app also says.
          description:
            'Counting, addition, number bonds — reading next. Ages 5–11. Works offline, no ads.',
          lang: 'en',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          // Children hold a tablet whichever way they like, and the layout is
          // responsive, so locking orientation would only get in the way.
          orientation: 'any',
          background_color: '#F0F4FF',
          theme_color: '#6B46C1',
          categories: ['education', 'kids'],
          icons: [
            {src: '/icons/icon-64.png', sizes: '64x64', type: 'image/png'},
            {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
            {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'},
            // Android crops adaptive icons to a circle or squircle; these are
            // padded into the safe zone so the mark survives the crop.
            {
              src: '/icons/maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },

        // The caching rules now live in `src/pwa/sw.ts` — a file we own, and so
        // a file a `push` handler can live in. See the comment at the top of it
        // and docs/PUSH.md §3. What is precached did not change with the move;
        // it is stated here and injected into the worker as `__WB_MANIFEST`.
        strategies: 'injectManifest',
        srcDir: 'src/pwa',
        // The source. The build still emits `/sw.js`, which matters: a worker
        // under a new name would leave every installed copy of Koda listening
        // for one that is never updated again.
        filename: 'sw.ts',
        injectManifest: {
          // Everything the app needs to run, so a cold start with no network
          // still reaches a playable lesson.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          // …except the messaging SDK. A child playing a counting game offline
          // never needs it, and a parent turning notifications on is online by
          // definition — registering a token is a round trip. Precaching it
          // would put 100KB into every install to save nothing.
          globIgnores: ['**/node_modules/**/*', '**/firebase-*.js'],
        },

        devOptions: {
          // Lets the service worker be exercised with `npm run dev` instead of
          // only after a production build.
          enabled: true,
          type: 'module',
          // `injectManifest` builds our own worker in dev too, where the
          // precache manifest would otherwise be empty — this is what puts
          // index.html in it, so the navigation fallback has a page to be
          // bound to rather than throwing on the first navigation.
          navigateFallback: 'index.html',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
