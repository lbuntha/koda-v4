/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App-wide auth state. Wrap the app in <AuthProvider> and read it with useAuth().
 *
 * In "offline mode" (VITE_API_URL unset) status resolves to "offline" and the
 * app should behave exactly as it does today (localStorage, no login) — so this
 * provider is safe to mount before the backend exists.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { isApiConfigured, tokenStore } from "../api/client";
import { authApi, Account, Role } from "../api/auth";

type Status = "loading" | "offline" | "authenticated" | "anonymous";

interface AuthState {
  status: Status;
  account: Account | null;
  role: Role | null;
  isStudent: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerAdult: (body: { role: "parent" | "teacher" | "admin"; email: string; password: string; name: string }) => Promise<void>;
  studentLogin: (familyCode: string, name: string, pin: string) => Promise<void>;
  launchChild: (studentId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>(isApiConfigured() ? "loading" : "offline");
  const [account, setAccount] = useState<Account | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      setAccount(me);
      setStatus("authenticated");
    } catch {
      tokenStore.clear();
      setAccount(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    if (!isApiConfigured()) return; // stay "offline"
    if (tokenStore.access) loadMe();
    else setStatus("anonymous");
  }, [loadMe]);

  const afterAuth = useCallback(async () => {
    await loadMe();
  }, [loadMe]);

  const value: AuthState = {
    status,
    account,
    role: account?.role ?? null,
    isStudent: account?.role === "student",
    login: async (email, password) => {
      await authApi.login(email, password);
      await afterAuth();
    },
    registerAdult: async (body) => {
      await authApi.registerAdult(body);
      await afterAuth();
    },
    studentLogin: async (familyCode, name, pin) => {
      await authApi.studentLogin(familyCode, name, pin);
      await afterAuth();
    },
    launchChild: async (studentId) => {
      await authApi.launchChild(studentId);
      await afterAuth();
    },
    logout: () => {
      authApi.logout();
      setAccount(null);
      setStatus("anonymous");
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
