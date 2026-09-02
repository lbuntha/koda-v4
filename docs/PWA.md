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
XP and the learning log are all bundled JSON or `localStorage`, so every skill is
fully playable offline — nothing here is per skill. A skill's artwork is inlined
into the bundle as markup rather than fetched, so it precaches with the code that
draws it.

What needs a network, and what happens without one:

| Feature | Offline behaviour |
|---|---|
| Spoken prompts | A recorded clip if one has played before, then the browser's own speech synthesis, which is local |
| AI tutor replies | Falls back to `generateLocalSocraticResponse` |
| Live voice coach | Unavailable — it is a WebSocket to Gemini |
| Learning log | Records normally; a backend sink would queue (the local ring stays the source of truth) |

None of these is an error path: they were already written to fail soft, which is
why offline needed no new fallbacks.

## What is cached

`vite-plugin-pwa` (Workbox) precaches the built app — HTML, JS, CSS, icons,
fonts — 29 entries. `navigateFallback` sends any deep link to `index.html`, so
opening a saved URL offline still boots the app.

### Adding a skill downloads its voice

Enrolling in a skill is a row on the server and fetches nothing — the lessons,
the course order and the artwork are already in the bundle the worker precached.
Its recorded speech is not, so `prepareSkillOffline` (`lib/offlineSkill.ts`) runs
straight after a successful add and pulls the skill's clips plus the common
pack's through the worker's own route, reporting "Saving for offline… 31 of 70"
and ending with a sentence rather than a spinner.

Three things it is careful about, each of them a way to break the promise
quietly:

- **A skill with nothing recorded is ready, not failing.** It is genuinely
  playable offline; the message says spoken lines will use the device's voice
  until someone records it.
- **A failed download never costs the child the skill.** They stay enrolled; the
  rest is fetched next time, and only what is missing.
- **"Ready" is compared against what the build ships**, not stored as a boolean,
  so recording a skill's voice after a child downloaded it correctly reports the
  skill as no longer complete.

Recorded speech is the one thing deliberately left out of the precache, and cached
on first play instead (`koda-voice`, `CacheFirst`). Making a tablet pull every
clip during install — before a child has opened a single lesson — is a worse
first run than a lesson that is briefly silent. The cap is 1,000 entries, which
is several builds' worth: the cache now holds the common pack as well as each
skill's own clips, and the shared half is the worst thing in it to evict, since
losing `"seven"` costs every skill on the device its count-along.

`/api/*` is on the denylist. A cached tutor reply would be a stale answer to a
different question, which is worse than no reply.

## Where the worker lives

`src/pwa/sw.ts`, built in `injectManifest` mode: the rules above are code in
that file rather than configuration in `vite.config.ts`. They moved so that a
`push` handler has somewhere to live beside them — the alternative, Firebase's
own `firebase-messaging-sw.js`, is a second worker on this origin, which is the
failure the last section of this file is about. Nothing about what is cached
changed with the move: the same 29 entries, the same 1,559 KiB, the same rules.
`docs/PUSH.md` §3 is the reasoning.

Two things the port has to keep, because both fail silently:

- **The output is still `/sw.js`.** A worker under a new name leaves every
  installed copy of Koda listening for one that is never updated again.
- **The worker answers `SKIP_WAITING`.** `registerType: 'prompt'` meant Workbox
  wrote that listener; now the file does. Without it, "A new version is ready"
  is a button that does nothing.

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
