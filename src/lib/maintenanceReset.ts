import { LearningLog } from "./learning/learningLog";
import { accessToken } from "./sync/session";
import { request } from "./sync/api";
import { Outbox } from "./sync/outbox";

export interface MaintenanceVersions {
  learningVersion: number;
  registrationsVersion: number;
  /** This account's family, when it has one, and that family's own XP reset generation. */
  familyId?: string | null;
  familyLearningVersion?: number;
}

interface AppliedVersions {
  learningVersion: number;
  registrationsVersion: number;
  /** Per family, because one device can be signed into more than one over its life. */
  families: Record<string, number>;
}

export interface MaintenanceResult {
  versions: MaintenanceVersions;
  deleted: Record<string, number>;
}

const APPLIED_KEY = "koda_maintenance_versions_v1";
/**
 * Matched by prefix, not by name.
 *
 * A learner's record is stored under its own key per child — see
 * `storageKeyFor` — so `koda_learner_progress_v1__l_7c2…` has to go too. An
 * exact-name wipe left every child's record behind and reset nothing.
 */
const LEARNING_KEYS = [
  "koda_learner_progress_v1",
  "koda_completed_levels_v1",
  "koda_profile_stats_v1",
  "koda_outbox_backfill_v1",
  // What the outbox could not send, folded into totals. It is learning work
  // like the rest, so a reset that wipes the log and the queue but left this
  // would push the erased history back up on the next flush.
  "koda_unsent_totals_v1",
];

/** Every stored key one of `bases` names, including its per-learner variants. */
const matching = (bases: string[]): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && bases.some((base) => key === base || key.startsWith(`${base}__`))) keys.push(key);
  }
  return keys;
};
const REGISTRATION_KEYS = [
  "koda_skill_registrations_v1",
  "koda_skill_registration_outbox_v1",
  "koda_skill_registrations_v2",
  "koda_skill_registration_outbox_v2",
];

function applied(): AppliedVersions {
  try {
    const stored = JSON.parse(localStorage.getItem(APPLIED_KEY) ?? "{}");
    return {
      learningVersion: Number(stored.learningVersion ?? 0),
      registrationsVersion: Number(stored.registrationsVersion ?? 0),
      families: stored.families && typeof stored.families === "object" ? stored.families : {},
    };
  } catch {
    return { learningVersion: 0, registrationsVersion: 0, families: {} };
  }
}

/** Apply a server reset locally before any queued work is uploaded. */
export function applyMaintenanceVersions(next: MaintenanceVersions): boolean {
  const previous = applied();
  const familyId = next.familyId ?? null;
  const familyVersion = next.familyLearningVersion ?? 0;
  // An operator cleared XP for this family alone (Data cleanup). Same wipe as
  // the global erase, scoped by whoever is signed in on this device.
  const resetFamily = familyId !== null && familyVersion > (previous.families[familyId] ?? 0);
  const resetLearning = next.learningVersion > previous.learningVersion || resetFamily;
  const resetRegistrations = next.registrationsVersion > previous.registrationsVersion;
  if (!resetLearning && !resetRegistrations) return false;

  const stored: AppliedVersions = {
    learningVersion: next.learningVersion,
    registrationsVersion: next.registrationsVersion,
    families: familyId !== null ? { ...previous.families, [familyId]: familyVersion } : previous.families,
  };
  try {
    // Store the generation first so a reload cannot repeat forever.
    localStorage.setItem(APPLIED_KEY, JSON.stringify(stored));
    if (resetLearning) matching(LEARNING_KEYS).forEach((key) => localStorage.removeItem(key));
    if (resetRegistrations) matching(REGISTRATION_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    /* An unavailable store already cannot restore stale offline records. */
  }

  if (resetLearning) {
    LearningLog.clear();
    Outbox.clearLearning();
  }
  if (resetRegistrations && typeof window !== "undefined") {
    window.dispatchEvent(new Event("koda:registration-reset"));
  }
  return true;
}

export async function refreshMaintenanceVersions(): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;
  const versions = await request<MaintenanceVersions>("/system/maintenance/versions", { token });
  return applyMaintenanceVersions(versions);
}
