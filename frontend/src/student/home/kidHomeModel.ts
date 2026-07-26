import type {
  CourseQueueItem,
  MasteryLevel,
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

export interface KidSkillPath {
  id: string;
  title: string;
  mastered: number;
  total: number;
  duePractice: number;
  milestone?: string;
}

const MASTERED_LEVELS: MasteryLevel[] = ["proficient", "master"];

/**
 * Learning paths grouped by curriculum unit. Units without a label fall back to a neutral
 * "Other skills" bucket rather than showing a raw id to a child.
 */
export const buildKidSkillPaths = (
  progress: StudentProgress | null,
  limit = 6,
): KidSkillPath[] => {
  if (!progress) return [];
  const groups = new Map<string, KidSkillPath & { promotedAt: number }>();
  progress.skills.forEach(skill => {
    const id = skill.unitId ?? "other";
    const existing = groups.get(id) ?? {
      id,
      title: skill.unitLabel?.trim() || "Other skills",
      mastered: 0,
      total: 0,
      duePractice: 0,
      promotedAt: 0,
    };
    existing.total += 1;
    if (MASTERED_LEVELS.includes(skill.level)) existing.mastered += 1;
    if (skill.isDue) existing.duePractice += 1;
    const promoted = skill.promotedAt ? Date.parse(skill.promotedAt) : 0;
    if (promoted > existing.promotedAt) {
      existing.promotedAt = promoted;
      existing.milestone = `Mastered ${skill.skillLabel}`;
    }
    groups.set(id, existing);
  });
  return [...groups.values()]
    .sort((left, right) => right.total - left.total)
    .slice(0, limit)
    .map(({ promotedAt: _promotedAt, ...path }) => path);
};

/** Mastery of one queue item's skill, for the "next up" meter. */
export const kidSkillMastery = (
  progress: StudentProgress | null,
  item: { curriculumId: string; skillId: string },
): number | undefined =>
  progress?.skills.find(
    skill => skill.curriculumId === item.curriculumId && skill.skillId === item.skillId,
  )?.score;

/**
 * Short glyph for a skill-path tile. Presentational only: derived from the unit name so the
 * tile reads at a glance ("+" for addition), with counting digits as the neutral default.
 */
export const skillPathGlyph = (title: string): string => {
  const name = title.toLowerCase();
  if (name.includes("subtract") || name.includes("take away")) return "−";
  if (name.includes("multipl") || name.includes("times")) return "×";
  if (name.includes("divi")) return "÷";
  if (name.includes("add") || name.includes("sum")) return "+";
  if (name.includes("shape") || name.includes("geometr")) return "◆";
  if (name.includes("measure") || name.includes("time")) return "⏱";
  return "123";
};

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
