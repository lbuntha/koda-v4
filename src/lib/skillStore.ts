import { useState, useEffect } from "react";

// Declared with the skill contract, re-exported here because the store holds
// the persisted copy and half the app imports it from this module.
export type { SkillFeature } from "../skills/types";
import type { SkillFeature } from "../skills/types";
import { queueSkillConfiguration } from "./skillRegistryApi";

/**
 * Interface representing a modular Learning Skill in the system.
 */
export interface InstalledSkill {
  id: string;
  name: string;
  version: string;
  description: string;
  category: "core" | "utility" | "assistant" | "visualizer" | "manipulative";
  author: string;
  isEnabled: boolean;
  iconName: string;
  /** Store listing, seeded from the manifest and editable per install. */
  /**
   * What this deployment calls the skill, when it does not call it what the
   * manifest does.
   *
   * Its own field rather than an edit to `name`, for the same reason `tagline`
   * is: `name` is code-owned and re-seeded from the manifest on every boot, so
   * a rename written there would survive exactly until the next deploy. Empty
   * means "no opinion" and the manifest's name is used — `skillTitle` is the
   * one place that decides.
   */
  title?: string;
  tagline?: string;
  thumbnail?: string;
  features: SkillFeature[];
  settings?: Record<string, any>;
  stats?: {
    totalEvents: number;
    lastActive: string;
  };
}

/**
 * What to call a skill on screen.
 *
 * One rule, because a rename that reaches Home but not the Learn page is worse
 * than no rename at all: a learner would see two names for the same thing and
 * have no way to know they are one skill. A blank or whitespace-only override
 * is not a name and falls through to the manifest's.
 */
export const skillTitle = (
  manifestName: string,
  stored?: { title?: string } | null,
): string => stored?.title?.trim() || manifestName;

/**
 * Interface representing a chronological action logged globally in the system.
 */
export interface SkillActionLog {
  id: string;
  timestamp: string;
  skillId: string;
  actionType:
    | "START_LEVEL"
    | "TAP_ITEM"
    | "CHECK_ANSWER"
    | "NEXT_QUESTION"
    | "OPEN_TIP"
    | "PLAY_AUDIO"
    | "EXIT_GAME"
    | "EARN_XP"
    | "TOGGLE_FEATURE"
    | "PLUGIN_STATE";
  level: number;
  step?: number;
  status?: "success" | "error" | "info";
  details: string;
}

/**
 * No built-in skills.
 *
 * This array previously declared five: counting-mastery (which duplicated the
 * counting skill's manifest) and four UI fragments — step-header-tagger,
 * feedback-drawer, gemini-coach, whiteboard-scratchpad. Between them the four
 * owned 14 feature flags, and an audit found **not one of them was ever checked
 * in code**: every toggle in the Skill Manager did nothing.
 *
 * A switch that does not switch anything is worse than no switch, so they are
 * gone. The UI they nominally described (step header, feedback banner, voice
 * coach, whiteboard) is untouched — it was never gated by these flags.
 *
 * Skills now come from src/skills/registry.ts via registerSkill(), which
 * means everything the Skill Manager lists is real.
 */
const DEFAULT_SKILLS: InstalledSkill[] = [];

const STORAGE_KEY_SKILLS = "koda_learning_skills_v2";
const STORAGE_KEY_LOGS = "koda_skill_logs_v2";
/** What the key was called before skills were called skills. */
const LEGACY_KEY_SKILLS = "koda_learning_plugins_v2";

// Initialize skills from LocalStorage or default
function loadStoredSkills(): InstalledSkill[] {
  try {
    // Read the old key once, so a device that already had settings, feature
    // toggles and store listings keeps them across the rename. It is written
    // back under the new key on the next save.
    const raw =
      localStorage.getItem(STORAGE_KEY_SKILLS) ?? localStorage.getItem(LEGACY_KEY_SKILLS);
    if (!raw) return [...DEFAULT_SKILLS];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SKILLS];

    // Start from what was persisted. Skills are supplied by the registry now,
    // so a stored entry with no matching built-in is normal — not stale. This
    // used to map over DEFAULT_SKILLS, which silently dropped every saved
    // choice once that array was emptied.
    const byId = new Map<string, InstalledSkill>();
    for (const p of parsed) {
      if (p && typeof p.id === "string" && Array.isArray(p.features)) {
        byId.set(p.id, p as InstalledSkill);
      }
    }

    // Built-ins fill in anything never persisted.
    for (const def of DEFAULT_SKILLS) {
      if (!byId.has(def.id)) byId.set(def.id, def);
    }

    return [...byId.values()];
  } catch (err) {
    console.warn("Failed to load stored skills:", err);
    return [...DEFAULT_SKILLS];
  }
}

/** Offline cache. Registration writes here but never creates a family mutation. */
function writeStoredSkills(skills: InstalledSkill[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(skills));
  } catch (err) {
    console.warn("Failed to save skills to localStorage:", err);
  }
}

/** Queue deployment configuration; the local copy remains the offline snapshot. */
function syncStoredSkills(skills: InstalledSkill[]) {
  for (const skill of skills) {
    queueSkillConfiguration({
      id: skill.id,
      isEnabled: skill.isEnabled,
      title: skill.title,
      tagline: skill.tagline,
      thumbnail: skill.thumbnail,
      features: skill.features as unknown as Array<Record<string, unknown>>,
      settings: skill.settings ?? {},
    });
  }
}

/** Pristine manifests, keyed by id. Populated by registerSkill(). */
const registeredDefaults = new Map<string, InstalledSkill>();

function mergeRegisteredSkill(
  incoming: InstalledSkill,
  existing?: InstalledSkill,
): InstalledSkill {
  if (!existing) return incoming;
  return {
    ...incoming,
    isEnabled: existing.isEnabled,
    title: existing.title ?? incoming.title,
    tagline: existing.tagline ?? incoming.tagline,
    thumbnail: existing.thumbnail ?? incoming.thumbnail,
    settings: { ...incoming.settings, ...existing.settings },
    features: incoming.features.map((feature) => {
      const saved = existing.features.find((item) => item.id === feature.id);
      return saved ? { ...feature, isEnabled: saved.isEnabled } : feature;
    }),
  };
}

let globalSkills: InstalledSkill[] = loadStoredSkills();

// Starts empty. The seed entry referenced a skill id that no longer exists and
// claimed a feature count that was never true; real activity arrives via log().
let globalActionLogs: SkillActionLog[] = [];

// List of active subscribers for reactive updates
const skillSubscribers = new Set<() => void>();
const logSubscribers = new Set<() => void>();

const notifySkills = () => {
  writeStoredSkills(globalSkills);
  syncStoredSkills(globalSkills);
  skillSubscribers.forEach((sub) => sub());
};
const notifyLogs = () => logSubscribers.forEach((sub) => sub());

// A server pull writes the offline cache and dispatches this nudge. The old
// implementation changed localStorage but left `globalSkills` stale until a
// reload, so another device's toggle never affected the running app.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY_SKILLS && event.key !== LEGACY_KEY_SKILLS) return;
    const stored = loadStoredSkills();
    const registeredIds = new Set(registeredDefaults.keys());
    globalSkills = [
      ...stored.filter((skill) => !registeredIds.has(skill.id)),
      ...[...registeredDefaults.values()].map((incoming) =>
        mergeRegisteredSkill(incoming, stored.find((skill) => skill.id === incoming.id)),
      ),
    ];
    writeStoredSkills(globalSkills);
    skillSubscribers.forEach((subscriber) => subscriber());
  });
}

/**
 * Main programmatic Global Skill API
 */
export const SkillStoreAPI = {
  /**
   * Register a skill declared by the registry.
   *
   * The skill's own manifest is the source of truth for its shape — name,
   * version, features, settings defaults. Persisted state (whether it or its
   * features are switched off) wins over the manifest, so a parent's choice
   * survives a redeploy while new features still appear.
   *
   * Idempotent: registering the same id twice re-merges rather than duplicating.
   */
  registerSkill: (incoming: InstalledSkill): void => {
    // The manifest as declared, before any user change. This is what "factory
    // defaults" now means — DEFAULT_SKILLS is empty because skills come from
    // the registry, so resets must restore from here instead.
    registeredDefaults.set(incoming.id, structuredClone(incoming));

    const existing = globalSkills.find((p) => p.id === incoming.id);
    const merged = mergeRegisteredSkill(incoming, existing);
    globalSkills = existing
      ? globalSkills.map((skill) => (skill.id === incoming.id ? merged : skill))
      : [...globalSkills, merged];
    // The deployment registry is seeded into Mongo by the server. This copy is
    // only the instant/offline configuration cache; registering a bundle must
    // not masquerade as a family edit or make a staff account push a document.
    writeStoredSkills(globalSkills);
    skillSubscribers.forEach((sub) => sub());
  },

  /**
   * Edit the store listing — the tile and the one-liner a learner sees.
   *
   * Separate from `updateSkillSetting` because this is not configuration the
   * skill reads: nothing in a round behaves differently for it. An empty string
   * clears the field back to the manifest's own value on the next boot.
   */
  updateSkillListing: (
    skillId: string,
    patch: { title?: string; tagline?: string; thumbnail?: string },
  ): void => {
    globalSkills = globalSkills.map((p) => {
      if (p.id !== skillId) return p;
      const next = { ...p };
      if (patch.title !== undefined) next.title = patch.title.trim() || undefined;
      if (patch.tagline !== undefined) next.tagline = patch.tagline.trim() || undefined;
      if (patch.thumbnail !== undefined) next.thumbnail = patch.thumbnail.trim() || undefined;
      return next;
    });
    notifySkills();
  },

  /** Restore the listing the skill shipped with. */
  resetSkillListing: (skillId: string): void => {
    const def = registeredDefaults.get(skillId);
    globalSkills = globalSkills.map((p) =>
      p.id === skillId
        ? { ...p, title: def?.title, tagline: def?.tagline, thumbnail: def?.thumbnail }
        : p,
    );
    notifySkills();
  },

  // Get list of all installed skills
  getSkills: (): InstalledSkill[] => [...globalSkills],

  // Get specific skill
  getSkill: (id: string): InstalledSkill | undefined => {
    return globalSkills.find((p) => p.id === id);
  },

  // Check if whole skill is enabled
  isSkillEnabled: (skillId: string): boolean => {
    const plug = globalSkills.find((p) => p.id === skillId);
    return plug ? plug.isEnabled : false;
  },

  // Check if a specific feature of a skill is enabled
  isFeatureEnabled: (skillId: string, featureId: string, defaultIfNotFound = false): boolean => {
    const plug = globalSkills.find((p) => p.id === skillId);
    if (!plug || !plug.isEnabled) return false;
    const feat = plug.features.find((f) => f.id === featureId);
    return feat !== undefined ? feat.isEnabled : defaultIfNotFound;
  },

  // Toggle state of a skill
  toggleSkill: (id: string): void => {
    globalSkills = globalSkills.map((p) => {
      if (p.id === id) {
        const nextState = !p.isEnabled;
        return {
          ...p,
          isEnabled: nextState,
          stats: {
            totalEvents: (p.stats?.totalEvents || 0) + 1,
            lastActive: new Date().toISOString(),
          },
        };
      }
      return p;
    });
    notifySkills();
    const plug = globalSkills.find((p) => p.id === id);
    SkillStoreAPI.logAction(
      id,
      "PLUGIN_STATE",
      0,
      undefined,
      "info",
      `Skill '${plug?.name || id}' switched ${plug?.isEnabled ? "ENABLED" : "DISABLED"}.`
    );
  },

  // Toggle state of a specific feature
  toggleFeature: (skillId: string, featureId: string): void => {
    globalSkills = globalSkills.map((p) => {
      if (p.id === skillId) {
        const updatedFeatures = p.features.map((f) => {
          if (f.id === featureId) {
            return { ...f, isEnabled: !f.isEnabled };
          }
          return f;
        });
        return {
          ...p,
          features: updatedFeatures,
          stats: {
            totalEvents: (p.stats?.totalEvents || 0) + 1,
            lastActive: new Date().toISOString(),
          },
        };
      }
      return p;
    });
    notifySkills();
    const targetFeat = globalSkills.find((p) => p.id === skillId)?.features.find((f) => f.id === featureId);
    SkillStoreAPI.logAction(
      skillId,
      "TOGGLE_FEATURE",
      0,
      undefined,
      "info",
      `Feature '${targetFeat?.name || featureId}' set to ${targetFeat?.isEnabled ? "ON" : "OFF"}.`
    );
  },

  // Set specific feature state directly
  setFeatureState: (skillId: string, featureId: string, isEnabled: boolean): void => {
    globalSkills = globalSkills.map((p) => {
      if (p.id === skillId) {
        return {
          ...p,
          features: p.features.map((f) => (f.id === featureId ? { ...f, isEnabled } : f)),
        };
      }
      return p;
    });
    notifySkills();
  },

  // Update skill settings object
  updateSkillSetting: (skillId: string, key: string, value: any): void => {
    globalSkills = globalSkills.map((p) => {
      if (p.id === skillId) {
        return {
          ...p,
          settings: { ...p.settings, [key]: value },
        };
      }
      return p;
    });
    notifySkills();
  },

  // Get specific setting value with fallback
  getSkillSetting: <T = any>(skillId: string, key: string, defaultValue: T): T => {
    const plug = globalSkills.find((p) => p.id === skillId);
    if (!plug || !plug.settings || plug.settings[key] === undefined) return defaultValue;
    return plug.settings[key] as T;
  },

  // Enable all skills
  enableAll: (): void => {
    globalSkills = globalSkills.map((p) => ({
      ...p,
      isEnabled: true,
      features: p.features.map((f) => ({ ...f, isEnabled: true })),
    }));
    notifySkills();
    SkillStoreAPI.logAction("system", "PLUGIN_STATE", 0, undefined, "info", "All skills and features enabled.");
  },

  // Disable all skills
  disableAll: (): void => {
    globalSkills = globalSkills.map((p) => ({
      ...p,
      isEnabled: false,
    }));
    notifySkills();
    SkillStoreAPI.logAction("system", "PLUGIN_STATE", 0, undefined, "info", "All skills disabled.");
  },

  // Reset all skills to default configurations
  resetAllToDefaults: (): void => {
    // Restore every registered skill to its manifest, keeping the list intact.
    // This previously assigned DEFAULT_SKILLS, which is now empty — it would
    // have wiped every skill from the store until the next reload.
    globalSkills = [
      ...DEFAULT_SKILLS,
      ...[...registeredDefaults.values()].map((p) => structuredClone(p)),
    ];
    notifySkills();
    SkillStoreAPI.logAction("system", "PLUGIN_STATE", 0, undefined, "info", "All skills reset to factory defaults.");
  },

  // Reset single skill to default
  resetSkillToDefaults: (skillId: string): void => {
    const def = registeredDefaults.get(skillId) ?? DEFAULT_SKILLS.find((p) => p.id === skillId);
    if (!def) return;
    globalSkills = globalSkills.map((p) =>
      p.id === skillId ? structuredClone(def) : p,
    );
    notifySkills();
    SkillStoreAPI.logAction(skillId, "PLUGIN_STATE", 0, undefined, "info", `Skill '${def.name}' reset to factory defaults.`);
  },

  // Export current configuration as JSON string
  exportConfig: (): string => {
    return JSON.stringify(globalSkills, null, 2);
  },

  // Import configuration from JSON string
  importConfig: (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) return false;
      globalSkills = parsed;
      notifySkills();
      SkillStoreAPI.logAction("system", "PLUGIN_STATE", 0, undefined, "success", "Configuration imported successfully.");
      return true;
    } catch {
      return false;
    }
  },

  // Log a new interaction programmatically
  logAction: (
    skillId: string,
    actionType: SkillActionLog["actionType"],
    level: number,
    step?: number,
    status?: SkillActionLog["status"],
    details = ""
  ): void => {
    const newLog: SkillActionLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      skillId,
      actionType,
      level,
      step,
      status: status || "info",
      details,
    };
    globalActionLogs = [newLog, ...globalActionLogs].slice(0, 500); // Limit logs to 500
    
    // Update stats counter for the target skill
    const target = globalSkills.find((p) => p.id === skillId);
    if (target && target.stats) {
      target.stats.totalEvents = (target.stats.totalEvents || 0) + 1;
      target.stats.lastActive = new Date().toISOString();
    }

    notifyLogs();
  },

  // Retrieve chronological action logs
  getLogs: (): SkillActionLog[] => [...globalActionLogs],

  // Reset all logs
  clearLogs: (): void => {
    globalActionLogs = [];
    notifyLogs();
  },
};

/**
 * Custom React Hook to observe the global action logs reactively
 */
export function useGlobalActionLogs() {
  const [logs, setLogs] = useState<SkillActionLog[]>(SkillStoreAPI.getLogs());

  useEffect(() => {
    const handleUpdate = () => setLogs(SkillStoreAPI.getLogs());
    logSubscribers.add(handleUpdate);
    return () => {
      logSubscribers.delete(handleUpdate);
    };
  }, []);

  return logs;
}

/**
 * Custom React Hook to observe installed learning skills reactively
 */
export function useInstalledSkills() {
  const [skills, setSkills] = useState<InstalledSkill[]>(SkillStoreAPI.getSkills());

  useEffect(() => {
    const handleUpdate = () => setSkills(SkillStoreAPI.getSkills());
    skillSubscribers.add(handleUpdate);
    return () => {
      skillSubscribers.delete(handleUpdate);
    };
  }, []);

  return skills;
}

/**
 * Custom React Hook to observe a single skill reactively
 */
export function useSkill(skillId: string) {
  const [skill, setSkill] = useState<InstalledSkill | undefined>(() => SkillStoreAPI.getSkill(skillId));

  useEffect(() => {
    const handleUpdate = () => setSkill(SkillStoreAPI.getSkill(skillId));
    skillSubscribers.add(handleUpdate);
    return () => {
      skillSubscribers.delete(handleUpdate);
    };
  }, [skillId]);

  return skill;
}
