import { getConceptMastery, type ConceptMastery } from "./mastery";
import { LearningLog } from "./learningLog";
import type { LessonCompletedEvent } from "./events";

/**
 * What to do next, decided from the log.
 *
 * The recommender knows nothing about counting or addition. It reads concepts
 * and prerequisites, both of which are declared in a skill's own JSON — so a new
 * skill becomes recommendable by shipping its manifest, with no change here.
 */

/** A lesson, as the recommender needs to see it. Built from the registry. */
export interface CatalogLesson {
  /** "skillId/lessonId". */
  ref: string;
  skillId: string;
  lessonId: string;
  title: string;
  conceptKey: string;
  /** Concepts that should be in hand first. Empty means "no prerequisites". */
  requires: string[];
  levelNumber?: number;
  ageBand?: [number, number];
}

/** A skill, as the recommender needs to see it. */
export interface CatalogSkill {
  skillId: string;
  name: string;
  /** Concepts this skill can take a learner through. */
  teaches: string[];
  /** Concepts a learner should have mastered before starting it. */
  requires: string[];
  ageBand?: [number, number];
}

export interface Catalog {
  lessons: CatalogLesson[];
  skills: CatalogSkill[];
}

export type RecommendationKind =
  /** Go back to something easier — the current concept is not landing. */
  | "review"
  /** Same concept again; the idea is there but not secure. */
  | "practise"
  /** Next lesson in this skill. */
  | "advance"
  /** A different skill has just become available. */
  | "new-skill"
  /** Nothing left that the learner is ready for. */
  | "none";

export interface Recommendation {
  kind: RecommendationKind;
  /** Words for the grown-up: why this, in terms of the evidence. */
  reason: string;
  /** Words for the child: short, positive, no jargon, no scores. */
  kidMessage: string;
  lesson?: CatalogLesson;
  skill?: CatalogSkill;
  /** The mastery reading this was based on, for the parent/teacher view. */
  basis?: ConceptMastery;
}

/**
 * How well the round that just ended went.
 *
 * Advancing and mastery are deliberately different bars. Mastery governs what a
 * skill unlocks and needs evidence across days; advancing to the next lesson
 * only needs the child to have just done well. Holding both to the mastery bar
 * meant a perfect five-question round still said "one more round" — which reads
 * to a five-year-old as being told they failed.
 */
const lastRound = (ref: string): LessonCompletedEvent | undefined => {
  const [, lessonId] = ref.split("/");
  const completed = LearningLog.all().filter(
    (e): e is LessonCompletedEvent => e.type === "lesson_completed" && e.lessonId === lessonId,
  );
  return completed[completed.length - 1];
};

/** Good enough to move on: most of the round right, first time, unaided. */
export const ADVANCE_ACCURACY = 0.8;

const isSatisfied = (conceptKey: string): boolean => {
  const m = getConceptMastery(conceptKey);
  return m.status === "mastered";
};

/** A lesson is ready if every prerequisite concept is mastered. */
export const isReady = (lesson: CatalogLesson): boolean => lesson.requires.every(isSatisfied);

const notYetMastered = (lesson: CatalogLesson): boolean =>
  getConceptMastery(lesson.conceptKey).status !== "mastered";

const byLevel = (a: CatalogLesson, b: CatalogLesson) =>
  (a.levelNumber ?? Infinity) - (b.levelNumber ?? Infinity);

/**
 * Decide what comes after finishing `justFinished`.
 *
 * Order matters and is pedagogical, not arbitrary: a child who is struggling is
 * never advanced, and a child who is merely unproven is never sent to a new
 * skill on the strength of one good round. Moving forward is the last branch,
 * not the first.
 */
export function recommendNext(
  justFinished: { conceptKey: string; ref: string; skillId: string },
  catalog: Catalog,
): Recommendation {
  const mastery = getConceptMastery(justFinished.conceptKey);

  /* 1. Struggling — step back to a prerequisite the child can succeed at. */
  if (mastery.status === "struggling") {
    const current = catalog.lessons.find((l) => l.ref === justFinished.ref);
    const prereqKey = current?.requires.find((c) => !isSatisfied(c));
    const easier = prereqKey
      ? catalog.lessons.filter((l) => l.conceptKey === prereqKey && isReady(l)).sort(byLevel)[0]
      : undefined;

    if (easier) {
      return {
        kind: "review",
        reason: `First-try accuracy is ${(mastery.firstTryAccuracy * 100).toFixed(
          0,
        )}% on ${justFinished.conceptKey}. Going back to ${prereqKey} first.`,
        kidMessage: "Let's warm up with something you already know!",
        lesson: easier,
        basis: mastery,
      };
    }
  }

  /* 2. Not yet secure — more of the same concept, ideally a different lesson.
        A strong round just now overrides this: the child has shown they can do
        it, and repeating it would punish success. */
  const round = lastRound(justFinished.ref);
  const justDidWell = round !== undefined && round.firstTryAccuracy >= ADVANCE_ACCURACY;

  if (
    !justDidWell &&
    (mastery.status === "learning" || mastery.status === "practising" || mastery.status === "struggling")
  ) {
    const sameConcept = catalog.lessons
      .filter((l) => l.conceptKey === justFinished.conceptKey && l.ref !== justFinished.ref && isReady(l))
      .sort(byLevel)[0];

    const repeat = catalog.lessons.find((l) => l.ref === justFinished.ref);

    return {
      kind: "practise",
      reason:
        mastery.questionsAnswered < 8
          ? `Only ${mastery.questionsAnswered} first attempts so far — not enough to call it either way.`
          : `First-try accuracy is ${(mastery.firstTryAccuracy * 100).toFixed(0)}%; mastery needs 85% across two days.`,
      kidMessage: "One more round to make it stick!",
      lesson: sameConcept ?? repeat,
      basis: mastery,
    };
  }

  /* 3. Move on — the next lesson in this skill the child is ready for.
        `isReady` still gates on mastered prerequisites, so a strong round does
        not unlock something the child has no foundation for. */
  const nextInSkill = catalog.lessons
    .filter((l) => l.skillId === justFinished.skillId && notYetMastered(l) && isReady(l))
    .sort(byLevel)[0];

  if (nextInSkill) {
    return {
      kind: "advance",
      reason: justDidWell
        ? `Scored ${(round.firstTryAccuracy * 100).toFixed(0)}% first-try in the last round.`
        : `${justFinished.conceptKey} is mastered; prerequisites for ${nextInSkill.conceptKey} are met.`,
      kidMessage: "Nice work! Ready for the next one?",
      lesson: nextInSkill,
      basis: mastery,
    };
  }

  /* 4. Nothing left here — a new skill the learner has just unlocked. */
  const unlockedSkill = catalog.skills
    .filter((s) => s.skillId !== justFinished.skillId)
    .filter((s) => s.requires.length > 0 && s.requires.every(isSatisfied))
    .filter((s) => s.teaches.some((c) => !isSatisfied(c)))[0];

  if (unlockedSkill) {
    return {
      kind: "new-skill",
      reason: `Every prerequisite for ${unlockedSkill.name} (${unlockedSkill.requires.join(
        ", ",
      )}) is mastered, and no lessons remain in ${justFinished.skillId}.`,
      kidMessage: `You unlocked ${unlockedSkill.name}!`,
      skill: unlockedSkill,
      basis: mastery,
    };
  }

  /* 5. A skill with no prerequisites the learner has not started. */
  const freshSkill = catalog.skills
    .filter((s) => s.skillId !== justFinished.skillId && s.requires.length === 0)
    .filter((s) => s.teaches.some((c) => getConceptMastery(c).status === "not-started"))[0];

  if (freshSkill) {
    return {
      kind: "new-skill",
      reason: `No lessons remain in ${justFinished.skillId}; ${freshSkill.name} has no unmet prerequisites.`,
      kidMessage: `Time to try ${freshSkill.name}!`,
      skill: freshSkill,
      basis: mastery,
    };
  }

  return {
    kind: "none",
    reason: "Every available lesson is either mastered or blocked by an unmet prerequisite.",
    kidMessage: "You've finished everything here. Amazing!",
    basis: mastery,
  };
}


/* -------------------------------------------------------------------------- */
/* What to do right now, from a cold start                                     */
/* -------------------------------------------------------------------------- */

export interface TodayPick {
  lesson: CatalogLesson;
  /** Why this lesson is here — same vocabulary `recommendNext` uses. */
  kind: Extract<RecommendationKind, "review" | "practise" | "advance">;
  /** Words for the child. */
  kidMessage: string;
  /** Words for the grown-up. */
  reason: string;
}

export interface RecommendNowOptions {
  /** How many picks to return. */
  limit?: number;
  /** Cap per skill, so one subject cannot fill the whole band. */
  maxPerSkill?: number;
  /** Lesson refs the learner has already completed. */
  completed?: Set<string>;
  /**
   * Whether a prerequisite counts as met.
   *
   * Injected rather than fixed because the caller decides which bar it is
   * asking about, and the two bars are genuinely different. Opening a padlock
   * asks "have they been through this?" — `curriculum.satisfiedConcepts`.
   * Judging whether a child is *ready to build on* something asks "have they
   * proved it?" — mastery, which is the default here and what `recommendNext`
   * uses. A surface that draws padlocks must pass its own predicate, or Today
   * will offer fewer lessons than the map shows open and the two will disagree.
   */
  isSatisfied?: (conceptKey: string) => boolean;
}

/**
 * What to do now, across every skill — the cold-start counterpart to
 * `recommendNext`.
 *
 * `recommendNext` answers "you just finished X, now what?" and returns one
 * thing. Opening the app is a different question with no `justFinished` to
 * anchor on, and it wants a small set of choices rather than a single order.
 * The ladder is deliberately the same, in the same order — a child who is
 * struggling is offered repair before novelty, and unfinished work before
 * something new — because two surfaces disagreeing about what comes next is a
 * bug, not a feature.
 */
export function recommendNow(catalog: Catalog, options: RecommendNowOptions = {}): TodayPick[] {
  const {
    limit = 3,
    maxPerSkill = 2,
    completed = new Set<string>(),
    isSatisfied: satisfied = isSatisfied,
  } = options;

  const ready = catalog.lessons.filter((l) => l.requires.every(satisfied));
  const open = ready.filter((l) => !completed.has(l.ref));
  const statusOf = (l: CatalogLesson) => getConceptMastery(l.conceptKey);

  /* 1. Repair. At most one: a page that opens with nothing but remediation
        tells a child they are behind, which is never the message. */
  const repair: TodayPick[] = ready
    .filter((l) => statusOf(l).status === "struggling")
    .sort(byLevel)
    .slice(0, 1)
    .map((lesson) => ({
      lesson,
      kind: "review" as const,
      kidMessage: "Let's warm up with something you already know!",
      reason: `First-try accuracy on ${lesson.conceptKey} is ${(
        statusOf(lesson).firstTryAccuracy * 100
      ).toFixed(0)}%.`,
    }));

  /* 2. Finish what is started, most recently touched first — otherwise a child
        accumulates a dozen half-open threads and closes none of them. */
  const finish: TodayPick[] = open
    .filter((l) => ["learning", "practising"].includes(statusOf(l).status))
    .sort((a, b) => (statusOf(b).lastSeenTs ?? "").localeCompare(statusOf(a).lastSeenTs ?? ""))
    .map((lesson) => ({
      lesson,
      kind: "practise" as const,
      kidMessage: "One more round to make it stick!",
      reason: `${lesson.conceptKey} is in progress but not yet secure.`,
    }));

  /* 3. Something new. */
  const advance: TodayPick[] = open
    .filter((l) => statusOf(l).status === "not-started")
    .sort(byLevel)
    .map((lesson) => ({
      lesson,
      kind: "advance" as const,
      kidMessage: "Ready for something new?",
      reason: `Every prerequisite for ${lesson.conceptKey} is met.`,
    }));

  const picked: TodayPick[] = [];
  const perSkill = new Map<string, number>();
  const take = (pick: TodayPick): boolean => {
    if (picked.length >= limit) return false;
    if (picked.some((p) => p.lesson.ref === pick.lesson.ref)) return false;
    const used = perSkill.get(pick.lesson.skillId) ?? 0;
    if (used >= maxPerSkill) return false;
    perSkill.set(pick.lesson.skillId, used + 1);
    picked.push(pick);
    return true;
  };

  for (const pick of [...repair, ...finish, ...advance]) take(pick);

  /* Always leave one door forward. All-review is accurate and demoralising. */
  if (picked.length === limit && !picked.some((p) => p.kind === "advance")) {
    const forward = advance.find((p) => !picked.some((q) => q.lesson.ref === p.lesson.ref));
    if (forward) picked[picked.length - 1] = forward;
  }

  return picked;
}
