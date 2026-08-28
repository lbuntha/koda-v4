import { SyncEngine, storageKeyFor } from "./sync";
import { currentLearnerId } from "./learnerProgress";

/**
 * What a parent decides about how Koda behaves for one child.
 *
 * Its own document, keyed by the child it is *for*, for the reason
 * `dailyGoal.ts` gives at length: a parent sets these from their own device,
 * and that device holds nothing of the child's to attach them to.
 *
 * One document rather than one per control, so the next setting a parent asks
 * for is a field here and nothing else — no kind, no endpoint, no page
 * plumbing. That is what B1 bought.
 *
 * **Every default is today's behaviour.** A family that never opens this screen
 * must not notice it exists: no cap, help on, streak counted by the day. A
 * default that changed something would make shipping this a silent product
 * change for everyone who already uses Koda.
 *
 * Rights are the server's business, and it holds the matching half: writing
 * needs `learner:update`, which a parent has over their children and a student
 * over only themselves — a student being their own learner, with a row minted
 * at signup so there is something for these to be keyed to. A child's device *reads* this — it is where the rules
 * are enforced — and is refused when it tries to write. A cap a child can lift
 * is not a cap.
 */

export type GoalCadence = "daily" | "weekly";

/*
 * A type alias rather than an interface, and not by taste: an interface has no
 * implicit index signature, so it cannot be handed to `recordDoc`, whose body
 * is a `Record<string, unknown>`. An alias can, which keeps the sync call free
 * of a cast that would have to be repeated by every store like this one.
 */
export type ChildSettings = {
  /**
   * Minutes of play a day, or `null` for no cap.
   *
   * Checked when a round *starts*, never mid-round: a child two questions from
   * the end of a lesson should finish it. So the cap is a floor on when the
   * next round may begin, not a stopwatch that cuts them off — which also
   * means a session may overrun by up to one round's length, on purpose.
   */
  sessionMinutes: number | null;
  /**
   * Whether Koda's help is offered to this child at all.
   *
   * Composes with the plan rather than replacing it: the family must have
   * `ai.koda` *and* the parent must have left this on. Two different people
   * saying no for two different reasons, and a child should be told which.
   */
  aiHelpEnabled: boolean;
  /**
   * Whether the streak counts days or weeks.
   *
   * `weekly` exists because for a four-to-eight-year-old a daily streak is a
   * punishment mechanic: the child does not control device access, the parent
   * does, and a run broken because Tuesday was busy teaches a six-year-old that
   * the app is arbitrary. Counting weeks keeps the reward and drops the blame.
   */
  goalCadence: GoalCadence;
  /**
   * The last level this child is treated as already past, or `null` to start
   * at the beginning.
   *
   * The manual form of placement: "Mia already knows counting to twenty, start
   * her at Unit 3." Deliberately **not** implemented by writing mastery
   * evidence the child never earned — that would poison the parent's own report
   * with concepts marked secure on zero questions answered, and the report is
   * only worth reading because it is true. This opens the door; it does not
   * claim anybody walked through it.
   *
   * Adaptive placement, when it exists, writes this same field. The manual
   * control and the automatic one then share one data model, and the report
   * stays honest under both.
   */
  startingPoint: number | null;
  /**
   * Which teacher Koda is for this child, or `null` for the default.
   *
   * A child's setting rather than a family's, because that is the point of
   * having more than one: a six-year-old and an eleven-year-old in the same
   * house do not want the same teacher. Only ever an id — the manner behind it
   * lives on the server, where a client cannot rewrite it (`tutor/persona.ts`).
   *
   * An id that no longer exists falls back to the default rather than breaking,
   * so an operator may retire a character without stranding anybody.
   */
  personaId: string | null;
};

export const CHILD_SETTINGS_DEFAULTS: ChildSettings = {
  sessionMinutes: null,
  aiHelpEnabled: true,
  goalCadence: "daily",
  startingPoint: null,
  personaId: null,
};

/** Below this a cap is not a limit, it is a locked door. */
export const SESSION_MINUTES_MIN = 5;
/** Three hours is not a cap anybody is enforcing; it is a shrug. */
export const SESSION_MINUTES_MAX = 180;

/** Shared prefix of every learner's key, for the storage listener below. */
const BASE_KEY = "koda_child_settings_v1";

const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version += 1;
  for (const cb of listeners) cb();
};

const keyFor = (learnerId: string): string => storageKeyFor("childSettings", learnerId)!;

const clampMinutes = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(SESSION_MINUTES_MAX, Math.max(SESSION_MINUTES_MIN, Math.round(n)));
};

/**
 * Read a stored body into a complete, sane settings object.
 *
 * Never throws and never returns a partial: a half-pulled document or a value
 * somebody hand-edited falls back to the default for that field alone, so one
 * bad number cannot switch off a cap that was set beside it.
 */
const sanitise = (raw: Partial<ChildSettings> | null): ChildSettings => ({
  sessionMinutes: clampMinutes(raw?.sessionMinutes),
  // `!== false`, not `?? true`: anything that is not an explicit "off" leaves
  // help on, because losing it to a malformed document is the worse failure.
  aiHelpEnabled: raw?.aiHelpEnabled !== false,
  goalCadence: raw?.goalCadence === "weekly" ? "weekly" : "daily",
  startingPoint: clampLevel(raw?.startingPoint),
  // A string or nothing. Not checked against the roster here: this runs before
  // the roster has loaded, and an id nobody recognises already falls back to
  // the default teacher when it is looked up.
  personaId: typeof raw?.personaId === "string" && raw.personaId ? raw.personaId : null,
});

/** A level number, or `null` for "from the beginning". Never negative. */
const clampLevel = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
};

const read = (learnerId: string): ChildSettings => {
  try {
    const raw = localStorage.getItem(keyFor(learnerId));
    return sanitise(raw ? (JSON.parse(raw) as Partial<ChildSettings>) : null);
  } catch {
    return { ...CHILD_SETTINGS_DEFAULTS };
  }
};

export const ChildSettingsAPI = {
  /** Change signal for `useSyncExternalStore`. */
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** One child's settings, complete, with defaults where nothing was set. */
  for(learnerId: string): ChildSettings {
    return read(learnerId);
  },

  /** The settings that apply to whoever is playing on this device right now. */
  current(): ChildSettings {
    return read(currentLearnerId());
  },

  /** Whether anybody has set anything for this child, as opposed to inheriting. */
  isSet(learnerId: string): boolean {
    try {
      return localStorage.getItem(keyFor(learnerId)) !== null;
    } catch {
      return false;
    }
  },

  /**
   * Change some of a child's settings, leaving the rest alone.
   *
   * A patch rather than a whole body, because two controls on one screen must
   * not overwrite each other — and because the document is the growth seam, so
   * a caller that predates a field should not be able to erase it.
   */
  set(learnerId: string, patch: Partial<ChildSettings>): ChildSettings {
    const next = sanitise({ ...read(learnerId), ...patch });
    try {
      localStorage.setItem(keyFor(learnerId), JSON.stringify(next));
    } catch {
      // A blocked store costs this device the saved value; the upload still
      // carries it to the child's own device.
    }
    SyncEngine.recordDoc("childSettings", learnerId, next, { learnerId });
    notify();
    return next;
  },
};

/**
 * Settings changed on another device.
 *
 * `apply.ts` writes the learner's key and announces it, so a cap a parent sets
 * on their phone reaches the child's tablet by the path a second tab already
 * uses — and the tablet is where it is enforced.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(`${BASE_KEY}__`)) return;
    notify();
  });
}
