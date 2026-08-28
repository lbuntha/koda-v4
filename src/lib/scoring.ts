/**
 * What a finished round is worth, in one place.
 *
 * The numbers live here rather than inside any skill because the rewards are
 * shared: XP feeds one level, stars fill one path, and a learner meets both
 * across every skill. When each skill carried its own scale, counting paid a
 * flat 100 XP for finishing while addition paid 30 for the same round, and the
 * totals stopped meaning anything.
 *
 * Editable from Settings, so tuning the economy is one change that every
 * installed skill picks up — no skill edit, no rebuild.
 */

import { saveDeploymentRule } from "./deploymentRules";

export interface ScoringConfig {
  /**
   * Share of a level's own XP paid at two stars, 0–1. Three stars always pays
   * the full amount; below two stars pays `oneStarShare`.
   */
  twoStarShare: number;
  oneStarShare: number;
  /**
   * What one finished level is worth at three stars.
   *
   * The only place XP is authored. Levels used to carry their own `xpReward`
   * and questions used to carry one each, which meant three sources for one
   * number and no way to tune the economy without editing curriculum.
   */
  xpPerLevel: number;
  /** First-try accuracy needed for three stars, 0–1. */
  threeStarAt: number;
  /** First-try accuracy needed for two stars, 0–1. */
  twoStarAt: number;
}

export const SCORING_DEFAULTS: ScoringConfig = {
  twoStarShare: 0.7,
  oneStarShare: 0.4,
  xpPerLevel: 20,
  threeStarAt: 0.9,
  twoStarAt: 0.6,
};

const STORAGE_KEY = "koda_scoring_v1";

const listeners = new Set<() => void>();
let version = 0;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Keeps a hand-edited or corrupted store from producing impossible bands. */
const sanitise = (raw: Partial<ScoringConfig>): ScoringConfig => {
  const twoStarAt = clamp(Number(raw.twoStarAt ?? SCORING_DEFAULTS.twoStarAt), 0, 1);
  const oneStarShare = clamp(Number(raw.oneStarShare ?? SCORING_DEFAULTS.oneStarShare), 0, 1);
  return {
    oneStarShare,
    // Two stars can never pay less than one star, whatever the store says.
    twoStarShare: clamp(Number(raw.twoStarShare ?? SCORING_DEFAULTS.twoStarShare), oneStarShare, 1),
    xpPerLevel: clamp(
      // `defaultLessonXp` is the old name; read it so a saved config survives.
      Math.round(
        Number(
          raw.xpPerLevel ??
            (raw as { defaultLessonXp?: number }).defaultLessonXp ??
            SCORING_DEFAULTS.xpPerLevel,
        ),
      ),
      0,
      500,
    ),
    // Three stars can never be easier than two, whatever the store says.
    threeStarAt: clamp(Number(raw.threeStarAt ?? SCORING_DEFAULTS.threeStarAt), twoStarAt, 1),
    twoStarAt,
  };
};

const load = (): ScoringConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitise(JSON.parse(raw) as Partial<ScoringConfig>) : { ...SCORING_DEFAULTS };
  } catch {
    return { ...SCORING_DEFAULTS };
  }
};

let config: ScoringConfig = load();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // One answer for the deployment: what a round pays is the operator's, and
    // every family on this Koda scores by the same rates.
    void saveDeploymentRule("scoring", config);
  } catch {
    // A blocked store must not take the app down: the values still apply for
    // this session, they just do not survive a reload.
  }
  version += 1;
  for (const cb of listeners) cb();
};

export const ScoringAPI = {
  /** Change signal for `useSyncExternalStore`. */
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** The values in force. Read fresh — a skill must never cache these. */
  current(): ScoringConfig {
    return config;
  },

  update(patch: Partial<ScoringConfig>): void {
    config = sanitise({ ...config, ...patch });
    persist();
  },

  isEdited(): boolean {
    return (Object.keys(SCORING_DEFAULTS) as (keyof ScoringConfig)[]).some(
      (k) => config[k] !== SCORING_DEFAULTS[k],
    );
  },

  reset(): void {
    config = { ...SCORING_DEFAULTS };
    persist();
  },
};
