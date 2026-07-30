import { BookOpen, Play, RefreshCw, RotateCcw, Sparkles, Star, type LucideIcon } from "lucide-react";
import type { MasteryLevel, RecommendationKind } from "../../api/course";

/** Recommendation-kind chrome (label + icon + tone), shared across band layouts. */
export const KIND: Record<RecommendationKind, { label: string; icon: LucideIcon; tone: string }> = {
  reinforce: { label: "Give it another spin!", icon: RefreshCw, tone: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/25" },
  continue: { label: "Pick up where you left off!", icon: Play, tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:border-blue-400/25" },
  review: { label: "Memory check!", icon: RotateCcw, tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/25" },
  new: { label: "Brand new adventure!", icon: Sparkles, tone: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-400/10 dark:text-violet-300 dark:border-violet-400/25" },
  stretch: { label: "Bonus challenge!", icon: Star, tone: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-300 dark:border-sky-400/25" },
  free: { label: "Your pick!", icon: BookOpen, tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25" },
};

const LEVEL_LABEL: Record<MasteryLevel, string> = {
  not_started: "Not started",
  beginner: "Beginner",
  developing: "Developing",
  proficient: "Proficient",
  master: "Master",
};

export const levelName = (level: MasteryLevel): string => LEVEL_LABEL[level];

export const cardsLabel = (count: number): string => `${count} worksheet card${count === 1 ? "" : "s"}`;
