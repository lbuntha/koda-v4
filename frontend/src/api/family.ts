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
  grade_level?: string | null;
  primary_subject?: string | null;
  profile_gender?: "boy" | "girl" | null;
  learning_goals?: string[];
  birth_year?: number | null;
  has_pin: boolean;
  /** ISO timestamp while too many wrong PINs have locked this child out; null otherwise. */
  pin_locked_until?: string | null;
}

export interface ChildInput {
  name: string;
  avatar?: string | null;
  grade_level?: string | null;
  primary_subject?: string | null;
  profile_gender?: "boy" | "girl" | null;
  learning_goals?: string[];
  placement_required?: boolean;
  birth_year?: number | null;
  pin?: string | null;
}

export const familyApi = {
  list: () => api.get<Child[]>("/family/children"),
  add: (body: ChildInput) => api.post<Child>("/family/children", body),
  update: (id: string, body: Partial<ChildInput>) => api.patch<Child>(`/family/children/${id}`, body),
  remove: (id: string) => api.del<void>(`/family/children/${id}`),
  unlockPin: (id: string) => api.post<Child>(`/family/children/${id}/unlock-pin`, {}),
};
