import { useSyncExternalStore } from "react";

import { Permissions } from "./permissions";

/** `can("settings:write")`, live — re-renders when the table or the role changes. */
export const usePermissions = (): { can: (permission: string) => boolean; known: boolean } => {
  useSyncExternalStore(Permissions.subscribe, Permissions.snapshot, Permissions.snapshot);
  return { can: Permissions.can, known: Permissions.known() };
};
