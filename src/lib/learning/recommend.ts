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

const byLevel = (a: CatalogLesson, b: CatalogLesson) =>
  (a.levelNumber ?? Infinity) - (b.levelNumber ?? Infinity);

/**
 * Which lessons have actually been finished.
 *
 * Not a question mastery can answer, and asking it there is what let the path
 * skip. Mastery is keyed by *concept*, and a concept is taught by up to eight
 * lessons — `five-benchmark` has eight, `place-value-builder` seven. Finish the
 * first of those well and the concept reads "mastered", at which point every
 * filter written as "not yet mastered" quietly drops the other seven from the
 * candidate list. They are never offered again, and the learner is advanced to
 * the next concept having done an eighth of the work that teaches this one.
 *
 * Derived from the log rather than kept as new state. A caller holding the
 * durable record should pass its own instead: `completedLevels` syncs and is
 * never trimmed, while the local ring is capped and can only ever forget an old
 * completion.
 */
const completedFromLog = (): Set<string> =>
  new Set(
    LearningLog.all()
      .filter((e): e is LessonCompletedEvent => e.type === "lesson_completed")
      .map((e) => `${e.skillId}/${e.lessonId}`),
  );

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
  options: { completed?: Set<string> } = {},
): Recommendation {
  const mastery = getConceptMastery(justFinished.conceptKey);
  /* What has been done, lesson by lesson. The log is the fallback rather than
     the source: a host holding `completedLevels` should hand that over, because
     it is the record that syncs and the one the padlocks are drawn from. */
  const completed = options.completed ?? completedFromLog();

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
    /* Another lesson on the same concept — the *next* one, and one they have
       not already done. Without the second condition "one more round" could
       hand back a lesson finished three weeks ago, which is neither the round
       they were promised nor a step forward. */
    const sameConcept = catalog.lessons
      .filter(
        (l) =>
          l.conceptKey === justFinished.conceptKey &&
          l.ref !== justFinished.ref &&
          !completed.has(l.ref) &&
          isReady(l),
      )
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

  /*
   * 3. Move on — the next lesson on this skill's path.
   *
   * Next means next. This used to read "the first lesson in the skill whose
   * concept is not yet mastered", which is a different question and answers it
   * wrongly whenever a concept spans more than one lesson — most of the course.
   * A child who finished lesson 1 of eight on `five-benchmark` well enough to
   * master the concept was sent straight to lesson 9, and the seven in between
   * became unreachable: nothing else offers them, because every surface asked
   * mastery the same question.
   *
   * So the walk is positional — the first unfinished lesson *after* this one,
   * and only then, when the path ahead has run out, back to anything unfinished
   * behind it. That is the rule `curriculum.resumeLesson` uses for the Continue
   * button, and the two agreeing is the point: a learner should not be able to
   * tell which control they pressed by where it took them.
   *
   * `isReady` still gates on mastered prerequisites, so walking in order never
   * opens something the child has no foundation for.
   */
  const path = catalog.lessons.filter((l) => l.skillId === justFinished.skillId).sort(byLevel);
  const at = path.findIndex((l) => l.ref === justFinished.ref);
  const stillOpen = (l: CatalogLesson) => !completed.has(l.ref) && isReady(l);
  const nextInSkill = path.slice(at + 1).find(stillOpen) ?? path.find(stillOpen);

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

  const ready = catalog.lessons.filter((l) => l.requires.every(satisfied)).sort(byLevel);
  const statusOf = (l: CatalogLesson) => getConceptMastery(l.conceptKey);

  /*
   * Each skill's queue: everything still open in it, in the order the course
   * teaches it — and Today only ever takes from the *front* of a queue.
   *
   * That is the whole of the sequencing rule, and it is here rather than in a
   * sort because a sort can still be overtaken. The band used to be built from
   * three global buckets keyed on concept mastery — struggling, in-progress,
   * not-started — which skipped in both directions at once. Forwards, because a
   * lesson whose concept a *sibling lesson* had already mastered matched none of
   * the three and vanished: seven of the eight `five-benchmark` lessons were
   * unreachable the moment the first one went well. Sideways, because a
   * not-started lesson eleven along could outrank one in progress at position
   * four, so the child was offered the eleventh with the fourth still open.
   *
   * Practice is not in here at all — `buildCatalog` drops it before the
   * recommender sees it, and the front of a queue is a teaching lesson by
   * construction. Practice is the learner's own choice to take up, from a set
   * that is order-free by design, and `curriculum.practiceInvitation` picks
   * within it at random for exactly that reason.
   */
  const queues = new Map<string, CatalogLesson[]>();
  for (const lesson of ready) {
    if (completed.has(lesson.ref)) continue;
    const queue = queues.get(lesson.skillId);
    if (queue) queue.push(lesson);
    else queues.set(lesson.skillId, [lesson]);
  }

  /* Why this lesson is being offered — read off the concept it teaches, once
     the position has already decided *which* lesson it is. Position picks, and
     mastery only supplies the words. */
  const kindOf = (lesson: CatalogLesson): TodayPick["kind"] => {
    const status = statusOf(lesson).status;
    if (status === "struggling") return "review";
    if (status === "learning" || status === "practising") return "practise";
    return "advance";
  };

  const pickFor = (lesson: CatalogLesson): TodayPick => {
    const mastery = statusOf(lesson);
    const kind = kindOf(lesson);
    if (kind === "review") {
      return {
        lesson,
        kind,
        kidMessage: "Let's warm up with something you already know!",
        reason: `First-try accuracy on ${lesson.conceptKey} is ${(
          mastery.firstTryAccuracy * 100
        ).toFixed(0)}%.`,
      };
    }
    if (kind === "practise") {
      return {
        lesson,
        kind,
        kidMessage: "One more round to make it stick!",
        reason: `${lesson.conceptKey} is in progress but not yet secure.`,
      };
    }
    return {
      lesson,
      kind,
      kidMessage: "Ready for something new?",
      reason:
        mastery.status === "mastered"
          ? `${lesson.conceptKey} is secure; this is the next lesson on the path.`
          : `Every prerequisite for ${lesson.conceptKey} is met.`,
    };
  };

  /* Which skill goes first — repair, then whatever is under way, then something
     new. The ladder `recommendNext` climbs, applied across skills rather than
     within one: it decides the *order* the queues are drawn from and never
     which lesson comes out of a queue. */
  const rank = (lesson: CatalogLesson) =>
    kindOf(lesson) === "review" ? 0 : kindOf(lesson) === "practise" ? 1 : 2;

  const order = (a: CatalogLesson, b: CatalogLesson): number => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    /* Among things under way, the most recently touched — otherwise a child
       accumulates half-open threads and closes none of them. */
    if (rank(a) === 1) {
      const byRecency = (statusOf(b).lastSeenTs ?? "").localeCompare(statusOf(a).lastSeenTs ?? "");
      if (byRecency !== 0) return byRecency;
    }
    return byLevel(a, b);
  };

  const skillOrder = [...queues.entries()]
    .sort(([, a], [, b]) => order(a[0], b[0]))
    .map(([skillId]) => skillId);

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

  /*
   * One step back, when something is not landing. At most one: a page that
   * opens with nothing but remediation tells a child they are behind, which is
   * never the message.
   *
   * Backwards or where they stand — never past open work. A struggling concept
   * further along the path is repaired when the learner gets there; jumping to
   * it now would skip the lessons in between, which is the thing this function
   * exists to stop.
   */
  const repair = ready
    .filter((l) => statusOf(l).status === "struggling")
    .filter((l) => completed.has(l.ref) || queues.get(l.skillId)?.[0]?.ref === l.ref)[0];
  if (repair) take(pickFor(repair));

  /* Every skill's next lesson before any skill's lesson after that: one thing
     to do in each subject reads as a choice, two in one and none in the other
     reads as a list. */
  for (let depth = 0; depth < maxPerSkill && picked.length < limit; depth += 1) {
    for (const skillId of skillOrder) {
      const lesson = queues.get(skillId)?.[depth];
      if (lesson) take(pickFor(lesson));
    }
  }

  /* Always leave one door forward. All-review is accurate and demoralising. */
  if (picked.length === limit && !picked.some((p) => p.kind === "advance")) {
    const forward = skillOrder
      .flatMap((skillId) => (queues.get(skillId) ?? []).slice(0, maxPerSkill))
      .find((l) => kindOf(l) === "advance" && !picked.some((p) => p.lesson.ref === l.ref));
    if (forward) picked[picked.length - 1] = pickFor(forward);
  }

  return picked;
}
