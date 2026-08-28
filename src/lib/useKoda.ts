import { useSyncExternalStore } from "react";

import { Billing } from "./billing";
import { ChildSettingsAPI } from "./childSettings";
import { System } from "./sync";
import {
  askKoda,
  kodaAccess,
  preferredKodaMode,
  type KodaAccess,
  type KodaAskMode,
  type KodaCapability,
} from "./koda";

/**
 * `kodaAccess`, live.
 *
 * Subscribes to all three answers — the operator's switchboard, the family's
 * plan, the parent's switch — so a component redraws the moment any of them
 * changes. Which matters most for the first: an operator switching Ask Koda off
 * should empty the buttons on a child's tablet at the next refresh, not at the
 * next reload.
 *
 * Reads, never fetches. `App` refreshes all three when an account appears.
 */
export const useKoda = (): {
  access: (capability: KodaCapability) => KodaAccess;
  allows: (capability: KodaCapability) => boolean;
  ask: (capability: KodaCapability, action: () => void) => boolean;
  /** What a single tap opens — voice where it runs. `null` means offer nothing. */
  mode: KodaAskMode | null;
} => {
  useSyncExternalStore(System.subscribe, System.snapshot, System.snapshot);
  useSyncExternalStore(Billing.subscribe, Billing.version, Billing.version);
  useSyncExternalStore(ChildSettingsAPI.subscribe, ChildSettingsAPI.version, ChildSettingsAPI.version);

  return {
    access: kodaAccess,
    allows: (capability) => kodaAccess(capability).allowed,
    ask: askKoda,
    mode: preferredKodaMode(),
  };
};
