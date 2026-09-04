import type {
  KodaSDK,
  LearnerSnapshot,
  SkillAction,
  SkillResult,
  SoundType,
} from "../../types";
import type { LessonEntry, SupportKind } from "../../../lib/learning/events";
import type { AnswerReport } from "../../../lib/learning/tracker";

/**
 * A KodaSDK that records instead of doing.
 *
 * Every skill talks to the host through this one interface, so faking it is all
 * it takes to run an activity with no app around it. The recording is the point:
 * a skill's contract with the host is *which calls it makes, in what order*, and
 * that is otherwise invisible — a round can look perfect on screen while never
 * filing a single learning event.
 */

/** One recorded call, in the order it happened. */
export interface RecordedCall {
  name: string;
  args: unknown[];
}

export interface FakeKoda {
  sdk: KodaSDK;
  /** Every call, newest last. */
  calls: RecordedCall[];
  /** Calls of one kind, e.g. `only("learning.present")`. */
  only(name: string): RecordedCall[];
  /** How many times a call was made. */
  count(name: string): number;
  /** The `log(action, …)` trail, which is what the Activity log shows. */
  actions: { action: SkillAction; detail: string; level?: number; step?: number }[];
  /** Results handed to `progress.complete`. */
  completed: SkillResult[];
  /** Total XP awarded through `progress.awardXp`. */
  xpAwarded: number;
  /** End every line `holdSpeech` is holding, as a finished clip would. */
  finishSpeaking(): void;
  reset(): void;
}

export interface FakeKodaOptions {
  skillId?: string;
  /** What `config.get` returns for a key. Defaults to the caller's fallback. */
  settings?: Record<string, unknown>;
  /** Feature flags for `config.isEnabled`. */
  features?: Record<string, boolean>;
  snapshot?: Partial<LearnerSnapshot>;
  theme?: "light" | "dark";
  /** The learner's voice preference, as `speech.isEnabled()` reports it. */
  voiceEnabled?: boolean;
  /**
   * Leave `speech.say()` unresolved until `finishSpeaking()` is called.
   *
   * A real `say()` resolves when the line has finished playing, and an activity
   * may wait on that — counting holds the round open until the last number has
   * been said. Resolving instantly hides whether the wait is honoured, so a test
   * about that timing takes the clip's end into its own hands.
   */
  holdSpeech?: boolean;
}

const EMPTY_SNAPSHOT: LearnerSnapshot = {
  xp: 0,
  level: 1,
  streakDays: 0,
  problemsSolved: 0,
  dailyGoal: 5,
  dailySolved: 0,
};

export function createFakeKoda(options: FakeKodaOptions = {}): FakeKoda {
  const calls: RecordedCall[] = [];
  const actions: FakeKoda["actions"] = [];
  const completed: SkillResult[] = [];
  let xpAwarded = 0;
  /** Resolvers for lines still being "spoken" under `holdSpeech`. */
  const speaking: (() => void)[] = [];

  const record = (name: string, ...args: unknown[]) => {
    calls.push({ name, args });
  };

  const vibrates = () => options.features?.haptic_feedback ?? true;

  const sdk: KodaSDK = {
    skillId: options.skillId ?? "test-skill",

    sound: {
      play: (type: SoundType) => record("sound.play", type),
      isEnabled: () => true,
      setEnabled: (on: boolean) => record("sound.setEnabled", on),
    },

    /* Silent when the skill's own `haptic_feedback` is off, because the real
       SDK is: it swallows the pulse there so an activity never has to ask. A
       fake that recorded it anyway would let a test prove a switch works when
       the app it stands in for had stopped honouring it. */
    haptics: {
      tap: () => {
        if (vibrates()) record("haptics.tap");
      },
      success: () => {
        if (vibrates()) record("haptics.success");
      },
      pulse: (type: SoundType) => {
        if (vibrates()) record("haptics.pulse", type);
      },
    },

    speech: {
      say: (text: string, opts?: { rate?: number }) => {
        record("speech.say", text, opts);
        if (!options.holdSpeech) return Promise.resolve();
        return new Promise<void>((resolve) => speaking.push(resolve));
      },
      stop: () => record("speech.stop"),
      isEnabled: () => options.voiceEnabled ?? true,
    },

    progress: {
      awardXp: async (amount: number) => {
        record("progress.awardXp", amount);
        xpAwarded += amount;
      },
      complete: async (result: SkillResult) => {
        record("progress.complete", result);
        completed.push(result);
      },
      snapshot: async () => ({ ...EMPTY_SNAPSHOT, ...options.snapshot }),
      nextStep: async () => undefined,
    },

    ai: {
      tutor: async () => "",
      generateProblem: async () => ({}),
      analyzeDrawing: async () => "",
    },

    config: {
      get: <T,>(key: string, fallback: T): T =>
        (options.settings?.[key] as T | undefined) ?? fallback,
      isEnabled: (featureId: string, fallback = true) =>
        options.features?.[featureId] ?? fallback,
    },

    learning: {
      startLesson: (entry?: LessonEntry, levelNumber?: number) =>
        record("learning.startLesson", entry, levelNumber),
      present: (question) => record("learning.present", question),
      answered: (report: AnswerReport) => record("learning.answered", report),
      supportUsed: (support: SupportKind, hintLevel?: number) =>
        record("learning.supportUsed", support, hintLevel),
      completeLesson: (extras) => record("learning.completeLesson", extras),
      abandonLesson: () => record("learning.abandonLesson"),
    },

    log: (action: SkillAction, detail: string, level?: number, step?: number) => {
      record("log", action, detail, level, step);
      actions.push({ action, detail, level, step });
    },

    ui: {
      theme: options.theme ?? "light",
      exit: () => record("ui.exit"),
      nextLesson: null,
    },
  };

  return {
    sdk,
    calls,
    actions,
    completed,
    get xpAwarded() {
      return xpAwarded;
    },
    only: (name: string) => calls.filter((c) => c.name === name),
    count: (name: string) => calls.filter((c) => c.name === name).length,
    finishSpeaking: () => {
      speaking.splice(0).forEach((resolve) => resolve());
    },
    reset: () => {
      calls.length = 0;
      actions.length = 0;
      completed.length = 0;
      xpAwarded = 0;
      speaking.splice(0).forEach((resolve) => resolve());
    },
  };
}
