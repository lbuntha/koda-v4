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
