/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Ask the browser to stop treating Koda's storage as disposable.
 *
 * By default every origin's Cache Storage *and* localStorage are "best effort": under disk
 * pressure the browser evicts them without asking. For a tab that only ever reads from the
 * network that is harmless. Here it would take the precached shell, the warmed artwork, the
 * cached lesson plan and the not-yet-synced attempt outbox with it — a child would open an
 * installed app on a full tablet and find nothing there.
 *
 * Asked once, and only after a learner has something worth keeping. Chrome decides silently
 * from engagement and installed state; Firefox shows a permission prompt, which is why this
 * is not called on a first anonymous page view.
 */

let asked = false;

export async function ensurePersistentStorage(): Promise<boolean> {
  if (asked) return false;
  asked = true;

  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage?.persist || !storage.persisted) return false;

  try {
    if (await storage.persisted()) return true; // Already granted in an earlier session.
    return await storage.persist();
  } catch {
    // Unsupported or blocked: offline still works, it is just evictable.
    return false;
  }
}
