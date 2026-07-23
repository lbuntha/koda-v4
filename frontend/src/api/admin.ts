/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin account management. Mirrors backend/app/features/admin/router.py.
 */

import { api } from "./client";
import { Role } from "./auth";

export interface AdminUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  disabled: boolean;
  family_code: string | null;
  child_count: number;
  menu_ids: string[];
}

export interface AdminStudent {
  id: string;
  name: string;
  avatar: string | null;
  has_pin: boolean;
  guardians: string[];
}

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>("/admin/users"),
  listStudents: () => api.get<AdminStudent[]>("/admin/students"),
  createUser: (body: { role: string; name: string; email: string; password: string }) =>
    api.post<AdminUser>("/admin/users", body),
  setDisabled: (id: string, disabled: boolean) => api.patch<AdminUser>(`/admin/users/${id}`, { disabled }),
  setMenus: (id: string, menu_ids: string[]) => api.patch<AdminUser>(`/admin/users/${id}`, { menu_ids }),
  deleteUser: (id: string) => api.del<void>(`/admin/users/${id}`),
  deleteStudent: (id: string) => api.del<void>(`/admin/students/${id}`),
  resetPin: (id: string, pin: string) => api.post<AdminStudent>(`/admin/students/${id}/reset-pin`, { pin }),
};
