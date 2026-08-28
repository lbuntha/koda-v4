import { useSyncExternalStore } from "react";

import { SessionAPI, type Session } from "./session";

/** The signed-in state, live. Same store pattern as `useLearningPlugins`. */
export const useSession = (): Session | null =>
  useSyncExternalStore(SessionAPI.subscribe, SessionAPI.current, () => null);
