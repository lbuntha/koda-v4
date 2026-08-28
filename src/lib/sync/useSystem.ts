import { useSyncExternalStore } from "react";

import { System } from "./system";

/** `allows("ai.liveVoice")`, live — re-renders when an operator throws a switch. */
export const useSystem = () => {
  useSyncExternalStore(System.subscribe, System.snapshot, System.snapshot);
  return { allows: System.allows, notice: System.notice() };
};
