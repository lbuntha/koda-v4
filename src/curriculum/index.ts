import { getSkill, visibleTo } from "../skills/registry";
import { getViewer } from "../skills/viewer";
import type { Viewer } from "../skills/viewer";
import type { Lesson } from "../skills/types";
import courseJson from "./course.json";
import { withLessonEdits } from "../lib/lessonContent";
import { ChildSettingsAPI } from "../lib/childSettings";

/**
 * The course — what is taught, in what order.
 *
 * Sequencing lives here and nowhere else, so two skills can never fight over a
 * lesson's position and reordering a unit never touches a skill folder. A unit
 * may freely mix lessons from different skills: `lessons` holds
 * "skillId/lessonId" references, not imports.
 */
export interface CourseUnitConfig {
  id: string;
  unitNumber: number;
  title: string;
  description: string;
  icon: string;
  lessons: string[];
}

/** A unit with its references resolved to real lessons. */
export interface CourseUnit extends Omit<CourseUnitConfig, "lessons"> {
  lessons: ResolvedLesson[];
}

export interface ResolvedLesson extends Lesson {
  /** "skillId/lessonId" — how the course names it. */
  ref: string;
  skillId: string;
  /** Position within the whole course, 1-based. What the learner calls "level N". */
  levelNumber: number;
}

const config = courseJson.units as CourseUnitConfig[];

/**
 * Resolve one reference. Returns undefined when the owning skill is missing or
 * not visible, so disabling a skill removes its lessons from the course rather
 * than leaving a broken entry behind.
 */
/**
 * How far above a learner's age a lesson may still be offered.
 *
 * Zero would wall a child off from anything slightly ahead, which is where
 * learning happens; unlimited is what produced the current problem, where a
 * five-year-old meets Grade 2 place value inside a skill labelled for ages 5-7.
 * One year is the stretch band.
 */
const STRETCH_YEARS = 1;

function resolve(ref: string, levelNumber: number, viewer: Viewer): ResolvedLesson | undefined {
  const [skillId, lessonId] = ref.split("/");
  const owner = getSkill(skillId);
  if (!owner || !visibleTo(owner, viewer)) return undefined;

  const lesson = owner.lessons.find((l) => l.id === lessonId);
  if (!lesson) return undefined;

  // A lesson carries the age band of the standard it teaches. Anything more
  // than a year beyond the learner is held back rather than shown and failed.
  if (
    !viewer.showAllSkills &&
    lesson.ageBand &&
    lesson.ageBand[0] > viewer.age + STRETCH_YEARS
  ) return undefined;

  // A teacher's wording edit applies here, once, rather than at each display.
  return { ...withLessonEdits(skillId, lesson), ref, skillId, levelNumber };
}

/**
 * The course as the dashboard should render it: units in order, each holding
 * only lessons whose skill is present and visible. Empty units are dropped.
 */
export function getCourseUnits(viewer: Viewer = getViewer()): CourseUnit[] {
  let level = 0;
  return config
    .map((unit) => ({
      ...unit,
      lessons: unit.lessons
        .map((ref) => resolve(ref, ++level, viewer))
        .filter((l): l is ResolvedLesson => l !== undefined),
    }))
    .filter((unit) => unit.lessons.length > 0);
}

/** Every lesson in course order, flattened. */
export function getCourseLessons(viewer?: Viewer): ResolvedLesson[] {
  return getCourseUnits(viewer).flatMap((u) => u.lessons);
}

/** The lesson a given level number refers to. */
export function getLessonByLevel(
  levelNumber: number,
  viewer?: Viewer,
): ResolvedLesson | undefined {
  return getCourseLessons(viewer).find((l) => l.levelNumber === levelNumber);
}

export const totalLessonCount = (viewer?: Viewer): number => getCourseLessons(viewer).length;

/** Every lesson one skill contributes, in course order. */
export function getSkillLessons(skillId: string, viewer?: Viewer): ResolvedLesson[] {
  return getCourseLessons(viewer).filter((l) => l.skillId === skillId);
}

/**
 * Every concept the learner has already been through at least once.
 *
 * The bar here is *completion*, not mastery, and the difference matters. A
 * concept counts as mastered only after eight first attempts spread over two
 * separate days at 85% (`lib/learning/mastery.ts`) — a bar built for deciding
 * whether to advance or reteach. Gating the padlocks on it would leave a child
 * who has just played a lesson perfectly still shut out of the next one until
 * the day after tomorrow, which reads as the app being broken rather than as
 * careful pedagogy. `lib/learning/recommend.ts` already draws this line: those
 * are deliberately different bars, and this is the low one.
 */
export function satisfiedConcepts(
  completed: Record<number, number>,
  viewer?: Viewer,
  startingPoint: number | null = ChildSettingsAPI.current().startingPoint,
): Set<string> {
  const keys = new Set<string>();
  for (const lesson of getCourseLessons(viewer)) {
    if (!lesson.conceptKey) continue;
    // Either the learner finished it, or a grown-up placed them past it. The
    // second is not evidence and is never recorded as any — it only stops a
    // prerequisite the child was started beyond from locking everything after
    // it, which would leave a placed learner with nothing open at all.
    const done = (completed[lesson.levelNumber] ?? 0) > 0;
    const placedPast = startingPoint !== null && lesson.levelNumber <= startingPoint;
    if (done || placedPast) keys.add(lesson.conceptKey);
  }
  return keys;
}

/**
 * Whether a lesson is open to this learner yet.
 *
 * Answered from the lesson's own `requires`, which is where the curriculum
 * actually states its prerequisites. This used to ask a much cruder question —
 * "is the lesson before this one in the same skill finished?" — which quietly
 * turned a branching graph into a single-file queue. In the counting skill
 * alone that cost the learner a whole second entry point: `quick-dice-patterns`
 * declares no prerequisites at all and is open from day one, but sat behind
 * three unrelated lessons because it happened to be fourth in the list.
 *
 * A lesson with no `requires` is open. A lesson already completed stays open,
 * so a curriculum edit can never strand a child outside something they have
 * done.
 *
 * Lives here rather than in the page that draws the padlock, so the learning
 * path and anything else asking "can they do this yet?" cannot disagree.
 */
export function isUnlocked(
  lesson: ResolvedLesson,
  completed: Record<number, number>,
  viewer?: Viewer,
  startingPoint: number | null = ChildSettingsAPI.current().startingPoint,
): boolean {
  if ((completed[lesson.levelNumber] ?? 0) > 0) return true;
  // Placed past it: open, but still unplayed. It shows as available rather than
  // as finished, so a child who was started at Unit 3 can go back to Unit 1 —
  // and the report still says, truthfully, that they have not done it.
  if (startingPoint !== null && lesson.levelNumber <= startingPoint) return true;
  if (!lesson.requires?.length) return true;

  const satisfied = satisfiedConcepts(completed, viewer, startingPoint);
  return lesson.requires.every((key) => satisfied.has(key));
}

/**
 * The lesson "Continue" should open, out of a set the learner is looking at.
 *
 * `lessons` is whatever list is on screen — usually one skill's, in course
 * order — while `completed` stays the whole course's record, because a
 * prerequisite may live in a skill this page is not showing.
 *
 * The rule is "the first unplayed lesson after the furthest one finished". Two
 * cases make it that rather than simply "the first unplayed one":
 *
 *  - A grown-up who placed a child mid-course leaves every lesson before the
 *    starting point open but unplayed. Resuming at the earliest of those would
 *    send a child eight lessons in back to lesson one.
 *  - Lessons do not have to be finished in order: `requires` describes a graph,
 *    so a learner can legitimately be past a lesson they skipped.
 *
 * When nothing is left after the furthest finished lesson it falls back to the
 * earliest playable one — that skipped lesson is then genuinely what is next.
 * Returns undefined when there is nothing open and unplayed at all, which is
 * both "finished" and "everything remaining is locked"; the caller decides what
 * to offer instead, and must not fall back to the first lesson in the list.
 */
export function resumeLesson(
  lessons: ResolvedLesson[],
  completed: Record<number, number>,
  viewer?: Viewer,
  startingPoint?: number | null,
): ResolvedLesson | undefined {
  const played = (lesson: ResolvedLesson) => (completed[lesson.levelNumber] ?? 0) > 0;
  const open = (lesson: ResolvedLesson) =>
    !played(lesson) &&
    (startingPoint === undefined
      ? isUnlocked(lesson, completed, viewer)
      : isUnlocked(lesson, completed, viewer, startingPoint));

  const lastPlayed = lessons.reduce((at, lesson, i) => (played(lesson) ? i : at), -1);
  return lessons.slice(lastPlayed + 1).find(open) ?? lessons.find(open);
}
