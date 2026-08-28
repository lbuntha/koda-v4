# Installing and offline

Koda is a progressive web app: it installs to a home screen and a whole lesson
plays with no network.

## Trying it

```bash
npm run build && npm start      # production, service worker active
npm run dev                     # the worker also runs here (devOptions.enabled)
```

Then in Chrome: **⋮ → Cast, save and share → Install page as app**, or the
install icon in the address bar. To prove offline works, stop the server and
reload — the app still boots and a lesson is still playable.

## What works without a network

Everything a child does. Lessons, the course order, the level picker, progress,
XP and the learning log are all bundled JSON or `localStorage`, so counting is
fully playable offline.

What needs a network, and what happens without one:

| Feature | Offline behaviour |
|---|---|
| Spoken prompts | Falls back to the browser's own speech synthesis, which is local |
| AI tutor replies | Falls back to `generateLocalSocraticResponse` |
| Live voice coach | Unavailable — it is a WebSocket to Gemini |
| Learning log | Records normally; a backend sink would queue (the local ring stays the source of truth) |

None of these is an error path: they were already written to fail soft, which is
why offline needed no new fallbacks.

## What is cached

`vite-plugin-pwa` (Workbox) precaches the built app — HTML, JS, CSS, icons,
fonts — 19 entries. `navigateFallback` sends any deep link to `index.html`, so
opening a saved URL offline still boots the app.

`/api/*` is on the denylist. A cached tutor reply would be a stale answer to a
different question, which is worse than no reply.

## Updates

`registerType: 'prompt'`. A new build does **not** install itself: the child sees
"A new version is ready" and chooses. With `autoUpdate` a deploy can swap the app
out mid-round and lose the question they are on, and nothing here is urgent
enough to justify that.

The server sends `Cache-Control: no-cache` for `sw.js`, `index.html` and the
manifest, and `immutable` for content-hashed assets. A cached `sw.js` is the
classic way a PWA pins itself to an old build and stops taking updates.

## Icons

`npm run icons` rasterises `public/favicon.svg` into `public/icons/`. Output is
committed, so a normal build never needs sharp. Two shapes: plain icons, and
`maskable-*` padded 12% into the safe zone because Android crops adaptive icons
to a circle or squircle.

iOS reads none of the manifest's icons — only the `apple-touch-icon` link tag.

## Mobile behaviour

- `viewport-fit=cover` plus `env(safe-area-inset-*)` padding on `body`, so an
  installed app draws edge to edge without sliding under a notch or the home
  indicator.
- `touch-action: manipulation` — a counting game is a grid of things a child
  taps repeatedly, and double-tap zoom turns the second tap of a fast pair into
  a zoom instead of a count.
- `overscroll-behavior-y: none` stops the app rubber-banding when a child drags
  on a play area.
- Long-press callout and text selection are off for buttons, so holding a
  countable item counts it rather than selecting the emoji.


## Switching between `npm run dev` and a production build

They register different service workers on the same origin — `dev-sw.js` and
`sw.js` — and the one already installed keeps control. Load the production build
in a browser that has the dev worker installed and you get a **blank page**: the
dev worker answers, and the modules it points at are not there any more.

It looks like "offline is broken" and it is not. Clear it once, in the console:

```js
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
(await caches.keys()).forEach(k => caches.delete(k));
```

then reload twice — once for the right worker to install, once for it to take
control. DevTools → Application → Service Workers → *Update on reload* avoids
the whole thing while you are switching back and forth.
