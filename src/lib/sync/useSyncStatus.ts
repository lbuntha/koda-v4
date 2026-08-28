import { useSyncExternalStore } from "react";

import { SyncEngine, type SyncStatus } from "./engine";

/** Live upload state, for the quiet corner in `PwaStatus`. */
export const useSyncStatus = (): SyncStatus =>
  useSyncExternalStore(SyncEngine.subscribe, SyncEngine.status, SyncEngine.status);
