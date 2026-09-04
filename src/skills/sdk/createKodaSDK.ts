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
import { playClip, stopClip, voiceFloorHeld } from "../../lib/voiceClips";
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
  /** Sequential next lesson in this skill. Null means this path is complete. */
  nextLesson?: { lessonNumber: number; open(): void } | null;
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

/**
 * How long a spoken line may wait on the server before the device says it.
 *
 * Deliberately short, and shorter than the round's own 2.6s cap on waiting for
 * a word (`useSpokenFinish`). On an unstable connection a request can stall
 * without failing, and every extra second is one where the child hears nothing
 * — and worse, where a late answer arrives to be spoken over the *next*
 * question. The device's own voice, now, beats Koda's voice, eventually.
 */
const SPEECH_TIMEOUT_MS = 4_000;

async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 0,
): Promise<T | null> {
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    // The Gemini key is the server's now: this sends the session's token and
    // the tutor server resolves the key behind it.
    const res = await fetch(path, {
      method: "POST",
      headers: await tutorHeaders(),
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
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

  /**
   * Whether one of this skill's declared features is on.
   *
   * Lifted out of `config` because `speech` needs it too. Whether a skill may
   * speak is a question about a feature, and asking it in two places is exactly
   * how the count-along ended up honouring the switch while the Read-aloud
   * button ignored it.
   */
  const featureEnabled = (featureId: string, fallback = false): boolean => {
    if (knownToStore()) return SkillStoreAPI.isFeatureEnabled(skillId, featureId, fallback);
    const declared = defaults.features.find((f) => f.id === featureId);
    return declared ? declared.isEnabled : fallback;
  };

  /** How hard this skill's pulses land, if it declares a preference at all. */
  const hapticIntensity = (): string => {
    if (knownToStore()) {
      return SkillStoreAPI.getSkillSetting<string>(skillId, "hapticIntensity", "crisp");
    }
    return (defaults.settings.hapticIntensity as string | undefined) ?? "crisp";
  };

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

    /*
     * Vibration, gated here on this skill's own `haptic_feedback`.
     *
     * The same argument as `speech.say` below: asked once, of the skill that is
     * actually running. Before, the vibration util itself looked the flag up
     * under a hard-coded skill id — counting's — so a parent silencing haptics
     * in counting stopped them in every other skill, while addition's identical
     * switch was checked a second time in each of its twelve activities and did
     * nothing on its own. Skills may now simply vibrate.
     */
    haptics: {
      tap() {
        if (!featureEnabled("haptic_feedback", true)) return;
        triggerTapPopHaptic({ intensity: hapticIntensity() });
      },
      success() {
        if (!featureEnabled("haptic_feedback", true)) return;
        triggerHaptic("success", { intensity: hapticIntensity() });
      },
      pulse(type: SoundType) {
        if (!featureEnabled("haptic_feedback", true)) return;
        const intensity = hapticIntensity();
        if (type === "pop") triggerTapPopHaptic({ intensity });
        else triggerHaptic(type, { intensity });
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

        /*
         * Yield to Koda.
         *
         * While the voice coach is live, the child is in a conversation over an
         * open microphone. A skill counting "four, five, six" over the top of it
         * is not merely rude — the count is picked up by the mic and answered as
         * though the child had said it. Every line a skill speaks goes through
         * here, so this is the one place the rule has to hold.
         *
         * Resolves rather than rejects: a caller may be awaiting this before it
         * submits an answer, and a round must never stall on a sound.
         */
        if (voiceFloorHeld()) return;

        /*
         * The two switches that decide whether a skill may talk at all.
         *
         * `isVoiceEnabled()` is the learner's own: Settings shows "Sound FX"
         * and "Koda's Voice" as separate switches, and anything a skill *says*
         * belongs to the second. `audio_speech` is the per-skill one a parent
         * flips in the Skill Manager, so a family can keep one lesson's voice
         * and silence another.
         *
         * Both are checked here rather than in each activity, because in the
         * activities they were checked inconsistently: the count-along honoured
         * the feature and the Read-aloud button did not, so a lesson with its
         * voice switched off stayed quiet only until a child pressed the
         * speaker. The learner's own preference was read by praise alone — so
         * turning the voice off in Settings silenced "Nice work!" while the
         * lesson carried on counting out loud, and opening a question still
         * read the prompt aloud every time.
         */
        if (!isVoiceEnabled()) return;
        if (!featureEnabled("audio_speech", true)) return;

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

        const data = await postJson<{ audio?: string }>(
          "/api/tutor/speech",
          { text, voice: "Kore" },
          SPEECH_TIMEOUT_MS,
        );
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
      isEnabled: featureEnabled,
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
      nextLesson: host.nextLesson ?? null,
    },
  };
}
