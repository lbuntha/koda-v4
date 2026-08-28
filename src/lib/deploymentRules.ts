/**
 * The reward rules the whole deployment shares: scoring, the streak rule, badges.
 *
 * These used to be family documents, synced through the same store as a child's
 * progress, and every family tuned their own. They are not that any more — one
 * operator decides what a star is worth and what a badge takes, and every family
 * inherits the answer, exactly as they inherit the switchboard.
 *
 * What has *not* changed is where a store reads from on this device. Each rule
 * still lives under the `localStorage` key its store already used, so a tablet
 * with no connection scores a round from the last rules it saw rather than
 * falling back to the shipped defaults mid-session. This module is only the two
 * ends of the wire: pull them all on boot, push one when an operator edits it.
 */

import { ApiError, accessToken, request } from "./sync";

/** The three rules, and the key each store reads on this device. */
export const RULE_KEYS = {
  scoring: "koda_scoring_v1",
  streak: "koda_streak_v1",
  badges: "koda_badges_v1",
} as const;

export type RuleKind = keyof typeof RULE_KEYS;

/**
 * Pull every rule and hand it to the store that owns it.
 *
 * Written to the store's own key and announced with a `storage` event — the
 * same path `apply.ts` used when these were synced documents, so each store
 * picks the change up by the route it already had and none of them needed to
 * learn where rules come from now.
 */
export async function refreshDeploymentRules(): Promise<void> {
  try {
    const token = await accessToken();
    if (!token) return;
    const body = await request<{ defaults: Partial<Record<RuleKind, unknown>> }>("/defaults", {
      token,
    });
    for (const [kind, value] of Object.entries(body.defaults ?? {})) {
      const key = RULE_KEYS[kind as RuleKind];
      if (!key || value == null) continue;
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(
        new StorageEvent("storage", { key, newValue: localStorage.getItem(key) }),
      );
    }
  } catch (error) {
    // A deployment that cannot be reached leaves the last rules in force, which
    // is the only answer that keeps a round scoreable.
    void (error as ApiError);
  }
}

/**
 * Save one rule for every family.
 *
 * Fire-and-forget from the store's point of view: the value is already in
 * `localStorage` and already on screen, and an operator who was refused finds
 * out when the page next loads rather than mid-keystroke. Refusal is the normal
 * case for anyone without `system:write`, and the server is what makes it true.
 */
export async function saveDeploymentRule(kind: RuleKind, value: unknown): Promise<void> {
  try {
    const token = await accessToken();
    if (!token) return;
    await request(`/defaults/${kind}`, { method: "PUT", token, body: { value } });
  } catch (error) {
    void (error as ApiError);
  }
}
