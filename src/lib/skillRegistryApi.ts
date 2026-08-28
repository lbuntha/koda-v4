import { useSyncExternalStore } from "react";
import type { ReleaseStatus, Skill } from "../skills/types";
import { request } from "./sync/api";
import { SessionAPI, accessToken } from "./sync/session";

const CACHE_KEY = "koda_skill_registry_cache_v1";
const PENDING_KEY = "koda_skill_registry_outbox_v1";
const SKILL_CACHE_KEY = "koda_learning_skills_v2";
const LESSON_CACHE_KEY = "koda_lesson_content_v1";

export interface SkillConfiguration {
  isEnabled: boolean;
  tagline?: string;
  thumbnail?: string;
  features: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
  lessonContent: Record<string, Record<string, unknown>>;
}

export interface RegisteredSkill {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  author: string;
  iconName: string;
  tagline?: string;
  thumbnail?: string;
  status: ReleaseStatus;
  audience: { ages: [number, number]; category: string };
  teaches: string[];
  requires: string[];
  rev: number;
  modified: number;
  publishedBy?: { id: string; displayName: string } | null;
  publishedAt?: number | null;
  statusChangedBy?: { id: string; displayName: string } | null;
  statusChangedAt?: number | null;
  isEnabled: boolean;
  features: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
  lessonContent: Record<string, Record<string, unknown>>;
  lessons: Array<Record<string, unknown>>;
  configurationChangedBy?: { id: string; displayName: string } | null;
  configurationChangedAt?: number | null;
}

function loadCache(): RegisteredSkill[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let records = loadCache();
let version = 0;
let flushing: Promise<void> | null = null;
const listeners = new Set<() => void>();

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function pending(): Record<string, SkillConfiguration> {
  return readJson(PENDING_KEY, {});
}

function writePending(next: Record<string, SkillConfiguration>): void {
  try {
    if (Object.keys(next).length) localStorage.setItem(PENDING_KEY, JSON.stringify(next));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // The live local stores still hold the edit; a later change retries.
  }
  version += 1;
  listeners.forEach((listener) => listener());
}

function applyConfigurationSnapshot(next: RegisteredSkill[]): void {
  const previous = readJson<Array<Record<string, unknown>>>(SKILL_CACHE_KEY, []);
  const stats = new Map(previous.map((skill) => [String(skill.id), skill.stats]));
  const installed = next.map((skill) => ({
    id: skill.id,
    name: skill.name,
    version: skill.version,
    description: skill.description,
    category: skill.category,
    author: skill.author,
    iconName: skill.iconName,
    tagline: skill.tagline,
    thumbnail: skill.thumbnail,
    isEnabled: skill.isEnabled,
    features: skill.features,
    settings: skill.settings,
    ...(stats.get(skill.id) ? { stats: stats.get(skill.id) } : {}),
  }));
  const lessonContent = Object.fromEntries(
    next.map((skill) => [skill.id, skill.lessonContent ?? {}]),
  );
  try {
    localStorage.setItem(SKILL_CACHE_KEY, JSON.stringify(installed));
    localStorage.setItem(LESSON_CACHE_KEY, JSON.stringify(lessonContent));
    window.dispatchEvent(new StorageEvent("storage", { key: SKILL_CACHE_KEY }));
    window.dispatchEvent(new StorageEvent("storage", { key: LESSON_CACHE_KEY }));
  } catch {
    // Registry cache and bundled defaults remain usable if storage is blocked.
  }
}

function replace(next: RegisteredSkill[]): void {
  records = next;
  version += 1;
  try {
    // This is an offline snapshot, never the source of truth. It is replaced
    // only after a complete server response succeeds.
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // Memory still serves this tab; the bundled manifest is the final fallback.
  }
  listeners.forEach((listener) => listener());
}

async function token(): Promise<string> {
  const value = await accessToken();
  if (!value) throw new Error("Sign in to load the skill registry.");
  return value;
}

/** Refresh the complete deployment registry and its offline snapshot. */
export async function refreshSkillRegistry(): Promise<RegisteredSkill[]> {
  await flushSkillConfiguration();
  const result = await request<{ skills: RegisteredSkill[] }>("/skills", {
    token: await token(),
  });
  // A failed/offline upload remains authoritative on this device until it can
  // be sent; do not let the older server response erase that pending work.
  const queued = pending();
  const merged = result.skills.map((skill) =>
    queued[skill.id] ? { ...skill, ...queued[skill.id] } : skill,
  );
  replace(merged);
  applyConfigurationSnapshot(merged);
  return merged;
}

/** Publish/unpublish on Mongo first; update the offline cache after success. */
export async function setSkillPublication(
  skillId: string,
  status: ReleaseStatus,
): Promise<RegisteredSkill> {
  const saved = await request<RegisteredSkill>(
    `/skills/${encodeURIComponent(skillId)}/publication`,
    { method: "PATCH", token: await token(), body: { status } },
  );
  replace([...records.filter((record) => record.id !== saved.id), saved].sort((a, b) =>
    a.id.localeCompare(b.id),
  ));
  applyConfigurationSnapshot(records);
  return saved;
}

/** Queue the complete editable state; repeated offline edits coalesce by skill. */
export function queueSkillConfiguration(
  skill: Omit<SkillConfiguration, "lessonContent"> & { id: string },
): void {
  const lessons = readJson<Record<string, Record<string, Record<string, unknown>>>>(
    LESSON_CACHE_KEY,
    {},
  );
  writePending({
    ...pending(),
    [skill.id]: {
      isEnabled: skill.isEnabled,
      tagline: skill.tagline,
      thumbnail: skill.thumbnail,
      features: skill.features,
      settings: skill.settings,
      lessonContent: lessons[skill.id] ?? {},
    },
  });
  void flushSkillConfiguration();
}

/** Requeue a skill after its lesson-content overlay changes. */
export function queueLocalSkillConfiguration(skillId: string): void {
  const skills = readJson<Array<Record<string, unknown>>>(SKILL_CACHE_KEY, []);
  const skill = skills.find((item) => item.id === skillId);
  if (!skill) return;
  queueSkillConfiguration({
    id: skillId,
    isEnabled: Boolean(skill.isEnabled),
    tagline: typeof skill.tagline === "string" ? skill.tagline : undefined,
    thumbnail: typeof skill.thumbnail === "string" ? skill.thumbnail : undefined,
    features: Array.isArray(skill.features) ? skill.features : [],
    settings:
      skill.settings && typeof skill.settings === "object"
        ? (skill.settings as Record<string, unknown>)
        : {},
  });
}

/** Drain server configuration writes. Failure deliberately leaves the outbox. */
export async function flushSkillConfiguration(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const session = SessionAPI.current();
    const mayManage =
      session?.permissions?.includes("content:write") ||
      session?.platformRole === "admin" ||
      session?.platformRole === "developer";
    if (!session || session.familyId || !mayManage) return;
    while (true) {
      const batch = Object.entries(pending());
      if (!batch.length) return;
      for (const [skillId, configuration] of batch) {
        const sent = JSON.stringify(configuration);
        try {
          const saved = await request<RegisteredSkill>(
            `/skills/${encodeURIComponent(skillId)}/configuration`,
            { method: "PUT", token: await token(), body: configuration },
          );
          const latest = pending();
          if (JSON.stringify(latest[skillId]) === sent) {
            delete latest[skillId];
            writePending(latest);
          }
          replace(
            [...records.filter((record) => record.id !== saved.id), saved].sort((a, b) =>
              a.id.localeCompare(b.id),
            ),
          );
        } catch {
          return;
        }
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushSkillConfiguration());
}

/** Server/cache release state, with the bundled manifest as offline first-run fallback. */
export function releaseStatusOf(skill: Skill): ReleaseStatus {
  return records.find((record) => record.id === skill.manifest.id)?.status ?? skill.manifest.status;
}

export const SkillRegistryAPI = {
  list: (): RegisteredSkill[] => [...records],
  get: (id: string): RegisteredSkill | undefined => records.find((record) => record.id === id),
  hasPendingConfiguration: (id: string): boolean => Boolean(pending()[id]),
  refresh: refreshSkillRegistry,
  setPublication: setSkillPublication,
  queueConfiguration: queueSkillConfiguration,
  flushConfiguration: flushSkillConfiguration,
  version: (): number => version,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Subscribe a surface that resolves skill visibility to registry refreshes. */
export function useSkillRegistryVersion(): number {
  return useSyncExternalStore(
    SkillRegistryAPI.subscribe,
    SkillRegistryAPI.version,
    SkillRegistryAPI.version,
  );
}
