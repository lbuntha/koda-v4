/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Parent-facing kid management. Mirrors backend/app/features/family/router.py.
 */

import { api } from "./client";

export interface Child {
  id: string;
  name: string;
  avatar: string | null;
  has_pin: boolean;
}

export interface ChildInput {
  name: string;
  avatar?: string | null;
  pin?: string | null;
}

export const familyApi = {
  list: () => api.get<Child[]>("/family/children"),
  add: (body: ChildInput) => api.post<Child>("/family/children", body),
  update: (id: string, body: Partial<ChildInput>) => api.patch<Child>(`/family/children/${id}`, body),
  remove: (id: string) => api.del<void>(`/family/children/${id}`),
};
