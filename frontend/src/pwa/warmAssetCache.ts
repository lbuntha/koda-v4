/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pull the artwork for a loaded plan into the service worker's runtime image cache while
 * the network is still there.
 *
 * Without this, offline play degrades into a wall of broken images: the runtime cache is
 * CacheFirst, so it only holds pictures a child has already been shown. The skills sitting
 * in today's queue are exactly the ones they are about to open, which makes them worth
 * fetching a few seconds early.
 *
 * Failures are silent by design — a warmed cache is a nicety, and a child who is online
 * should never see an error because a thumbnail for later did not download.
 */

/** Small enough not to compete with the lesson the learner is already loading. */
const CONCURRENCY = 4;

const alreadyWarmed = new Set<string>();

export async function warmAssetCache(
  urls: (string | null | undefined)[],
  concurrency: number = CONCURRENCY,
): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.onLine) return;
  // No worker, no runtime cache to fill: the fetches would be pure waste.
  if (!navigator.serviceWorker?.controller) return;

  const pending = [...new Set(urls.filter((url): url is string => !!url))]
    .filter(url => !alreadyWarmed.has(url));
  if (pending.length === 0) return;

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < pending.length) {
      const url = pending[cursor++];
      try {
        await fetch(url, { credentials: "omit" });
        alreadyWarmed.add(url);
      } catch {
        // Offline again, or a 404 on authored artwork. Try again next load.
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
}
