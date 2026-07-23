/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Loads the signed-in user's sidebar from the backend seed and maps icon names
 * to components. `allowedIds` is the flat set of menu ids for gating UI.
 */

import { useEffect, useState } from "react";
import { menusApi } from "../api/menus";
import { NavSection } from "../components/layout/DashboardLayout";
import { resolveIcon } from "./icons";

export function useMenus() {
  const [sections, setSections] = useState<NavSection[]>([]);
  const [allowedIds, setAllowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { menus } = await menusApi.mine();
        if (!active) return;
        setSections(
          menus.map((s) => ({
            id: s.id,
            label: s.label,
            items: s.items.map((i) => ({ id: i.id, label: i.label, icon: resolveIcon(i.icon) })),
          }))
        );
        setAllowedIds(new Set(menus.flatMap((s) => s.items.map((i) => i.id))));
      } catch {
        /* leave empty on failure */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { sections, allowedIds, loading };
}
