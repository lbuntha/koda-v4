/**
 * What a badge is, and who has earned one.
 *
 * The last reward that was drawn but never given: the profile has printed an
 * Achievements section since it was written, reading a `badges` field nothing
 * has ever filled, so every learner's says "No badges yet" forever. This is the
 * half that was missing — a family's badges, and the rule each one stands on.
 *
 * A rule is one figure against one threshold, and the three figures are the
 * ones the app already measures honestly: lifetime XP, the longest streak ever
 * run, and stars earned. Deliberately not a condition builder. "XP *and* a
 * streak" doubles the editor, doubles the sentence a parent has to read, and
 * nobody has asked for it; the shape below leaves room to add it later without
 * moving anything.
 *
 * Earning is *derived*, never stored. All three figures only ever rise — XP
 * does not fall, `longestStreak` is a record rather than a state, stars are the
 * best ever scored on each level — so a badge cannot be taken away by playing
 * badly, or by a bad week, and no learner needs a stored set of what they have
 * won. What can take one away is an admin raising the bar, which is the same
 * retroactive bargain the Scoring page already makes with stars.
 *
 * Family-shared and edited behind `scoring:write`, like the XP rates and the
 * streak rule beside it. One family, one set of badges: a badge that meant
 * something different for each child would mean nothing.
 */

import { useSyncExternalStore } from "react";

import { saveDeploymentRule } from "./deploymentRules";

/** Which figure a badge stands on. */
export type BadgeMetric = "xp" | "streak" | "stars";

export interface BadgeRule {
  /** Stable across renames — it is what a learner's record stores. */
  id: string;
  label: string;
  /** What the learner reads under the name. */
  description: string;
  /** A key into `sidebarIcons`, or `art:<id>` for a family's own picture. */
  icon: string;
  metric: BadgeMetric;
  /** What the figure has to reach. Always at least 1. */
  threshold: number;
}

/** How each metric reads on a page, in the order the editor offers them. */
export const BADGE_METRICS: { id: BadgeMetric; label: string; unit: string; hint: string }[] = [
  { id: "xp", label: "Total XP", unit: "XP", hint: "Everything the learner has ever earned." },
  {
    id: "streak",
    label: "Longest streak",
    unit: "days",
    hint: "Their best run of days, which a later break never takes away.",
  },
  { id: "stars", label: "Stars earned", unit: "stars", hint: "Best stars across every level." },
];

/**
 * The badges a family starts with.
 *
 * Six, as three short ladders — one easy rung and one to work towards on each
 * of the three figures. Duolingo runs seventeen achievement families of ten
 * tiers each, which is a wall for a seven-year-old and a wall for the parent
 * setting them up; the useful half of that design is not the count, it is that
 * a learner can always see the next rung and how far off it is. Two rungs give
 * that from the first lesson without anybody configuring anything, and a family
 * that wants a third adds one.
 *
 * The first rung of each is deliberately close: 50 XP and 3 days are reachable
 * in a first week, because a shelf that stays empty for a month is a shelf
 * nobody looks at twice.
 */
export const BADGE_DEFAULTS: BadgeRule[] = [
  {
    id: "first-steps",
    label: "First Steps",
    description: "Earned your first 50 XP.",
    icon: "sparkles",
    metric: "xp",
    threshold: 50,
  },
  {
    id: "bright-spark",
    label: "Bright Spark",
    description: "Reached 250 XP.",
    icon: "zap",
    metric: "xp",
    threshold: 250,
  },
  {
    id: "three-in-a-row",
    label: "Three in a Row",
    description: "Practised three days running.",
    icon: "flame",
    metric: "streak",
    threshold: 3,
  },
  {
    id: "week-warrior",
    label: "Week Warrior",
    description: "Practised seven days running.",
    icon: "trophy",
    metric: "streak",
    threshold: 7,
  },
  {
    id: "star-collector",
    label: "Star Collector",
    description: "Collected 10 stars.",
    icon: "star",
    metric: "stars",
    threshold: 10,
  },
  {
    id: "star-champion",
    label: "Star Champion",
    description: "Collected 50 stars.",
    icon: "award",
    metric: "stars",
    threshold: 50,
  },
];

const STORAGE_KEY = "koda_badges_v1";

/**
 * The profile row stores a learner's badges as a list capped at fifty, so a
 * family that defines more than that would earn badges the row cannot carry.
 * The limit belongs here, where somebody is adding the fifty-first.
 */
export const MAX_BADGES = 50;

const listeners = new Set<() => void>();
let version = 0;

const isMetric = (value: unknown): value is BadgeMetric =>
  value === "xp" || value === "streak" || value === "stars";

/** Turns a label into an id, so a rule is readable in a stored record. */
export const slugify = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "badge";

/**
 * Keeps a hand-edited, half-pulled or half-typed list from producing a badge
 * that cannot be earned or cannot be told apart from another.
 */
const sanitise = (raw: unknown): BadgeRule[] => {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const rules: BadgeRule[] = [];

  for (const entry of list) {
    const rule = entry as Partial<BadgeRule>;
    const label = String(rule.label ?? "").trim();
    // A badge with no name is one nobody can be told they have won.
    if (!label) continue;

    let id = String(rule.id ?? "").trim() || slugify(label);
    // Two rules under one id would be one badge as far as a stored record is
    // concerned, and the second would silently shadow the first.
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);

    rules.push({
      id,
      label: label.slice(0, 40),
      description: String(rule.description ?? "").trim().slice(0, 120),
      icon: String(rule.icon ?? "award"),
      metric: isMetric(rule.metric) ? rule.metric : "xp",
      // Zero would be a badge every learner holds from their first second,
      // which is a decoration rather than an achievement.
      threshold: Math.max(1, Math.round(Number(rule.threshold) || 1)),
    });
    if (rules.length >= MAX_BADGES) break;
  }

  return rules;
};

const load = (): BadgeRule[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return BADGE_DEFAULTS.map((rule) => ({ ...rule }));
    return sanitise((JSON.parse(raw) as { rules?: unknown }).rules);
  } catch {
    return BADGE_DEFAULTS.map((rule) => ({ ...rule }));
  }
};

let rules: BadgeRule[] = load();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rules }));
    // One answer for the deployment: a badge is the same achievement for every
    // child on this Koda, or it is not an achievement.
    void saveDeploymentRule("badges", { rules });
  } catch {
    // A blocked store costs this device the saved list and nothing else.
  }
  version += 1;
  for (const cb of listeners) cb();
};

export const BadgeAPI = {
  /** Change signal for `useSyncExternalStore`. */
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** The badges in force. Read fresh — never cache these. */
  current(): BadgeRule[] {
    return rules;
  },

  /** One rule by id, for a page resolving what a learner has earned. */
  find(id: string): BadgeRule | undefined {
    return rules.find((rule) => rule.id === id);
  },

  /** Replace the list — used by the editor after an add, edit or reorder. */
  update(next: BadgeRule[]): void {
    rules = sanitise(next);
    persist();
  },

  /** Add one, with an id derived from its label and made unique. */
  add(rule: Omit<BadgeRule, "id"> & { id?: string }): BadgeRule[] {
    rules = sanitise([...rules, { ...rule, id: rule.id ?? slugify(rule.label) }]);
    persist();
    return rules;
  },

  remove(id: string): void {
    rules = rules.filter((rule) => rule.id !== id);
    persist();
  },

  isEdited(): boolean {
    return JSON.stringify(rules) !== JSON.stringify(BADGE_DEFAULTS);
  },

  reset(): void {
    rules = BADGE_DEFAULTS.map((rule) => ({ ...rule }));
    persist();
  },
};

/* ------------------------------------------------------------------ *
 * Earning. Pure: the same figures and the same rules always give the
 * same badges, which is what makes a threshold testable.
 * ------------------------------------------------------------------ */

/** The three figures a badge can stand on, at their best ever. */
export interface BadgeFigures {
  xp: number;
  /** The *longest* streak, not today's — a badge is not lost to a bad week. */
  longestStreak: number;
  starsEarned: number;
}

const figureFor = (metric: BadgeMetric, figures: BadgeFigures): number =>
  metric === "xp" ? figures.xp : metric === "streak" ? figures.longestStreak : figures.starsEarned;

/** Every rule this learner has met, in the order the family listed them. */
export const earnedBadges = (list: BadgeRule[], figures: BadgeFigures): BadgeRule[] =>
  list.filter((rule) => figureFor(rule.metric, figures) >= rule.threshold);

/**
 * Every badge, earned or not, with how far along it the learner is.
 *
 * Earned first and then the closest of the rest, which is the order that makes
 * a shelf worth opening: what you have, then the one thing you are nearest to
 * having. A locked badge is shown rather than hidden on purpose — the gap is
 * the part that does the work, and a badge nobody can see is not a goal.
 */
export const badgeShelf = (
  list: BadgeRule[],
  figures: BadgeFigures,
): { rule: BadgeRule; earned: boolean; standing: number; progress: number }[] => {
  const entries = list.map((rule) => ({
    rule,
    earned: figureFor(rule.metric, figures) >= rule.threshold,
    standing: figureFor(rule.metric, figures),
    progress: badgeProgress(rule, figures),
  }));
  return entries.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    // Among the locked, nearest first. Among the earned, hardest first, so a
    // shelf reads as an ascent rather than as the order somebody typed them.
    return a.earned ? b.rule.threshold - a.rule.threshold : b.progress - a.progress;
  });
};

/**
 * The one to go for next: the closest badge not yet earned.
 *
 * `undefined` once a learner has them all, which is a real state a screen has
 * to handle rather than a bug — and the cue for a family to add another.
 */
export const nextBadge = (
  list: BadgeRule[],
  figures: BadgeFigures,
): { rule: BadgeRule; standing: number; progress: number } | undefined =>
  badgeShelf(list, figures).filter((entry) => !entry.earned)[0];

/** How close a learner is to a rule, 0–1. For a progress bar, not for earning. */
export const badgeProgress = (rule: BadgeRule, figures: BadgeFigures): number =>
  Math.min(1, figureFor(rule.metric, figures) / Math.max(1, rule.threshold));

/**
 * A list saved on another device.
 *
 * `apply.ts` writes the key and fires a `storage` event for every synced kind,
 * so a badge added on a parent's laptop reaches this device by the path a
 * second tab already used.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    rules = load();
    version += 1;
    for (const cb of listeners) cb();
  });
}

/** The family's badges, kept current while a component is mounted. */
export const useBadges = (): BadgeRule[] => {
  useSyncExternalStore(BadgeAPI.subscribe, BadgeAPI.version);
  return BadgeAPI.current();
};
