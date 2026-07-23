/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Loads and mutates the signed-in parent's kids via the family API.
 */

import { useCallback, useEffect, useState } from "react";
import { familyApi, Child, ChildInput } from "../api/family";

export function useFamily() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setChildren(await familyApi.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your kids");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    children,
    loading,
    error,
    refresh,
    addChild: async (body: ChildInput) => {
      await familyApi.add(body);
      await refresh();
    },
    updateChild: async (id: string, body: Partial<ChildInput>) => {
      await familyApi.update(id, body);
      await refresh();
    },
    removeChild: async (id: string) => {
      await familyApi.remove(id);
      await refresh();
    },
  };
}
