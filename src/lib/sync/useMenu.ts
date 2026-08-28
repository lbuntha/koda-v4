import { useSyncExternalStore } from "react";

import { Menu, type MenuItem } from "./menu";

/** The menu from the server, or `null` while only the bundled default is known. */
export const useMenu = (): MenuItem[] | null =>
  useSyncExternalStore(Menu.subscribe, Menu.items, Menu.items);
