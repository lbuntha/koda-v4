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
import { isApiConfigured, isOfflineError, tokenStore } from "../api/client";
import { accountKey, clearAllOfflineCache, readCache, writeCache } from "../api/offlineCache";
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
  /** The account came from the offline cache because the server could not be reached. */
  offlineSession: boolean;
  /** True only during the session transition immediately after a parent signs up. */
  parentOnboardingPending: boolean;
  completeParentOnboarding: () => void;
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
const PARENT_ONBOARDING_KEY = "koda_parent_onboarding_pending";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>(isApiConfigured() ? "loading" : "offline");
  const [account, setAccount] = useState<Account | null>(null);
  const [playSession, setPlaySession] = useState<PlaySession | null>(null);

  const [offlineSession, setOfflineSession] = useState(false);
  const [parentOnboardingPending, setParentOnboardingPending] = useState(() => {
    try {
      return sessionStorage.getItem(PARENT_ONBOARDING_KEY) === "1";
    } catch {
      return false;
    }
  });

  const updateParentOnboarding = useCallback((pending: boolean) => {
    setParentOnboardingPending(pending);
    try {
      if (pending) sessionStorage.setItem(PARENT_ONBOARDING_KEY, "1");
      else sessionStorage.removeItem(PARENT_ONBOARDING_KEY);
    } catch {
      // The in-memory state still provides the correct flow when storage is unavailable.
    }
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      writeCache(accountKey(), me); // Last known good identity, for an offline launch.
      setAccount(me);
      setOfflineSession(false);
      setStatus("authenticated");
    } catch (reason) {
      // An unreachable server says nothing about whether this session is still valid, so
      // the tokens stay and the learner keeps the identity they had. Only a server that
      // actually answered — a 401 from a revoked or expired session — signs them out.
      const cached = isOfflineError(reason) && tokenStore.access
        ? readCache<Account>(accountKey())
        : null;
      if (cached) {
        setAccount(cached.data);
        setOfflineSession(true);
        setStatus("authenticated");
        return;
      }
      tokenStore.clear();
      clearAllOfflineCache();
      setAccount(null);
      setOfflineSession(false);
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
    offlineSession,
    parentOnboardingPending,
    completeParentOnboarding: () => updateParentOnboarding(false),
    login: async (email, password) => {
      updateParentOnboarding(false);
      await authApi.login(email, password);
      await loadMe();
    },
    registerAdult: async (body) => {
      await authApi.registerAdult(body);
      updateParentOnboarding(body.role === "parent");
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
      clearAllOfflineCache();       // and no cached plan left for the next person
      setAccount(null);
      setPlaySession(null);
      setOfflineSession(false);
      updateParentOnboarding(false);
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
