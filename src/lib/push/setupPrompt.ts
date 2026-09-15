/**
 * Whether to ask an adult, as the app opens, to turn notifications on.
 *
 * The ask is Koda's own sheet with Set up and Skip — never the browser's
 * permission prompt. That one is spent for good on a single refusal, so it is
 * still raised only by the switch in Settings, which is where Set up leads.
 *
 * Asked only when saying yes could work: a browser that is blocked, cannot do
 * push, or a deployment with no Firebase project is not asked at all. An iPhone
 * in a Safari tab is, because Settings tells it the one step that is missing.
 */

import type { PushSupport } from "./support";

const SKIP_KEY = "koda_push_setup_skipped_v1";

/** How long Skip keeps the sheet away, per account on this device. */
export const SKIP_DAYS = 7;

const DAY_MS = 86_400_000;

export interface SetupAsker {
  userId?: string;
  learnerId?: string;
  role: string;
}

function skips(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SKIP_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function skipNotificationSetup(userId: string, now = Date.now()): void {
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify({ ...skips(), [userId]: now }));
  } catch {
    // Storage disabled: the sheet comes back next launch, which is the worst of it.
  }
}

export function shouldOfferNotificationSetup(
  asker: SetupAsker | null,
  support: PushSupport,
  on: boolean,
  now = Date.now(),
): boolean {
  if (!asker?.userId) return false;
  // A child's device never holds a token, so it is never asked.
  if (asker.learnerId || asker.role === "child" || asker.role === "student") return false;
  if (on) return false;
  if (support.state !== "askable" && support.state !== "granted" && support.state !== "needs-install") {
    return false;
  }
  const skippedAt = skips()[asker.userId];
  return !(typeof skippedAt === "number" && now - skippedAt < SKIP_DAYS * DAY_MS);
}
