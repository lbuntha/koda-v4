/**
 * "Do this, unless the plan does not cover it."
 *
 * Every paid surface asks the same question in the same order — is this feature
 * included, and if not, what do we say instead — and the answer has to be the
 * same sentence every time. Written per button, it would drift: one screen
 * would hide, another would fail on the tap, a third would name the wrong plan.
 *
 * So a call site is one line:
 *
 *     onClick={() => requireFeature(AI_FEATURE, () => setVoiceOpen(true))}
 *
 * and the app mounts `<UpgradePrompt />` once. Nothing else needs to know what a
 * plan is, and a feature that becomes free later stops prompting everywhere at
 * once because `Billing` starts including it.
 *
 * None of this is enforcement. The server refuses whatever this allows — see
 * `planAllows` in `server.ts` and the 402 on `POST /learners`. This decides what
 * a person is *told*, which is the part a refusal is bad at.
 */

import { AI_FEATURE, Billing } from "./billing";
import { ChildSettingsAPI } from "./childSettings";

let pending: string | null = null;
let withheld: string | null = null;
let version = 0;
const listeners = new Set<() => void>();

const notify = () => {
  version += 1;
  for (const cb of listeners) cb();
};

export const FeatureGate = {
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** The feature somebody just asked for and the *plan* does not cover, if any. */
  pending: (): string | null => pending,

  /**
   * Why a grown-up in this family has switched something off, if they have.
   *
   * Kept apart from `pending` because they are different sentences with
   * different remedies: one is answered by a plan, the other by asking the
   * person who set it. Telling a child to upgrade when their mother turned
   * something off is both wrong and unactionable.
   */
  withheld: (): string | null => withheld,

  dismiss(): void {
    pending = null;
    withheld = null;
    notify();
  },
};

/**
 * Run `action` if the family's plan includes `feature`; otherwise explain.
 *
 * Returns whether it ran, for the rare caller that needs to know — most do not,
 * because the explaining is already handled.
 */
export function requireFeature(feature: string, action: () => void): boolean {
  if (Billing.has(feature)) {
    action();
    return true;
  }
  pending = feature;
  notify();
  return false;
}

/**
 * Run `action` if this child may use Koda's help.
 *
 * Two gates, and the order is the product decision. The plan is asked first
 * because it is the outer constraint — a family without `ai.koda` has nothing
 * for a parent to switch off — and the parent's own switch is asked second, so
 * a family who pays for Koda and then turns it off for one child gets the
 * sentence that matches.
 */
export function requireKodaHelp(action: () => void): boolean {
  // Tracked rather than returned straight from `requireFeature`: that reports
  // whether the *plan* allowed it, which is true even when the parent's switch
  // then stopped the action — and every caller reads this as "did it run".
  let ran = false;
  requireFeature(AI_FEATURE, () => {
    if (!ChildSettingsAPI.current().aiHelpEnabled) {
      withheld = AI_FEATURE;
      notify();
      return;
    }
    ran = true;
    action();
  });
  return ran;
}
