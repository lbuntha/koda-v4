/// <reference lib="webworker" />

/**
 * Koda's service worker.
 *
 * Everything here was `workbox` configuration in `vite.config.ts` until the
 * build moved to `injectManifest`. The move buys one thing: a file we own, and
 * therefore somewhere a `push` handler can live. The alternative — the Firebase
 * SDK's `firebase-messaging-sw.js` — is a *second* worker on this origin, and
 * the last section of `docs/PWA.md` is a whole page about what two workers on
 * this origin cost. See `docs/PUSH.md` §3.
 *
 * The caching rules below are ported unchanged, comments included, because the
 * comments are the reasons. Nothing about what is cached, or for how long,
 * changed with the move; a build from before this file and a build from after
 * it should be indistinguishable from a tablet in a drawer.
 *
 * The two push handlers are at the bottom. They are the only thing in this file
 * that is not a port.
 */

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import type { PrecacheEntry } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { safeParse } from "./pushPayload";

// File-scoped, because this module has imports: it shadows the global `self`
// with the worker type rather than colliding with it.
declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | PrecacheEntry)[];
};

/*
 * A new build does **not** install itself: the child sees "A new version is
 * ready" and chooses (`registerType: 'prompt'`). This listener is the half of
 * that conversation the worker owns — without it the button in the app posts
 * `SKIP_WAITING` into the void and nothing happens, which looks like an update
 * that will not install rather than a missing line in a service worker.
 */
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | undefined)?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

// Everything the app needs to run is precached, so a cold start with no network
// still reaches a playable lesson: lessons and the course are bundled JSON, and
// progress lives in localStorage.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// A deep link opened offline must still boot the app rather than 404. The
// denylist is the API, which is online-only by design; a cached tutor reply
// would be a stale answer to a different question.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//],
  }),
);

// Fonts and images fetched at runtime: serve from cache when offline, refresh
// in the background when not.
registerRoute(
  ({ request }) => request.destination === "image" || request.destination === "font",
  new StaleWhileRevalidate({
    cacheName: "koda-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

/*
 * Recorded speech: cached the first time it plays, then offline.
 *
 * The precache list above deliberately does not include audio. A skill's clips
 * are ~22MB of WAV, and making a child's tablet pull all of it during install —
 * before they have opened a single lesson — is a worse first run than a lesson
 * that is briefly silent. Caching on first play spreads that cost across the
 * lessons they actually reach, and by the second visit every line they have
 * heard is local.
 *
 * `CacheFirst`, not `StaleWhileRevalidate`: these files are content-addressed by
 * the build, so a changed recording arrives under a new URL and there is nothing
 * to revalidate.
 *
 * Once the clips are mp3 rather than WAV (roughly a fifth the size) precaching
 * them outright becomes reasonable, and this becomes the fallback rather than
 * the mechanism.
 */
registerRoute(
  ({ request, url }) => request.destination === "audio" || /\.(wav|mp3|ogg|m4a)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: "koda-voice",
    plugins: [
      /*
       * Room for every skill in the build, several times over.
       *
       * 400 was written when a skill owned all of its own clips and the cache
       * held one collection at a time. It now holds the common pack as well —
       * the numbers and neutral praise every skill draws on — which is the worst
       * thing in here to lose: evicting a skill's own line costs that skill one
       * phrase, evicting "seven" costs every skill on the device its count-along.
       * Three voices come to 237 today, so the old cap was two skills away from
       * quietly evicting the shared half.
       */
      new ExpirationPlugin({ maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 180 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);


/* ------------------------------------------------------------------ *
 * Notifications
 *
 * The server sends `data` and no `notification` block, so nothing is drawn
 * until this file draws it. That is the point: the copy, the icon and the tap
 * target stay ours, foreground and background take one code path, and a page
 * that is already open does not get an OS toast *and* an in-app one.
 * ------------------------------------------------------------------ */

/**
 * Focus the window Koda is already open in, rather than opening a second one.
 *
 * A child may be mid-lesson in the tab that exists; opening another copy of the
 * app beside it is how a parent's tap loses somebody's round.
 */
async function focusOrOpen(path: string): Promise<void> {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of windows) {
    if (new URL(client.url).origin === self.location.origin) {
      // The app has no URL routing yet — tabs are state — so the path is sent
      // as a message for it to act on rather than navigated to.
      client.postMessage({ type: "KODA_NOTIFICATION_CLICK", path });
      await client.focus();
      return;
    }
  }

  await self.clients.openWindow(path);
}

self.addEventListener("push", (event) => {
  // Always show something. A push event that resolves without a notification is
  // what makes Chrome post "This site has been updated in the background" — a
  // notice in words nobody here chose. `safeParse` is written so that every
  // path through it returns a message worth reading.
  const payload = safeParse(event.data?.text());

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-64.png",
        // A second "Mia met her goal" replaces the first rather than stacking
        // two of the same sentence on a lock screen.
        tag: payload.tag,
        data: { path: payload.path, kind: payload.kind },
      });

      // If the app is open, tell it — a summary that just arrived is a reason
      // to refresh the screen behind the notification.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({ type: "KODA_PUSH", kind: payload.kind, path: payload.path });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data as { path?: string } | undefined)?.path ?? "/";
  event.waitUntil(focusOrOpen(path));
});
