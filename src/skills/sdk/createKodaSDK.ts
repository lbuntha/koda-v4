import { SkillStoreAPI } from "../../lib/skillStore";
import { tutorHeaders } from "../../lib/tutorApi";
import {
  isSoundEnabled,
  isVoiceEnabled,
  playBase64Pcm,
  playSound,
  setSoundEnabled,
  speakWebSpeech,
} from "../../utils/audio";
import { playClip, stopClip } from "../../lib/voiceClips";
import { triggerHaptic, triggerTapPopHaptic } from "../../utils/haptics";
import type {
  KodaSDK,
  LearnerSnapshot,
  SkillAction,
  SkillFeature,
  SkillResult,
  SoundType,
} from "../types";
import { LessonTracker } from "../../lib/learning/tracker";
import type { LearningContext, LessonEntry, SupportKind } from "../../lib/learning/events";
import type { Recommendation } from "../../lib/learning/recommend";
import type { AnswerReport } from "../../lib/learning/tracker";

/**
 * A skill's own declared defaults, used when the persisted store has no entry
 * for this id yet — a freshly registered skill must still work before anyone has
 * opened the Skill Manager.
 */
export interface SkillDefaults {
  features: SkillFeature[];
  settings: Record<string, unknown>;
}

/**
 * Services the app must supply. Everything else the SDK builds for itself.
 * Kept deliberately small — the more the host injects, the more a skill can
 * accidentally depend on.
 */
export interface KodaHost {
  awardXp(amount: number): void;
  completeSkill(result: SkillResult): void;
  getSnapshot(): LearnerSnapshot;
  theme: "light" | "dark";
  exit(): void;
  /**
   * Which lesson a course level is, for skills that navigate internally.
   *
   * Counting ships its own level picker, so the lesson can change without the
   * host remounting. The skill says "I moved to level 3"; the host — which owns
   * the course — decides that means `comparing-two-groups` / `comparer`. A skill
   * still never names the concept its data lands under.
   */
  lessonForLevel?(level: number): Omit<LearningContext, "skillId" | "activityId"> | undefined;
  /** What to do next, given the lesson just finished. Owned by the host because
   *  the answer ranges over every installed skill. */
  recommendNext?(finished: {
    conceptKey: string;
    lessonId: string;
    skillId: string;
  }): Recommendation | undefined;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    // The Gemini key is the server's now: this sends the session's token and
    // the tutor server resolves the key behind it.
    const res = await fetch(path, {
      method: "POST",
      headers: await tutorHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Builds the global API for one skill.
 *
 * `skillId` is bound once here, so a skill can neither read another skill's
 * configuration nor log under another skill's name — the bug that exists today
 * where counting logs against "step-header-tagger".
 *
 * Calls that could ever cross a process boundary return Promises even where the
 * current implementation is synchronous, so sandboxing a skill later is a swap
 * rather than a rewrite of every skill.
 */
export function createKodaSDK(
  skillId: string,
  host: KodaHost,
  defaults: SkillDefaults = { features: [], settings: {} },
  learningContext?: LearningContext,
): KodaSDK {
  const knownToStore = () => SkillStoreAPI.getSkill(skillId) !== undefined;

  // Bound to this mount's lesson, so a skill cannot log against another
  // lesson's concept any more than it can read another skill's settings.
  // Without a context the host is running the skill outside a lesson (a demo,
  // a standalone render) and telemetry is a no-op rather than a wrong record.
  const tracker = learningContext
    ? new LessonTracker({ ...learningContext, skillId })
    : null;

  return {
    skillId,

    sound: {
      play(type: SoundType) {
        playSound(type);
      },
      isEnabled() {
        return isSoundEnabled();
      },
      setEnabled(on: boolean) {
        setSoundEnabled(on);
      },
    },

    haptics: {
      tap() {
        triggerTapPopHaptic();
      },
      success() {
        triggerHaptic("success");
      },
      pulse(type: SoundType) {
        if (type === "pop") triggerTapPopHaptic();
        else triggerHaptic(type);
      },
    },

    speech: {
      /**
       * Say a line, and resolve once it has been *said*.
       *
       * The promise used to resolve as soon as playback was started, which is
       * fine for a caller that only fires and forgets — but counting waits for
       * the last number before it congratulates the child, and a caller cannot
       * wait on "started". Resolving at the end of the line lets it.
       *
       * Interrupted counts as the end: whatever spoke next has the floor, and a
       * waiter must not be left holding a promise for a clip that has stopped.
       */
      async say(text: string, opts?: { rate?: number }) {
        if (!text) return;

        // A recorded line first, and synchronously: this is the whole point.
        // Counting speaks a number on every tap, and asking Gemini for "three"
        // each time put a network round trip between a child's finger and the
        // word. Authored phrases are recorded by `scripts/generate-voice.mjs`.
        //
        // The resolver is made before the call so `playClip` still runs in the
        // same tick as the tap — a mobile browser only lets audio start from
        // inside the gesture that asked for it.
        let spoken!: () => void;
        const finished = new Promise<void>((resolve) => {
          spoken = resolve;
        });
        if (playClip(text, opts?.rate ?? 1, spoken)) {
          await finished;
          return;
        }

        const data = await postJson<{ audio?: string }>("/api/tutor/speech", {
          text,
          voice: "Kore",
        });
        if (data?.audio) {
          const source = playBase64Pcm(data.audio);
          if (source) await new Promise<void>((resolve) => (source.onended = () => resolve()));
          return;
        }
        // Server unavailable or no key configured — the browser still speaks.
        await new Promise<void>((resolve) => {
          speakWebSpeech(text, opts?.rate, resolve);
        });
      },
      stop() {
        stopClip();
        window.speechSynthesis?.cancel();
      },
      isEnabled() {
        return isVoiceEnabled();
      },
    },

    progress: {
      async awardXp(amount: number) {
        host.awardXp(amount);
      },
      async complete(result: SkillResult) {
        host.completeSkill(result);
      },
      async snapshot() {
        // A copy, never live state — live state cannot cross a boundary.
        return { ...host.getSnapshot() };
      },
      async nextStep() {
        // No lesson context means telemetry is off for this mount, so there is
        // nothing to base advice on and guessing would be worse than silence.
        if (!learningContext || !host.recommendNext) return undefined;
        return host.recommendNext({
          conceptKey: learningContext.conceptKey,
          lessonId: learningContext.lessonId,
          skillId,
        });
      },
    },

    ai: {
      async tutor(message: string, ctx: Record<string, unknown> = {}) {
        const data = await postJson<{ replyText?: string }>("/api/tutor/respond", {
          userMessage: message,
          ...ctx,
        });
        return data?.replyText ?? "";
      },
      async generateProblem(spec: Record<string, unknown>) {
        return await postJson<unknown>("/api/tutor/generate-problem", spec);
      },
      async analyzeDrawing(imageBase64: string, prompt = "") {
        const data = await postJson<{ feedback?: string }>("/api/tutor/analyze-drawing", {
          image: imageBase64,
          prompt,
        });
        return data?.feedback ?? "";
      },
    },

    config: {
      get<T>(key: string, fallback: T): T {
        if (knownToStore()) return SkillStoreAPI.getSkillSetting<T>(skillId, key, fallback);
        const declared = defaults.settings[key];
        return (declared === undefined ? fallback : declared) as T;
      },
      isEnabled(featureId: string, fallback = false) {
        if (knownToStore()) return SkillStoreAPI.isFeatureEnabled(skillId, featureId, fallback);
        const declared = defaults.features.find((f) => f.id === featureId);
        return declared ? declared.isEnabled : fallback;
      },
    },

    learning: {
      startLesson(entry?: LessonEntry, levelNumber?: number) {
        // Re-point the tracker before opening the round, so the first event of
        // the new lesson is already filed under the new concept.
        if (levelNumber !== undefined && host.lessonForLevel) {
          const resolved = host.lessonForLevel(levelNumber);
          if (resolved) tracker?.updateContext(resolved);
        }
        tracker?.startLesson(entry);
      },
      present(question) {
        tracker?.present(question);
      },
      answered(report: AnswerReport) {
        tracker?.answered(report);
      },
      supportUsed(support: SupportKind, hintLevel?: number) {
        tracker?.supportUsed(support, hintLevel);
      },
      completeLesson(extras) {
        tracker?.completeLesson(extras);
      },
      abandonLesson() {
        tracker?.abandonLesson();
      },
    },

    log(action: SkillAction, detail: string, level = 0, step?: number) {
      SkillStoreAPI.logAction(skillId, action, level, step, "info", detail);
    },

    ui: {
      theme: host.theme,
      exit: host.exit,
    },
  };
}
