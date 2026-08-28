import { useSyncExternalStore } from "react";

import { AI_FEATURE, Billing, type Entitlements } from "./billing";

/**
 * The family's plan, kept current while a component is mounted.
 *
 * Reads, never fetches. `App` refreshes the plan when an account appears, the
 * same place it refreshes permissions and the switchboard — a hook that fetched
 * would mean one request per component that wanted to know, for a value that
 * changes when somebody pays and not while a child is mid-round.
 */
export const useBilling = (): Entitlements & { has: (feature: string) => boolean; ai: boolean } => {
  useSyncExternalStore(Billing.subscribe, Billing.version, Billing.version);

  const plan = Billing.current();
  return {
    ...plan,
    has: (feature: string) => plan.features.includes(feature),
    /** The one that matters today: may this family ask Koda anything at all. */
    ai: plan.features.includes(AI_FEATURE),
  };
};
