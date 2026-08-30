import {
  LEARNING_SCHEMA_VERSION,
  type LearningEvent,
  type LearningEventBatch,
  type SessionId,
} from "./events";

/**
 * Where learning events are kept until there is a backend.
 *
 * Two stores, on purpose:
 *
 *  - **Events** (`EVENTS_KEY`) are a capped ring. They hold the recent detail a
 *    recommender needs — which errors, how fast, how much help — and old ones
 *    are dropped.
 *  - **The profile** (`PROFILE_KEY`) is a per-concept rollup that is never
 *    trimmed. It is updated as events arrive, so a month of practice still
 *    counts after the raw events have aged out. Without this, mastery would
 *    silently reset itself every few hundred questions.
 *
 * Both are plain JSON under a versioned key. `setSink` is the seam a backend
 * plugs into: point it at an HTTP POST and nothing above this file changes.
 */

const EVENTS_KEY = "koda_learning_events_v1";
const PROFILE_KEY = "koda_learning_profile_v1";
const LEARNER_KEY = "koda_learner_id_v1";

/** Stamped on every event so an upload can be triaged by build. */
export const APP_VERSION = "1.0.0";

/**
 * How many events to keep locally, **per learner**.
 *
 * A round is roughly 30 events, so this is ~40 rounds of full detail — far more
 * than any recommendation looks at.
 *
 * Per learner, not per device, and that is the whole point. This used to be one
 * ring of 2000 trimmed oldest-first across everybody, which on a shared family
 * tablet meant a busy sibling silently evicted a quieter child's history — and
 * the quiet child is exactly the one whose few records matter most. A cap that
 * one user can spend on behalf of another is not a retention rule, it is a race.
 */
const MAX_EVENTS_PER_LEARNER = 1200;

/**
 * The ceiling for the whole device, whatever the split.
 *
 * Fairness first, quota second: the per-learner cap decides who keeps what, and
 * this only ever bites when several children share one tablet heavily. When it
 * does, it takes from whoever holds the most rather than from whoever is
 * oldest, so trimming still cannot fall entirely on one child.
 */
const MAX_EVENTS_DEVICE = 4000;

/**
 * Trim to the caps above without letting one learner's volume cost another's
 * history.
 *
 * Exported for the tests, which are the only thing that can demonstrate the
 * fairness property — it is invisible until a second child uses the tablet.
 */
/**
 * How many of a learner's days of history the device keeps.
 *
 * Seven, and counted in *days that learner actually practised* rather than as a
 * calendar window ending today. For a child who plays daily the two are the
 * same thing; for one who plays on Saturdays a rolling seven-day window would
 * hold an empty log every Friday, and the screens that read it would show a
 * child with no history at all.
 *
 * The device is not the record. The server keeps everything — that is what a
 * recommendation is built from, and why this can be small without losing
 * anything. This cap is about a tablet's storage, not about what is known.
 */
const MAX_DAYS_PER_LEARNER = 7;

export function trimPerLearner(events: LearningEvent[]): LearningEvent[] {
  const byLearner = new Map<string, LearningEvent[]>();
  for (const event of events) {
    const key = event.learnerId || "unknown";
    const list = byLearner.get(key);
    if (list) list.push(event);
    else byLearner.set(key, [event]);
  }

  for (const [key, list] of byLearner) {
    // Their seven most recent days of practice, whenever those days were.
    const days = [...new Set(list.map((e) => e.localDay).filter(Boolean))].sort();
    const keepFrom = days.length > MAX_DAYS_PER_LEARNER
      ? days[days.length - MAX_DAYS_PER_LEARNER]
      : null;
    // An event with no day recorded is kept: dropping it would be a silent loss
    // during an upgrade, and it is the one case the date cannot judge.
    let kept = keepFrom ? list.filter((e) => !e.localDay || e.localDay >= keepFrom) : list;

    // And their own most recent within that, independent of anyone else's volume.
    if (kept.length > MAX_EVENTS_PER_LEARNER) kept = kept.slice(-MAX_EVENTS_PER_LEARNER);
    byLearner.set(key, kept);
  }

  // Then, only if the device as a whole is over, take from the largest holder
  // one at a time. Taking the globally-oldest instead would put the whole cost
  // on whoever had been using the tablet longest.
  let total = [...byLearner.values()].reduce((n, list) => n + list.length, 0);
  while (total > MAX_EVENTS_DEVICE) {
    let biggest: string | null = null;
    let size = 0;
    for (const [key, list] of byLearner) {
      if (list.length > size) {
        size = list.length;
        biggest = key;
      }
    }
    if (!biggest || size === 0) break;
    byLearner.set(biggest, byLearner.get(biggest)!.slice(1));
    total -= 1;
  }

  return [...byLearner.values()].flat();
}

/** Cumulative per-concept counters. Survives event trimming. */
export interface ConceptTotals {
  conceptKey: string;
  /** Skills that have taught this concept — a concept may be shared. */
  skillIds: string[];
  questionsAnswered: number;
  correctFirstTry: number;
  supportsUsed: number;
  lessonsCompleted: number;
  lessonsAbandoned: number;
  totalResponseMs: number;
  /** Counts by `ErrorKind`, so a pattern survives event trimming too. */
  errors: Record<string, number>;
  /** ISO dates (YYYY-MM-DD) this concept was practised. Spacing matters more
   *  than volume for retention, so days are kept, not just a last-seen. */
  practisedOn: string[];
  lastSeenTs: string;
}

/**
 * Cumulative per-skill usage. The answer to "is this skill being used, and how
 * much?", kept alongside the concept rollup and equally never trimmed.
 *
 * Concepts answer "what has this child learned"; skills answer "what is getting
 * played". They are different questions — a skill can be opened constantly and
 * teach nothing, or be played twice and carry a concept to mastery — so neither
 * rollup can be derived from the other.
 */
export interface SkillTotals {
  skillId: string;
  /** Rounds opened. The play count. */
  plays: number;
  /** Rounds played to the end. */
  completed: number;
  /** Rounds left part-way. `plays - completed - abandoned` are still open. */
  abandoned: number;
  questionsAnswered: number;
  correctFirstTry: number;
  supportsUsed: number;
  /** Total time inside finished or abandoned rounds. */
  totalTimeMs: number;
  /** Local calendar days this skill was opened. */
  daysUsed: string[];
  firstUsedTs: string;
  lastUsedTs: string;
}

export interface LearningProfile {
  schemaVersion: number;
  concepts: Record<string, ConceptTotals>;
  /** Optional so a profile written before skill tracking still loads. */
  skills?: Record<string, SkillTotals>;
}

/**
 * Where a batch goes when it is flushed.
 *
 * The default keeps it local. A backend replaces this with a POST and gets
 * retry/queueing for free, because the local ring is still the source of truth
 * until a batch is acknowledged.
 */
export type LearningSink = (batch: LearningEventBatch) => Promise<void>;

let sink: LearningSink | null = null;
export const setLearningSink = (next: LearningSink | null) => {
  sink = next;
};

/* -------------------------------------------------------------------------- */
/* Persistence                                                                 */
/* -------------------------------------------------------------------------- */

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Corrupt or unavailable storage must not take the app down; a child losing
    // their history is bad, a blank screen is worse.
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — logging is best-effort by design */
  }
};

/**
 * Rows written before skills were called skills.
 *
 * The field was `pluginId` back then. Renaming the type would have orphaned
 * every event already on a device, so old rows are carried forward on read
 * rather than thrown away — a child's history is the one thing here that cannot
 * be regenerated.
 */
const migrateLegacyIds = (rows: LearningEvent[]): LearningEvent[] =>
  rows.map((row) => {
    const legacy = row as LearningEvent & { pluginId?: string };
    if (row.skillId || !legacy.pluginId) return row;
    const { pluginId, ...rest } = legacy;
    return { ...rest, skillId: pluginId } as LearningEvent;
  });

/**
 * The same rename, one level down.
 *
 * Concept totals carry the list of skills that touched them, and that array was
 * `pluginIds`. A stored profile therefore has no `skillIds`, and the rollup
 * pushed onto `undefined` — the crash this guards. The empty-array fallback
 * also covers a profile written by a future field nobody has yet.
 */
const migrateLegacyProfile = (loaded: LearningProfile): LearningProfile => {
  const legacyProfile = loaded as LearningProfile & {
    plugins?: Record<string, SkillTotals & { pluginId?: string }>;
  };

  // Per-skill usage lived under `plugins`, keyed the same way.
  if (!loaded.skills && legacyProfile.plugins) {
    loaded.skills = legacyProfile.plugins;
    delete legacyProfile.plugins;
  }
  for (const totals of Object.values(loaded.skills ?? {})) {
    const legacy = totals as SkillTotals & { pluginId?: string };
    if (!totals.skillId && legacy.pluginId) totals.skillId = legacy.pluginId;
    if (!totals.daysUsed) totals.daysUsed = [];
  }

  for (const totals of Object.values(loaded.concepts ?? {})) {
    const legacy = totals as typeof totals & { pluginIds?: string[] };
    if (!totals.skillIds) totals.skillIds = legacy.pluginIds ?? [];
    if (!totals.practisedOn) totals.practisedOn = [];
  }
  return loaded;
};

let events: LearningEvent[] = migrateLegacyIds(readJson<LearningEvent[]>(EVENTS_KEY, []));
let profile: LearningProfile = migrateLegacyProfile(
  readJson<LearningProfile>(PROFILE_KEY, {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    concepts: {},
  }),
);

const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((s) => s());

/** One session per app load — enough to tell "kept going" from "came back". */
export const currentSessionId: SessionId = `s_${Date.now().toString(36)}_${Math.random()
  .toString(36)
  .slice(2, 8)}`;

/**
 * A stable, random per-device id.
 *
 * Deliberately not derived from anything about the child — it identifies a
 * record, not a person, and carries no meaning outside this app. When real
 * accounts arrive, the account id replaces this and the schema does not change.
 */
export const learnerId: string = (() => {
  try {
    const existing = localStorage.getItem(LEARNER_KEY);
    if (existing) return existing;
    const fresh = `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(LEARNER_KEY, fresh);
    return fresh;
  } catch {
    return "l_anonymous";
  }
})();

/** Monotonic within this session. Timestamps collide; this never does. */
let seqCounter = 0;
export const nextSeq = (): number => (seqCounter += 1);

/**
 * The learner's local calendar day.
 *
 * Not `ts.slice(0, 10)` — that is the UTC day, and "practised on N separate
 * days" is a mastery criterion, so the bucket boundary decides when a child is
 * judged to have mastered something.
 *
 * The error runs against the learner. A 9pm session in Los Angeles and the next
 * morning's session are two local days but a single UTC day, so UTC bucketing
 * under-counts the spacing and holds a child at "practising" who has in fact
 * met the rule. Same story east of UTC: 1am in Bangkok is still the previous
 * UTC day.
 */
export const localDayOf = (d: Date): string => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

/**
 * A globally unique id.
 *
 * `id` is the server's idempotency key: the client re-sends a batch it never saw
 * acknowledged, so the *same* event will arrive twice and the server must
 * discard the second by primary key. That only works if ids never collide
 * between devices — a timestamp plus a few random characters does not clear
 * that bar once there are many learners, because every device is generating
 * from the same clock.
 */
export const newId = (prefix: string): string => {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : // Older WebViews: still 122 bits of randomness, just assembled by hand.
        `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random()
          .toString(16)
          .slice(2)}`;
  return `${prefix}_${uuid}`;
};

export const newEventId = (): string => newId("e");

/* -------------------------------------------------------------------------- */
/* Rollup                                                                      */
/* -------------------------------------------------------------------------- */

const emptyTotals = (conceptKey: string, ts: string): ConceptTotals => ({
  conceptKey,
  skillIds: [],
  questionsAnswered: 0,
  correctFirstTry: 0,
  supportsUsed: 0,
  lessonsCompleted: 0,
  lessonsAbandoned: 0,
  totalResponseMs: 0,
  errors: {},
  practisedOn: [],
  lastSeenTs: ts,
});

/**
 * Fold one event into the durable profile.
 *
 * Only first attempts count towards `questionsAnswered`, because a retry of a
 * question the child has already seen the answer to measures memory, not
 * understanding — counting it would inflate mastery exactly where a child is
 * struggling most.
 */
const emptySkill = (skillId: string, ts: string): SkillTotals => ({
  skillId,
  plays: 0,
  completed: 0,
  abandoned: 0,
  questionsAnswered: 0,
  correctFirstTry: 0,
  supportsUsed: 0,
  totalTimeMs: 0,
  daysUsed: [],
  firstUsedTs: ts,
  lastUsedTs: ts,
});

/** Fold one event into the per-skill usage counters. */
const applyToSkill = (event: LearningEvent) => {
  if (!event.skillId) return;
  if (!profile.skills) profile.skills = {};

  const totals = profile.skills[event.skillId] ?? emptySkill(event.skillId, event.ts);
  totals.lastUsedTs = event.ts;
  totals.daysUsed ??= [];

  const day = event.localDay ?? localDayOf(new Date(event.ts));
  if (!totals.daysUsed.includes(day)) totals.daysUsed.push(day);

  switch (event.type) {
    case "lesson_started":
      // A play is a round opened, not a round finished — otherwise a skill
      // children keep bouncing off would look unused rather than difficult.
      totals.plays += 1;
      break;
    case "lesson_completed":
      totals.completed += 1;
      totals.totalTimeMs += event.durationMs;
      break;
    case "lesson_abandoned":
      totals.abandoned += 1;
      totals.totalTimeMs += event.durationMs;
      break;
    case "answer_submitted":
      if (event.attempt === 1) {
        totals.questionsAnswered += 1;
        if (event.correct && event.supportsUsed === 0) totals.correctFirstTry += 1;
      }
      break;
    case "support_used":
      totals.supportsUsed += 1;
      break;
    default:
      break;
  }

  profile.skills[event.skillId] = totals;
};

const applyToProfile = (event: LearningEvent) => {
  applyToSkill(event);

  const key = event.conceptKey;
  if (!key) return;

  const totals = profile.concepts[key] ?? emptyTotals(key, event.ts);
  totals.lastSeenTs = event.ts;
  // Defensive, not decorative: a profile written by an older build has neither
  // of these arrays under their current names, and a rollup that throws takes
  // the whole round down with it.
  totals.skillIds ??= [];
  totals.practisedOn ??= [];
  if (!totals.skillIds.includes(event.skillId)) totals.skillIds.push(event.skillId);

  const day = event.localDay ?? localDayOf(new Date(event.ts));
  if (!totals.practisedOn.includes(day)) totals.practisedOn.push(day);

  switch (event.type) {
    case "answer_submitted":
      if (event.attempt === 1) {
        totals.questionsAnswered += 1;
        totals.totalResponseMs += event.responseMs;
        if (event.correct && event.supportsUsed === 0) totals.correctFirstTry += 1;
      }
      if (!event.correct) {
        const kind = event.errorKind ?? "unknown";
        totals.errors[kind] = (totals.errors[kind] ?? 0) + 1;
      }
      break;
    case "support_used":
      totals.supportsUsed += 1;
      break;
    case "lesson_completed":
      totals.lessonsCompleted += 1;
      break;
    case "lesson_abandoned":
      totals.lessonsAbandoned += 1;
      break;
    default:
      break;
  }

  profile.concepts[key] = totals;
};

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

// Another tab writing the log should update a viewer open in this one.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== EVENTS_KEY && e.key !== PROFILE_KEY) return;
    events = readJson<LearningEvent[]>(EVENTS_KEY, []);
    profile = readJson<LearningProfile>(PROFILE_KEY, {
      schemaVersion: LEARNING_SCHEMA_VERSION,
      concepts: {},
    });
    notify();
  });
}

export const LearningLog = {
  /**
   * Append one event.
   *
   * Skills never call this — they call `koda.learning.*`, which fills in the
   * envelope and derives the numbers. Direct access would let one skill write a
   * differently-shaped event, which is the whole thing this design prevents.
   */
  record(event: LearningEvent) {
    // Read-merge-write, not overwrite.
    //
    // This module holds the log in memory and used to write the whole array
    // back. Anything else holding its own copy — a second tab, a module
    // instance left behind by a hot reload — would then silently erase whatever
    // the other had recorded since. A child's practice history is not something
    // to lose to a second tab.
    const onDisk = readJson<LearningEvent[]>(EVENTS_KEY, []);
    const byId = new Map<string, LearningEvent>();
    for (const e of onDisk) byId.set(e.id, e);
    for (const e of events) byId.set(e.id, e);
    byId.set(event.id, event);

    events = [...byId.values()].sort((a, b) =>
      // `seq` only disambiguates within a session, which is exactly the case
      // where two events can share a millisecond.
      a.ts === b.ts ? a.seq - b.seq : a.ts < b.ts ? -1 : 1,
    );
    // Per learner, so no child's history is spent on another's. Re-sorted
    // because trimming rebuilds the array learner by learner.
    events = trimPerLearner(events).sort((a, b) =>
      a.ts === b.ts ? a.seq - b.seq : a.ts < b.ts ? -1 : 1,
    );

    // Same hazard for the rollup, and worse: counters cannot be de-duplicated
    // after the fact, so the current state is re-read before incrementing.
    profile = readJson<LearningProfile>(PROFILE_KEY, {
      schemaVersion: LEARNING_SCHEMA_VERSION,
      concepts: {},
    });
    applyToProfile(event);

    writeJson(EVENTS_KEY, events);
    writeJson(PROFILE_KEY, profile);
    notify();

    if (sink) {
      void sink({
        schemaVersion: LEARNING_SCHEMA_VERSION,
        sentAt: new Date().toISOString(),
        events: [event],
      }).catch(() => {
        /* the local ring is still the record; a failed send is not a lost event */
      });
    }
  },

  /** Newest last. Optionally filtered — the recommender reads by concept. */
  all(filter?: { conceptKey?: string; skillId?: string; since?: string }): LearningEvent[] {
    if (!filter) return [...events];
    return events.filter(
      (e) =>
        (!filter.conceptKey || e.conceptKey === filter.conceptKey) &&
        (!filter.skillId || e.skillId === filter.skillId) &&
        (!filter.since || e.ts >= filter.since),
    );
  },

  profile(): LearningProfile {
    return profile;
  },

  totals(conceptKey: string): ConceptTotals | undefined {
    return profile.concepts[conceptKey];
  },

  /** Per-skill usage, most-played first. */
  skillUsage(): SkillTotals[] {
    return Object.values(profile.skills ?? {}).sort((a, b) => b.plays - a.plays);
  },

  /** The exact JSON body a future `POST /api/learning/events` will accept. */
  exportBatch(appVersion: string = APP_VERSION): LearningEventBatch {
    return {
      schemaVersion: LEARNING_SCHEMA_VERSION,
      appVersion,
      sentAt: new Date().toISOString(),
      events: [...events],
    };
  },

  /** Both stores. Used by "reset progress" — this is a child's record, so
   *  clearing it is deliberate and total, never a silent partial wipe. */
  clear() {
    events = [];
    profile = { schemaVersion: LEARNING_SCHEMA_VERSION, concepts: {}, skills: {} };
    writeJson(EVENTS_KEY, events);
    writeJson(PROFILE_KEY, profile);
    notify();
  },

  subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};
