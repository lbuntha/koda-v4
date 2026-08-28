import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ApiError, request } from "./sync/api";
import { accessToken, SessionAPI, type Session } from "./sync/session";
import { useSession } from "./sync/useSession";
import { refreshMaintenanceVersions } from "./maintenanceReset";

// v2 is the clean enrollment epoch after the 2026-08-21 test reset. Ignoring
// the old outbox matters as much as ignoring its cache: otherwise an online
// event can silently re-register everything the reset removed from Mongo.
const CACHE_KEY = "koda_skill_registrations_v2";
const OUTBOX_KEY = "koda_skill_registration_outbox_v2";
const LEGACY_KEYS = ["koda_skill_registrations_v1", "koda_skill_registration_outbox_v1"];

try {
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
} catch {
  /* blocked storage already cannot restore a legacy registration */
}

export interface SkillRegistration {
  skillId: string;
  registeredAt: number;
}

type RegistrationCache = Record<string, SkillRegistration[]>;
type RegistrationOutbox = Record<string, Record<string, "register" | "unregister">>;

let version = 0;
let flushing: Promise<void> | null = null;
const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* in-memory session still works when storage is unavailable */
  }
}

export function skillRegistrationScope(session: Session | null): string | null {
  if (!session) return null;
  if (session.learnerId) return `learner:${session.learnerId}`;
  if (session.userId) return `user:${session.userId}`;
  return `device:${session.deviceId}`;
}

function notify(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function records(scope: string): SkillRegistration[] {
  return read<RegistrationCache>(CACHE_KEY, {})[scope] ?? [];
}

function storeRecords(scope: string, next: SkillRegistration[]): void {
  const cache = read<RegistrationCache>(CACHE_KEY, {});
  write(CACHE_KEY, { ...cache, [scope]: next.sort((a, b) => b.registeredAt - a.registeredAt) });
  notify();
}

function queue(scope: string, skillId: string, action: "register" | "unregister"): void {
  const outbox = read<RegistrationOutbox>(OUTBOX_KEY, {});
  write(OUTBOX_KEY, {
    ...outbox,
    [scope]: { ...(outbox[scope] ?? {}), [skillId]: action },
  });
  notify();
}

function clearQueued(scope: string, skillId: string, expected: string): void {
  const outbox = read<RegistrationOutbox>(OUTBOX_KEY, {});
  if (outbox[scope]?.[skillId] !== expected) return;
  delete outbox[scope][skillId];
  if (!Object.keys(outbox[scope]).length) delete outbox[scope];
  write(OUTBOX_KEY, outbox);
  notify();
}

function applyPending(scope: string, server: SkillRegistration[]): SkillRegistration[] {
  const byId = new Map(server.map((item) => [item.skillId, item]));
  for (const [skillId, action] of Object.entries(
    read<RegistrationOutbox>(OUTBOX_KEY, {})[scope] ?? {},
  )) {
    if (action === "unregister") byId.delete(skillId);
    else if (!byId.has(skillId)) byId.set(skillId, { skillId, registeredAt: Date.now() });
  }
  return [...byId.values()];
}

export async function refreshSkillRegistrations(): Promise<void> {
  const session = SessionAPI.current();
  const scope = skillRegistrationScope(session);
  if (!session || !scope) return;
  try {
    const result = await request<{ registrations: SkillRegistration[] }>(
      "/skill-registrations",
      { token: await accessToken() },
    );
    if (skillRegistrationScope(SessionAPI.current()) === scope) {
      storeRecords(scope, applyPending(scope, result.registrations));
    }
    await flushSkillRegistrations();
  } catch {
    /* exact-scope offline cache remains authoritative until reconnection */
  }
}

export async function flushSkillRegistrations(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    // Clear an obsolete offline registration queue before it can recreate
    // enrollments removed by a platform operator.
    await refreshMaintenanceVersions().catch(() => false);
    const session = SessionAPI.current();
    const scope = skillRegistrationScope(session);
    if (!session || !scope) return;
    const pending = read<RegistrationOutbox>(OUTBOX_KEY, {})[scope] ?? {};
    for (const [skillId, action] of Object.entries(pending)) {
      try {
        const saved = await request<SkillRegistration | undefined>(
          `/skill-registrations/${encodeURIComponent(skillId)}`,
          { method: action === "register" ? "POST" : "DELETE", token: await accessToken() },
        );
        if (saved) {
          storeRecords(scope, [
            saved,
            ...records(scope).filter((item) => item.skillId !== saved.skillId),
          ]);
        }
        clearQueued(scope, skillId, action);
      } catch (error) {
        if (error instanceof ApiError && !error.isOffline && !error.isServerFault) {
          clearQueued(scope, skillId, action);
          if (action === "register") {
            storeRecords(scope, records(scope).filter((item) => item.skillId !== skillId));
          }
          throw error;
        }
        return;
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function registerSkillForCurrentUser(skillId: string): Promise<void> {
  const scope = skillRegistrationScope(SessionAPI.current());
  if (!scope) throw new Error("Sign in to register a skill.");
  storeRecords(scope, [
    { skillId, registeredAt: Date.now() },
    ...records(scope).filter((item) => item.skillId !== skillId),
  ]);
  queue(scope, skillId, "register");
  await flushSkillRegistrations();
}

export async function unregisterSkillForCurrentUser(skillId: string): Promise<void> {
  const scope = skillRegistrationScope(SessionAPI.current());
  if (!scope) return;
  storeRecords(scope, records(scope).filter((item) => item.skillId !== skillId));
  queue(scope, skillId, "unregister");
  await flushSkillRegistrations();
}

export function useSkillRegistrations() {
  const session = useSession();
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => version,
  );
  const scope = skillRegistrationScope(session);

  useEffect(() => {
    void refreshSkillRegistrations();
  }, [scope]);

  const registrations = useMemo(() => (scope ? records(scope) : []), [scope, version]);
  return {
    registrations,
    registeredIds: new Set(registrations.map((item) => item.skillId)),
    register: registerSkillForCurrentUser,
    unregister: unregisterSkillForCurrentUser,
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushSkillRegistrations().catch(() => undefined));
  window.addEventListener("koda:registration-reset", notify);
}
