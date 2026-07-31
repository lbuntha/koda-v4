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
  avatar?: string | null;
  disabled: boolean;
  family_code: string | null;
  child_count: number;
  menu_ids: string[];
}

export interface PaginatedUsers {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminStudent {
  id: string;
  name: string;
  avatar: string | null;
  has_pin: boolean;
  guardians: string[];
  guardian_parent_ids?: string[];
}

export const adminApi = {
  listUsers: (params?: { page?: number; limit?: number; search?: string; role?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.search) sp.set("search", params.search);
    if (params?.role) sp.set("role", params.role);
    const q = sp.toString();
    return api.get<PaginatedUsers>(`/admin/users${q ? `?${q}` : ""}`);
  },
  listStudents: () => api.get<AdminStudent[]>("/admin/students"),
  createUser: (body: { role: string; name: string; email: string; password: string; avatar?: string }) =>
    api.post<AdminUser>("/admin/users", body),
  setDisabled: (id: string, disabled: boolean) => api.patch<AdminUser>(`/admin/users/${id}`, { disabled }),
  setAvatar: (id: string, avatar: string) => api.patch<AdminUser>(`/admin/users/${id}`, { avatar }),
  setMenus: (id: string, menu_ids: string[]) => api.patch<AdminUser>(`/admin/users/${id}`, { menu_ids }),
  deleteUser: (id: string) => api.del<void>(`/admin/users/${id}`),
  deleteStudent: (id: string) => api.del<void>(`/admin/students/${id}`),
  resetPin: (id: string, pin: string) => api.post<AdminStudent>(`/admin/students/${id}/reset-pin`, { pin }),
};
