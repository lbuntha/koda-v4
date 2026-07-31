/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed calls against the backend /auth router. Mirrors backend/app/routers/auth.py.
 */

import { api, tokenStore } from "./client";

export type Role = "admin" | "teacher" | "parent" | "student";
/** Which student-page layout a learner sees, by grade band. */
export type GradeBand = "kid" | "student" | "focus";

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
  /** Student-page layout band, resolved from the kid's grade (students only). */
  gradeBand?: GradeBand;
  /** Per-user menu ids granted on top of the role's menus (admin-assignable). */
  menu_ids?: string[] | null;
  /** Parents only — one opt-out per notification feature they can receive by email. */
  email_digest_enabled?: boolean;
  email_inactivity_enabled?: boolean;
  email_announcements_enabled?: boolean;
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

  /**
   * Ask for a reset link. Always resolves the same way — the server deliberately does not
   * say whether the address has an account, and the UI must not imply otherwise.
   */
  requestPasswordReset: (email: string) =>
    api.post<{ detail: string }>("/auth/password-reset/request", { email }),

  /** Spend a reset link. Signs the parent straight in on success. */
  confirmPasswordReset: (token: string, password: string) =>
    api.post<TokenPair>("/auth/password-reset/confirm", { token, password }).then(store),

  me: () => api.get<Account>("/auth/me"),

  updateProfile: (body: { name?: string; email?: string; avatar?: string; current_password?: string; new_password?: string }) =>
    api.patch<Account>("/auth/profile", body),

  updateStudentAvatar: (avatar: string) => api.patch<{ avatar: string }>("/auth/student/avatar", { avatar }),

  logout: () => tokenStore.clear(),
};
