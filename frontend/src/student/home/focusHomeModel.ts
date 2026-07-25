import type {
  CourseQueueItem,
  RecommendationKind,
  StudentProgress,
} from "../../api/course";

export const FOCUS_DUE_KINDS: ReadonlySet<RecommendationKind> = new Set([
  "review",
  "reinforce",
]);

export const estimateFocusMinutes = (queue: CourseQueueItem[]): number => {
  const cards = queue.reduce((sum, item) => sum + item.questions.length, 0);
  return Math.max(1, Math.round((cards * 30) / 60));
};

export const focusProficiency = (progress: StudentProgress | null): number => {
  const assigned = progress?.rank.assignedSkills ?? 0;
  if (assigned === 0) return 0;
  return Math.round(((progress?.rank.proficientPlus ?? 0) / assigned) * 100);
};

export const focusItemIsDue = (
  item: CourseQueueItem,
  progress: StudentProgress | null,
): boolean => FOCUS_DUE_KINDS.has(item.kind) || Boolean(progress?.skills.some(
  skill => skill.curriculumId === item.curriculumId
    && skill.skillId === item.skillId
    && skill.isDue,
));

export const focusDueCount = (
  queue: CourseQueueItem[],
  progress: StudentProgress | null,
): number => queue.filter(item => focusItemIsDue(item, progress)).length;

export const focusBarHeight = (count: number, maximum: number): string => {
  if (count <= 0 || maximum <= 0) return "h-1";
  const ratio = count / maximum;
  if (ratio <= 0.2) return "h-3";
  if (ratio <= 0.4) return "h-6";
  if (ratio <= 0.6) return "h-10";
  if (ratio <= 0.8) return "h-14";
  return "h-20";
};
