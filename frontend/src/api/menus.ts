/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Menus resolved from the backend seed. Mirrors backend/app/features/menus/router.py.
 */

import { api } from "./client";

export interface ApiMenuItem {
  id: string;
  label: string;
  icon: string; // icon name, resolved to a component on the client
}

export interface ApiMenuSection {
  id: string;
  label: string;
  items: ApiMenuItem[];
}

export interface Menu {
  key: string;
  section: string;
  section_label: string;
  label: string;
  icon: string;
  order: number;
}

export interface RoleDef {
  key: string;
  label: string;
  menu_keys: string[];
}

export const menusApi = {
  mine: () => api.get<{ menus: ApiMenuSection[] }>("/menus/me"),
  list: () => api.get<Menu[]>("/menus"),
  listRoles: () => api.get<RoleDef[]>("/menus/roles"),
  setRoleMenus: (key: string, menu_keys: string[]) => api.patch<RoleDef>(`/menus/roles/${key}`, { menu_keys }),
  createRole: (key: string, label: string) => api.post<RoleDef>("/menus/roles", { key, label }),
  deleteRole: (key: string) => api.del<void>(`/menus/roles/${key}`),
  createMenu: (menu: Menu) => api.post<Menu>("/menus", menu),
  updateMenu: (key: string, patch: Partial<Omit<Menu, "key">>) => api.patch<Menu>(`/menus/${key}`, patch),
  deleteMenu: (key: string) => api.del<void>(`/menus/${key}`),
};
