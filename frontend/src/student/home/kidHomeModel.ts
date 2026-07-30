import type {
  CourseQueueItem,
  CurriculumPath,
  MasteryLevel,
  PathSkill,
  SkillProgress,
  StudentProgress,
} from "../../api/course";


export interface KidReward {
  item: CourseQueueItem;
  progress: SkillProgress;
  stars: number;
}

const itemKey = (curriculumId: string, skillId: string): string =>
  `${curriculumId}:${skillId}`;

export const kidStarsForLevel = (level: MasteryLevel): number => {
  if (level === "master") return 3;
  if (level === "proficient") return 2;
  if (level === "beginner" || level === "developing") return 1;
  return 0;
};

export const buildKidRewards = (
  progress: StudentProgress | null,
  replayItems: CourseQueueItem[],
  limit = 6,
): KidReward[] => {
  if (!progress) return [];

  const playableBySkill = new Map<string, CourseQueueItem>();
  replayItems.forEach(item => {
    const key = itemKey(item.curriculumId, item.skillId);
    if (!playableBySkill.has(key) && item.questions.length > 0) {
      playableBySkill.set(key, item);
    }
  });

  return progress.skills
    .filter(skill => skill.plays > 0)
    .sort((left, right) =>
      (right.lastPracticedAt ? Date.parse(right.lastPracticedAt) : 0)
      - (left.lastPracticedAt ? Date.parse(left.lastPracticedAt) : 0)
    )
    .flatMap(skill => {
      const item = playableBySkill.get(itemKey(skill.curriculumId, skill.skillId));
      return item ? [{ item, progress: skill, stars: kidStarsForLevel(skill.level) }] : [];
    })
    .slice(0, limit);
};

const sameLocalDay = (isoDate: string, now: Date): boolean => {
  const value = new Date(isoDate);
  return value.getFullYear() === now.getFullYear()
    && value.getMonth() === now.getMonth()
    && value.getDate() === now.getDate();
};

export const kidStarsToday = (
  progress: StudentProgress | null,
  now = new Date(),
): number => progress?.skills.filter(
  skill => skill.lastPracticedAt && sameLocalDay(skill.lastPracticedAt, now),
).length ?? 0;

export const kidCatchUpItem = (
  queue: CourseQueueItem[],
): CourseQueueItem | null =>
  queue.slice(1).find(item => item.kind === "reinforce" || item.kind === "review") ?? null;

export interface KidHeroSplit {
  /** The activity the "next up" card offers, or null when the queue is empty. */
  hero: CourseQueueItem | null;
  /** Everything else, in the engine's order. */
  rest: CourseQueueItem[];
}

/**
 * Which activity gets the hero card. The engine orders the queue pedagogically — gaps before
 * forward progress — but a child who walked away mid-activity should land back on that one, so
 * an item already in progress this session takes the slot. Otherwise the engine's first pick
 * wins; this only reorders the hero, never the plan.
 */
export const pickKidHero = (queue: CourseQueueItem[]): KidHeroSplit => {
  // Free play returns the whole catalog and annotates items completed in this session.
  // Completed activities are rendered once in the completed strip, so they must not also
  // occupy the hero slot or appear again as an active recommendation.
  const active = queue.filter(item => item.status !== "completed");
  if (active.length === 0) return { hero: null, rest: [] };
  const found = active.findIndex(item => item.status === "in_progress");
  const index = found === -1 ? 0 : found;
  return { hero: active[index], rest: active.filter((_, at) => at !== index) };
};

/**
 * Why an activity was picked, in words a 6–11-year-old reads. The engine's own `reason` is
 * written for the adult preview and the run audit ("Next skill at your learning frontier"), so
 * the kid band restates it by bucket rather than showing engine language to a child. Unknown
 * kinds fall back to the server's text rather than inventing one.
 */
const KID_REASON: Record<CourseQueueItem["kind"], string> = {
  reinforce: "Give it another spin!",
  continue: "Pick up where you left off!",
  review: "Memory check!",
  new: "Brand new adventure!",
  stretch: "Bonus challenge!",
  free: "Your pick!",
};

export const kidReason = (item: CourseQueueItem): string =>
  KID_REASON[item.kind] ?? item.reason;

export interface QuestDotProgress {
  /** How many dots to draw — capped so the strip stays countable at a glance. */
  dots: number;
  /** How many of those dots are filled, proportional when the target exceeds the cap. */
  filled: number;
  /** Real activities finished, for the label. Never inflated by the dot cap. */
  done: number;
}

/**
 * Quest progress for the kid header strip. Only the dots are capped: a 12-activity quest
 * still reports "10 / 12 done" rather than rounding up to a finished-looking "8 / 8".
 */
export const questDotProgress = (
  completed: number,
  target: number,
  maxDots = 8,
): QuestDotProgress => {
  const safeTarget = Math.max(0, Math.floor(target));
  const dots = Math.min(safeTarget, maxDots);
  const done = Math.max(0, Math.min(Math.floor(completed), safeTarget));
  return {
    dots,
    filled: safeTarget > 0 ? Math.round((done / safeTarget) * dots) : 0,
    done,
  };
};

export interface KidStats {
  streakDays: number;
  totalXp: number;
  mastered: number;
  activitiesDone: number;
}

/**
 * The four headline numbers in the welcome band. Every one is read from a real contract —
 * "activities done" comes from the lessons-completed achievement counter, because there is no
 * separate "games" entity to count.
 */
export const kidStats = (
  progress: StudentProgress | null,
  streakDays: number,
): KidStats => ({
  streakDays: Math.max(0, streakDays),
  totalXp: progress?.rewardProfile?.totalXp ?? 0,
  mastered: progress?.rank.mastered ?? 0,
  activitiesDone: progress?.rewardProfile?.achievements
    .find(achievement => achievement.metric === "lessonsCompleted")?.current ?? 0,
});

/** The five-rung ladder, as an index. The whole point of a path meter is to show all of it. */
export const LEVEL_RANK: Record<MasteryLevel, number> = {
  not_started: 0,
  beginner: 1,
  developing: 2,
  proficient: 3,
  master: 4,
};

const TOP_RANK = LEVEL_RANK.master;

export interface KidSkillPath {
  id: string;
  title: string;
  /** One rung per skill, in curriculum order — the card draws these as segments. */
  rungs: MasteryLevel[];
  /** Skills at `master`. Same meaning as the welcome band's "skills mastered" tile. */
  mastered: number;
  /** Skills at `proficient` or above — secure, but not yet a trophy. */
  strong: number;
  total: number;
  duePractice: number;
  /**
   * 0–1 across the ladder, not a mastered/total ratio. A unit where every skill sits at
   * `developing` is genuinely half-way; counting only masters would read 0% and tell a
   * child their real work was worth nothing.
   */
  progress: number;
  milestone?: string;
  /** The first skill not yet mastered — what this path is actually asking for next. */
  nextSkill?: { label: string; level: MasteryLevel };
}

/**
 * Learning paths grouped by curriculum unit.
 *
 * Order is the server's: `/progress` emits skills in curriculum order (grade → subject →
 * unit → skill), so grouping by first appearance keeps paths reading Counting → Addition →
 * Subtraction. Sorting by size instead — which this used to do — scrambled that for no gain.
 *
 * Rows the server could not resolve to a released unit (historical mastery from a paused or
 * superseded assignment) carry a raw skill id as their label, so they are collected into one
 * clearly-named bucket at the end rather than mixed in as if they were a real unit.
 */
export const buildKidSkillPaths = (
  progress: StudentProgress | null,
  limit = 6,
): KidSkillPath[] => {
  if (!progress) return [];
  const groups = new Map<string, KidSkillPath & { promotedAt: number }>();
  progress.skills.forEach(skill => {
    const id = skill.unitId ?? "__unplaced__";
    const existing = groups.get(id) ?? {
      id,
      title: skill.unitLabel?.trim() || (skill.unitId ? "Other skills" : "Earlier practice"),
      rungs: [],
      mastered: 0,
      strong: 0,
      total: 0,
      duePractice: 0,
      progress: 0,
      promotedAt: 0,
    };
    existing.rungs.push(skill.level);
    existing.total += 1;
    if (skill.level === "master") existing.mastered += 1;
    if (LEVEL_RANK[skill.level] >= LEVEL_RANK.proficient) existing.strong += 1;
    if (skill.isDue) existing.duePractice += 1;
    if (!existing.nextSkill && skill.level !== "master") {
      existing.nextSkill = { label: skill.skillLabel, level: skill.level };
    }
    const promoted = skill.promotedAt ? Date.parse(skill.promotedAt) : 0;
    if (promoted > existing.promotedAt) {
      existing.promotedAt = promoted;
      existing.milestone = `Mastered ${skill.skillLabel}`;
    }
    groups.set(id, existing);
  });
  return [...groups.values()]
    .map(path => ({
      ...path,
      progress: path.total === 0
        ? 0
        : path.rungs.reduce((sum, level) => sum + LEVEL_RANK[level], 0) / (path.total * TOP_RANK),
    }))
    // Unresolved history last; everything else keeps the curriculum's own order.
    .sort((left, right) => Number(left.id === "__unplaced__") - Number(right.id === "__unplaced__"))
    .slice(0, limit)
    .map(({ promotedAt: _promotedAt, ...path }) => path);
};

export interface KidUnitCard {
  id: string;
  title: string;
  /** The unit's skills in curriculum order, each with its server-derived status. */
  skills: PathSkill[];
  /** One rung per skill, for the ladder meter. */
  rungs: MasteryLevel[];
  /** 0–1 across the five-rung ladder. */
  progress: number;
  mastered: number;
  total: number;
  duePractice: number;
  milestone?: string;
}

/**
 * One card per unit, joining the two things the page used to show in separate sections:
 * *how far along* (the mastery ladder, from `/progress`) and *where exactly* (the skill list
 * with statuses, from `/learning/path`).
 *
 * They were always the same grouping — unit — so two sections meant every unit name, count
 * and "next" line appeared twice. The road is the spine here because it is already ordered
 * and scoped to the assigned grade; mastery only contributes the rungs and the milestone.
 */
export const buildUnitCards = (
  paths: CurriculumPath[],
  progress: StudentProgress | null,
): KidUnitCard[] => {
  const promotedByUnit = new Map<string, { at: number; label: string }>();
  (progress?.skills ?? []).forEach(skill => {
    if (!skill.unitId || !skill.promotedAt) return;
    const at = Date.parse(skill.promotedAt);
    const best = promotedByUnit.get(skill.unitId);
    if (!best || at > best.at) promotedByUnit.set(skill.unitId, { at, label: skill.skillLabel });
  });

  return paths.flatMap(path => path.units).map(unit => {
    const rungs = unit.skills.map(skill => skill.level);
    const total = unit.skills.length;
    const milestone = unit.unitId ? promotedByUnit.get(unit.unitId) : undefined;
    return {
      id: `${unit.gradeId ?? "g"}:${unit.unitId ?? "other"}`,
      title: unit.unitLabel,
      skills: unit.skills,
      rungs,
      progress: total === 0
        ? 0
        : rungs.reduce((sum, level) => sum + LEVEL_RANK[level], 0) / (total * TOP_RANK),
      mastered: unit.skills.filter(skill => skill.status === "completed").length,
      total,
      duePractice: unit.skills.filter(skill => skill.status === "overdue").length,
      milestone: milestone ? `Mastered ${milestone.label}` : undefined,
    };
  });
};

/**
 * The learner's most recent score for a skill, as "N/10".
 *
 * `recentScore` is 0–1 and describes the latest session only, which is exactly what "last
 * score" claims. Returns undefined when the skill has no scored evidence, so a card shows
 * nothing rather than a number nobody earned.
 */
export const kidLastScore = (
  progress: StudentProgress | null,
  item: { curriculumId: string; skillId: string },
): string | undefined => {
  const skill = progress?.skills.find(
    row => row.curriculumId === item.curriculumId && row.skillId === item.skillId,
  );
  if (!skill || skill.plays === 0) return undefined;
  const clamped = Math.min(1, Math.max(0, skill.recentScore));
  return `${Math.round(clamped * 10)}/10`;
};

/** Mastery of one queue item's skill, for the "next up" meter. */
export const kidSkillMastery = (
  progress: StudentProgress | null,
  item: { curriculumId: string; skillId: string },
): number | undefined =>
  progress?.skills.find(
    skill => skill.curriculumId === item.curriculumId && skill.skillId === item.skillId,
  )?.score;

export interface ActivityDifficulty {
  level: "easy" | "medium" | "hard";
  label: string;
  /** Filled dots out of three. */
  filled: number;
}

const DIFFICULTY_LABEL: Record<ActivityDifficulty["level"], string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/**
 * Difficulty of an activity, from the difficulty authored on its questions: the hardest
 * question sets the level, so a mixed set is never advertised as easier than it plays.
 */
export const activityDifficulty = (item: CourseQueueItem): ActivityDifficulty | null => {
  const levels = item.questions
    .map(question => (question as { difficulty?: string }).difficulty)
    .filter((value): value is string => value === "easy" || value === "medium" || value === "hard");
  if (levels.length === 0) return null;
  const level = levels.includes("hard") ? "hard" : levels.includes("medium") ? "medium" : "easy";
  return {
    level,
    label: DIFFICULTY_LABEL[level],
    filled: level === "hard" ? 3 : level === "medium" ? 2 : 1,
  };
};

/** Unit name for a queue item, read from the progress rows that carry `unitLabel`. */
export const activityUnitLabel = (
  progress: StudentProgress | null,
  item: { curriculumId: string; skillId: string },
): string | undefined =>
  progress?.skills.find(
    skill => skill.curriculumId === item.curriculumId && skill.skillId === item.skillId,
  )?.unitLabel ?? undefined;
