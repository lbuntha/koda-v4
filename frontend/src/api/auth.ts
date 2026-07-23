/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed calls against the backend /auth router. Mirrors backend/app/routers/auth.py.
 */

import { api, tokenStore } from "./client";

export type Role = "admin" | "teacher" | "parent" | "student";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: Role;
}

export interface Account {
  id: string;
  role: Role;
  name: string;
  email?: string;
  family_code?: string | null;
  avatar?: string | null;
  /** Per-user menu ids granted on top of the role's menus (admin-assignable). */
  menu_ids?: string[] | null;
}

function store(pair: TokenPair): TokenPair {
  tokenStore.set(pair.access_token, pair.refresh_token);
  return pair;
}

export const authApi = {
  registerAdult: (body: { role: "parent" | "teacher"; email: string; password: string; name: string }) =>
    api.post<TokenPair>("/auth/register", body).then(store),

  login: (email: string, password: string) =>
    api.postForm<TokenPair>("/auth/login", { username: email, password }).then(store),

  /** Kid, independent: family code + name + PIN. */
  studentLogin: (family_code: string, name: string, pin: string) =>
    api.post<TokenPair>("/auth/student/login", { family_code, name, pin }).then(store),

  /** Kid, parent-launched: requires a logged-in parent session. */
  launchChild: (student_id: string) =>
    api.post<TokenPair>("/auth/student/launch", { student_id }).then(store),

  me: () => api.get<Account>("/auth/me"),

  logout: () => tokenStore.clear(),
};
