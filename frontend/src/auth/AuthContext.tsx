/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App-wide auth state. Wrap the app in <AuthProvider> and read it with useAuth().
 *
 * In "offline mode" (VITE_API_URL unset) status resolves to "offline" and the
 * app behaves exactly as before (localStorage, no login).
 *
 * Parent → kid play: startChildPlay() stashes the parent's tokens and activates
 * the kid's, so the app renders the game as that student; endChildPlay() restores
 * the parent. A refresh mid-play also returns to the parent (see the mount effect).
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { isApiConfigured, tokenStore } from "../api/client";
import { authApi, Account, Role } from "../api/auth";

type Status = "loading" | "offline" | "authenticated" | "anonymous";

interface PlaySession {
  childId: string;
  childName: string;
}

interface AuthState {
  status: Status;
  account: Account | null;
  role: Role | null;
  isStudent: boolean;
  /** Non-null while a parent is playing as one of their kids. */
  playSession: PlaySession | null;
  login: (email: string, password: string) => Promise<void>;
  registerAdult: (body: { role: "parent" | "teacher"; email: string; password: string; name: string }) => Promise<void>;
  studentLogin: (familyCode: string, name: string, pin: string) => Promise<void>;
  startChildPlay: (childId: string, childName: string) => Promise<void>;
  endChildPlay: () => Promise<void>;
  logout: () => void;
  /** Re-reads the account for tokens obtained outside a login call (e.g. a password reset). */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>(isApiConfigured() ? "loading" : "offline");
  const [account, setAccount] = useState<Account | null>(null);
  const [playSession, setPlaySession] = useState<PlaySession | null>(null);

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
    // A refresh during parent-launched play returns to the parent, never a stranded kid.
    if (tokenStore.hasGuardianStash()) tokenStore.restoreGuardian();
    if (tokenStore.access) loadMe();
    else setStatus("anonymous");
  }, [loadMe]);

  const value: AuthState = {
    status,
    account,
    role: account?.role ?? null,
    isStudent: account?.role === "student",
    playSession,
    login: async (email, password) => {
      await authApi.login(email, password);
      await loadMe();
    },
    registerAdult: async (body) => {
      await authApi.registerAdult(body);
      await loadMe();
    },
    studentLogin: async (familyCode, name, pin) => {
      await authApi.studentLogin(familyCode, name, pin);
      await loadMe();
    },
    startChildPlay: async (childId, childName) => {
      tokenStore.stashGuardian();          // keep the parent's session
      await authApi.launchChild(childId);  // activate the kid's token
      setPlaySession({ childId, childName });
      await loadMe();                      // role becomes "student"
    },
    endChildPlay: async () => {
      tokenStore.restoreGuardian();        // back to the parent's token
      setPlaySession(null);
      await loadMe();
    },
    refreshSession: loadMe,
    logout: () => {
      authApi.logout();
      tokenStore.restoreGuardian(); // clear any stash too
      setAccount(null);
      setPlaySession(null);
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
