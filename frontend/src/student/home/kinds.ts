import { BookOpen, RefreshCw, RotateCcw, Sparkles, Star, type LucideIcon } from "lucide-react";
import type { MasteryLevel, RecommendationKind } from "../../api/course";

/** Recommendation-kind chrome (label + icon + tone), shared across band layouts. */
export const KIND: Record<RecommendationKind, { label: string; icon: LucideIcon; tone: string }> = {
  reinforce: { label: "Reinforce", icon: RefreshCw, tone: "bg-rose-50 text-rose-700 border-rose-200" },
  review: { label: "Review", icon: RotateCcw, tone: "bg-amber-50 text-amber-700 border-amber-200" },
  new: { label: "New", icon: Sparkles, tone: "bg-violet-50 text-violet-700 border-violet-200" },
  stretch: { label: "Stretch", icon: Star, tone: "bg-sky-50 text-sky-700 border-sky-200" },
  free: { label: "Free practice", icon: BookOpen, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
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
