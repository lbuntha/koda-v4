import type React from "react";
import type { SkillActionLog } from "../lib/skillStore";
import type { LessonEntry, SupportKind } from "../lib/learning/events";
import type { AnswerReport } from "../lib/learning/tracker";
import type { Recommendation } from "../lib/learning/recommend";

export type SoundType = "pop" | "clink" | "success" | "hint" | "levelup" | "error";

/**
 * One switchable behaviour a skill declares and checks at runtime.
 *
 * Part of the contract, so it lives here: a skill was importing it from
 * `lib/skillStore` — an app module it otherwise never touches — which made the
 * store look like part of the skill API when it is only where the store keeps
 * its copy.
 */
export interface SkillFeature {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  tag?: string;
}
export type SkillAction = SkillActionLog["actionType"];

/** Read-only copy of learner state. A copy, never live app state — live state
 *  cannot cross a process boundary if a skill is ever sandboxed. */
export interface LearnerSnapshot {
  xp: number;
  level: number;
  streakDays: number;
  /**
   * Whether `streakDays` counts days or weeks.
   *
   * A family may set the flame to count weeks — for a child who does not choose
   * when they get the tablet, a daily streak is a punishment mechanic. Anything
   * that puts the number into a sentence has to know which word to use, or it
   * tells a weekly learner they have practised "4 days in a row".
   */
  streakCadence?: "daily" | "weekly";
  problemsSolved: number;
  dailyGoal: number;
  dailySolved: number;
}

export interface SkillResult {
  levelNumber: number;
  stars: number;
  xpEarned: number;
  accuracy?: number;
}

/**
 * The global API every skill is handed.
 *
 * Injected, never a `window` global: injection can be versioned, mocked in tests,
 * scoped per skill, and survives the move to an iframe — a `window.Koda` does
 * none of those.
 *
 * Every call that could ever cross a process boundary returns a Promise, even
 * where today's implementation is synchronous. That keeps a later RPC/iframe
 * swap a drop-in instead of a rewrite of every skill.
 */
export interface KodaSDK {
  readonly skillId: string;

  /* Fire-and-forget feedback — safe to stay synchronous. */
  sound: {
    play(type: SoundType): void;
    /**
     * The device's mute preference, shared across every screen.
     *
     * Here rather than in each skill because it is one choice a learner makes
     * about the app, not about a skill — counting was reading and writing the
     * stored preference directly, which is exactly the kind of reach-around the
     * SDK exists to remove.
     */
    isEnabled(): boolean;
    setEnabled(on: boolean): void;
  };

  haptics: {
    tap(): void;
    success(): void;
    /** The vibration that matches a sound. `tap()` and `success()` are the two
     *  common cases; this covers the rest without a skill importing the driver. */
    pulse(type: SoundType): void;
  };

  speech: {
    say(text: string, opts?: { rate?: number }): Promise<void>;
    stop(): void;
    /**
     * Whether spoken output is wanted at all.
     *
     * The learner's voice preference, which is a different question from
     * `sound.isEnabled()`: that one governs pops and chimes, this one governs
     * words. Settings shows them as two switches — "Sound FX" and "Koda's
     * Voice" — so anything a skill *says* has to read this one.
     */
    isEnabled(): boolean;
  };

  /* Learner progress. XP is a host API — a skill reports what was earned and
     never owns the running total, because it is shared across all skills. */
  progress: {
    awardXp(amount: number): Promise<void>;
    complete(result: SkillResult): Promise<void>;
    snapshot(): Promise<LearnerSnapshot>;
    /**
     * What the learner should do next, decided from the learning log.
     *
     * A host API for the same reason XP is one: the answer depends on every
     * skill installed, not just this one, so a skill is in no position to
     * compute it — and the recommendation may well be to leave this skill.
     * Returns undefined when telemetry is off (a preview) or nothing is known.
     */
    nextStep(): Promise<Recommendation | undefined>;
  };

  /* Server-backed AI. Already async; the host proxies so no key reaches a skill. */
  ai: {
    tutor(userMessage: string, context?: Record<string, unknown>): Promise<string>;
    generateProblem(spec: Record<string, unknown>): Promise<unknown>;
    analyzeDrawing(imageBase64: string, prompt?: string): Promise<string>;
  };

  /* Settings and feature flags, pre-bound to this skill's id — a skill cannot
     read another skill's configuration by accident. */
  config: {
    get<T>(key: string, fallback: T): T;
    isEnabled(featureId: string, fallback?: boolean): boolean;
  };

  /**
   * Learning telemetry. The one way a skill writes to the learning log.
   *
   * A skill reports facts — this question went up, that answer came back — and
   * the SDK derives every number from them: response time, attempt index,
   * accuracy, medians, error classification. That is what makes the data
   * comparable across skills: counting and addition cannot define "accuracy"
   * differently, because neither of them computes it.
   *
   * Instrumenting a skill is these five calls. Anything a skill does not send
   * simply does not exist in the log, so a missing `present` silently costs you
   * the response times for that activity — send it even when the question is
   * uninteresting.
   */
  learning: {
    /**
     * Call when the round begins. `entry: "preview"` keeps teacher previews out
     * of the child's record entirely.
     *
     * Pass `levelNumber` if the skill navigates between lessons on its own —
     * the host re-resolves which lesson that is, so answers cannot end up filed
     * under the concept the learner started on.
     */
    startLesson(entry?: LessonEntry, levelNumber?: number): void;
    /** Call as each question goes on screen. Starts the response clock. */
    present(question: {
      questionId: string;
      index: number;
      /** Short machine key for what is being asked, e.g. "count_total". */
      taskKind: string;
      /** The question as the child saw it. Authored copy, never child input. */
      prompt?: string;
      expected?: string;
      itemCount?: number;
    }): void;
    /** Call on every submitted answer, including repeat attempts. */
    answered(report: AnswerReport): void;
    /** Call when a hint, replay or reveal is taken. */
    supportUsed(support: SupportKind, hintLevel?: number): void;
    /** Call when the round finishes. Rollups are computed here. */
    completeLesson(extras?: { stars?: number; xpEarned?: number }): void;
    /** Call when the learner leaves mid-round. */
    abandonLesson(): void;
  };

  /** Debug/action trail. Free text, not analysable — for diagnosing a skill,
   *  never for judging a learner. Use `learning` for anything pedagogical. */
  log(action: SkillAction, detail: string, level?: number, step?: number): void;

  ui: {
    readonly theme: "light" | "dark";
    exit(): void;
  };
}

/* -------------------------------------------------------------------------- */
/* Activities — what a skill can DO. The unit of reuse.                        */
/* -------------------------------------------------------------------------- */

/**
 * Which lesson is running, for chrome that has to name it.
 *
 * Display only. Telemetry identity is bound inside the SDK and never read from
 * here, so a skill cannot relabel the concept its data lands under by editing
 * what it shows. Undefined in a preview mount that supplied no lesson.
 */
export interface ActivityLesson {
  id: string;
  title: string;
  concept?: string;
  /**
   * Position in the course.
   *
   * A *lesson* number, and the chrome says so. It used to be shown as "Level 7",
   * which collided with the learner's XP level — the finish screen ended up
   * saying "Level 11!" (XP) directly above "Level 1 · Count the Row" (lesson),
   * two different numbers under one word. "Level" now only ever means the XP
   * one, the way Home already uses it.
   */
  levelNumber: number;
  /** How many lessons the course has, so a position can be read as one. */
  totalLessons?: number;
  /**
   * Whether this lesson is practice rather than teaching.
   *
   * Decided by the course (`isPracticeLesson`) and passed down, not guessed
   * from the title here: the same flag turns the scaffolding off, so the chrome
   * and the activity cannot disagree about which kind of round this is.
   */
  practice?: boolean;
}

export interface ActivityProps<P = Record<string, unknown>> {
  /** Lesson-supplied configuration, merged over the activity's defaults. */
  params: P;
  level: number;
  koda: KodaSDK;
  onComplete(result: SkillResult): void;
  /**
   * The lesson this mount is running, for the round chrome.
   *
   * Added when the second skill needed to render the standard top bar and had
   * no way to learn its own lesson's title — every route into an activity knows
   * it, so the host passes it rather than each skill re-deriving it.
   */
  lesson?: ActivityLesson;
}

/**
 * How an activity's questions go onto paper.
 *
 * A round is tapped, dragged and spoken; a worksheet is a sentence and a box to
 * write in. Most of what an activity draws cannot survive that — an object to
 * touch, a line to hop along, a frame to fill — so printing is something an
 * activity *offers* rather than something every activity has. An engine whose
 * questions are already written ones (`47 + 8`, a word problem) declares this
 * and can be printed; one whose question is the picture leaves it out, and the
 * app says so instead of printing a page of "Touch every fish".
 *
 * The two functions are the ones the round already uses, handed over unchanged:
 * a worksheet asks for exactly the questions the round would have asked, at the
 * lesson's own number ranges, which is the whole point of printing one.
 */
/**
 * One question as it must appear on paper.
 *
 * The distinction this exists to draw: a *prompt* is what the round says beside
 * a picture, and a *printed question* has to carry the whole question itself.
 * "Start at 6 and count on." is a fine prompt — the child can see the three
 * things in the second bin — and a broken worksheet, because the 3 is nowhere on
 * the page and there is no answer to write. The printed form says "Start at 6
 * and count on 3."
 *
 * `null` is a legitimate answer, and an important one: a question whose subject
 * is a picture cannot be written down at all. Counting five apples is not a
 * sentence, and inventing one that fits ("How many is 3 and 2?") would print a
 * different question from the one the lesson teaches.
 */
export interface PrintedQuestion {
  /** The question, self-contained. Everything needed to answer it is in here. */
  text: string;
  /** What belongs on the line, for the key a grown-up keeps. */
  answer: string;
}

export interface WorksheetSource<P = Record<string, unknown>> {
  /**
   * One question, drawn as the round draws it.
   *
   * `seen` is the round's own de-duplication: a sheet of twenty questions must
   * not ask 3 + 4 six times, and the engines already know how to avoid that.
   */
  build(
    params: P,
    index: number,
    seen: Set<string>,
    /**
     * What the last question was, for an engine that has to know.
     *
     * Story problems keep it so a sheet is not five sentences about the same
     * child and the same apples. Declared here even though most engines ignore
     * it, because a printer holding one ref and passing it every time is what
     * makes the variety work — and an engine that does not take it is still
     * assignable to this.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memory: { current: any },
  ): { expected?: string };
  /** The question in words, given the lesson's own prompt template if it has one. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prompt(question: any, template?: string): string;
  /**
   * The question as paper needs it, or `null` where this one cannot be written.
   *
   * Declared per technique rather than derived, because only the engine knows
   * what its question actually is. Where it is absent the sheet falls back to
   * `prompt`, which is right for the engines whose prompt already states the
   * whole problem ("47 plus 8. Add each column, and write the carry.") and
   * wrong for the ones that lean on the picture — so every engine should end up
   * declaring one.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  printed?(question: any): PrintedQuestion | null;
  /**
   * How the technique goes, in two or three lines, for the sheet to teach from.
   *
   * Declared per technique for the same reason the printed question is: a
   * lesson's `stepByStep` is written for the help panel inside a round, and
   * describes the app as often as the method — "Its number is written on the
   * lid", "Read the fact on the card", "Type the total and check it". None of
   * that survives being printed, and no word filter can reliably tell the two
   * apart.
   *
   * `null` where the mode has no method worth stating. The sheet then falls
   * back to whatever of the lesson's own steps do not mention the screen.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  method?(question: any): string[] | null;
  /**
   * The technique's apparatus, drawn for a pencil.
   *
   * A ten-frame lesson on paper should have ten-frames on it; a number-line
   * lesson should have a line to hop along. Printing the sentence and leaving
   * the picture on the screen turns every technique into the same worksheet —
   * arithmetic with a ruled line beside it — which is exactly the thing the
   * technique was invented to avoid.
   *
   * Not the round's component. Those are built for a finger: they carry theme
   * colours, hover states, springs and hit targets, none of which survive being
   * printed and several of which cost ink. What belongs here is the same figure
   * redrawn in black lines, with the parts the child fills in left empty.
   *
   * `null` where a technique's question is already complete in words — a fact
   * family, a story problem — so the sheet does not decorate for the sake of it.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  figure?(question: any): React.ReactNode | null;
}

export interface ActivityDefinition<P = Record<string, unknown>> {
  id: string;
  name: string;
  defaultParams: P;
  component: React.ComponentType<ActivityProps<P>>;
  /** Present when this activity's questions can be printed. See `lib/worksheet.ts`. */
  worksheet?: WorksheetSource<P>;
}

/**
 * Type-erased activity, as stored in a registry.
 *
 * Each activity has its own params type, so a map holding several of them cannot
 * name one concrete `P`. The erasure stops here: `ActivityProps<P>` keeps full
 * typing inside the component that declares it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyActivityDefinition = ActivityDefinition<any>;

/* -------------------------------------------------------------------------- */
/* Lessons — what is taught. Curriculum, not capability.                       */
/* -------------------------------------------------------------------------- */

export interface Lesson {
  id: string;
  title: string;
  /** What mastery is tracked against, independent of which skill hosts it. */
  concept: string;
  /** Activity reference, "skillId/activityId". May point at another skill. */
  activity: string;
  params?: Record<string, unknown>;
  /**
   * Stable machine key for what this lesson builds mastery in.
   *
   * The learning log is keyed by this, not by lesson or skill, because a
   * concept can be taught by more than one skill — counting and addition both
   * strengthen `make-ten`. Recommendation reads concepts, so a new skill
   * becomes recommendable by declaring keys, with no recommender change.
   */
  conceptKey?: string;
  /** Concepts that should be mastered first. Empty means no prerequisites. */
  requires?: string[];
  /** Emoji, for the places a lesson is named in running text. */
  icon?: string;
  /**
   * Lucide icon for the lesson, as a key of the shared `lessonIcons` registry.
   * Every surface that lists lessons — the level picker, the Skill Manager —
   * resolves this, so a lesson looks the same wherever a reader meets it.
   */
  iconName?: string;
  /** Tint for `iconName`; a key of `lessonIconTones`. Decoration only. */
  iconTone?: string;
  difficulty?: string;
  /** One-line teaching note surfaced on the dashboard. */
  pedagogyTip?: string;

  /**
   * Curriculum standards this lesson addresses, e.g. "CCSS.K.CC.B.4a".
   *
   * Authored by the skill, not validated by the host. Empty is a legitimate
   * answer, not a gap — subitizing is a research construct Common Core never
   * numbered. `docs/PLUGINS.md` §7 carries the rules a new skill follows.
   */
  standards?: string[];

  /**
   * Position on the Clements & Sarama counting learning trajectory. CCSS states
   * endpoints; the trajectory is what orders the steps between them.
   */
  trajectoryLevel?: string;

  /**
   * Age band the standard is written for. This is what gives `difficulty` a
   * meaning: a lesson is hard because it sits above the learner, not because
   * someone labelled it "Master".
   */
  ageBand?: [number, number];
}

/* -------------------------------------------------------------------------- */
/* The skill                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Learning domain. Groups skills by what they teach, independent of any national
 * grade system. The nine roadmap stages map onto these.
 */
export type LearningCategory =
  | "number-sense" // counting, subitizing, comparing, conservation
  | "patterns" // sorting, sequencing, rules
  | "operations" // addition, subtraction, multiplication
  | "place-value" // ten-frames, base ten, teen numbers
  | "fractions" // partitioning, equivalence
  | "measurement" // time, money, length
  | "geometry"; // shape, space, position

/**
 * Who a skill is for.
 *
 * Ages, not grades: grade labels differ by country (US grade 1, UK year 2,
 * different cutoffs again elsewhere), so a grade field cannot be compared across
 * learners. An age range is universal and maps onto any local system.
 */
export interface Audience {
  /** Inclusive age range in years, e.g. [5, 7]. */
  ages: [number, number];
  category: LearningCategory;
}

/**
 * How a setting should be presented. Declared in the manifest so the skill
 * manager can render controls for any skill without per-skill code.
 */
export type SettingField =
  | {
      key: string;
      label: string;
      help?: string;
      type: "number";
      min: number;
      max: number;
      step: number;
      unit?: string;
    }
  | {
      key: string;
      label: string;
      help?: string;
      type: "choice";
      options: { value: string; label: string }[];
    }
  | {
      key: string;
      label: string;
      help?: string;
      type: "text";
      /** Shown when the value is empty — use it to reveal the default in force. */
      placeholder?: string;
      maxLength?: number;
    }
  | { key: string; label: string; help?: string; type: "boolean" };

/**
 * Release state. Lets a skill ship in the bundle while staying invisible to
 * learners.
 *
 * Two states, deliberately. A `beta` tier used to sit between them, gated on a
 * device flag anyone could flip on the Skills page — which gated nothing and
 * read as a second "off" beside a skill's own disable switch. A real testers
 * tier belongs to an account, not a device, so it can come back as an
 * entitlement when there are accounts to hang it on.
 */
export type ReleaseStatus = "draft" | "published";

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  /** Technical kind, as carried by the existing `InstalledSkill` in skillStore. */
  category: "core" | "utility" | "assistant" | "visualizer" | "manipulative";
  author: string;
  iconName: string;
  /**
   * One line for the store row — shorter and warmer than `description`, which
   * is written for a developer reading a manifest. Falls back to `description`
   * when absent.
   */
  tagline?: string;
  /**
   * The tile a learner sees. One string, resolved in this order:
   *   1. starts with `http`, `/` or `data:` → an image
   *   2. an id from the SVG collection (`src/assets/svg`) → that artwork
   *   3. a key of the shared `lessonIcons` registry → that icon
   *   4. anything else → rendered as text, which is how an emoji works
   * Absent falls back to the first lesson's icon.
   */
  thumbnail?: string;
  status: ReleaseStatus;
  audience: Audience;
  /** Concept keys this skill can take a learner through. */
  teaches?: string[];
  /** Concept keys a learner should have mastered before starting this skill.
   *  What makes "recommend the next skill" a data question, not a code one. */
  requires?: string[];
}

/**
 * One complete skill, built and owned by one developer in one folder.
 *
 * It declares what it can do (`activities`) and what it teaches (`lessons`).
 * It deliberately does not decide where its lessons sit in the global order —
 * that belongs to the course, so two skills can never fight over a lesson.
 */
export interface Skill {
  manifest: SkillManifest;
  features: SkillFeature[];
  settings: Record<string, unknown>;
  /** Describes how to render each setting. Empty means the skill has none. */
  settingsSchema: SettingField[];
  activities: Record<string, AnyActivityDefinition>;
  lessons: Lesson[];
  /**
   * Ids of the artwork this skill ships in its own `assets/` folder, namespaced
   * `skillId/name` and already registered by the time this object exists.
   *
   * Declared so the skill is a complete description of itself — a reader of the
   * manifest can see what it draws with, and a picker can offer it — rather
   * than the registration being an invisible import side effect.
   */
  assets?: string[];
}
