import React from "react";
import { Clock, Play, RotateCcw, Zap } from "lucide-react";
import { Button } from "../../../components/ui";
import { ACTIVITY_ART, ACTIVITY_CARD } from "./dimensions";

export type ActivityState = "next" | "practice" | "completed" | "new";

interface Props {
  state: ActivityState;
  title: string;
  /** Unit or subject line under the title. */
  context?: string;
  artUrl: string;
  /** Authored in the curriculum; omitted entirely when the author left it blank. */
  minutes?: number;
  xp?: number;
  /** Completed activities show what was earned instead of what is available. */
  xpEarned?: number;
  /** 0–1, e.g. last score on a practice card. */
  lastScore?: number;
  questionCount?: number;
  onStart: () => void;
}

const STATE: Record<ActivityState, { label: string; chip: string; cta: string; panel: string }> = {
  next: {
    label: "Next up",
    chip: "bg-[#5C46DF] text-white dark:bg-[#7C63F5]",
    cta: "Continue",
    panel: "bg-[image:linear-gradient(160deg,#EFEBFF,#E4F6FF)] dark:bg-violet-400/10",
  },
  practice: {
    label: "Practice next",
    chip: "bg-amber-500 text-white dark:bg-amber-500",
    cta: "Practice",
    panel: "bg-[image:linear-gradient(160deg,#FFF3DE,#FFF8E7)] dark:bg-amber-400/10",
  },
  completed: {
    label: "Completed",
    chip: "bg-emerald-600 text-white dark:bg-emerald-500",
    cta: "Replay",
    panel: "bg-[image:linear-gradient(160deg,#E6F8EE,#EFFAE1)] dark:bg-emerald-400/10",
  },
  new: {
    label: "New for you",
    chip: "bg-violet-600 text-white dark:bg-violet-500",
    cta: "Play",
    panel: "bg-[image:linear-gradient(160deg,#F2ECFF,#FFECF7)] dark:bg-violet-400/10",
  },
};

/** One activity, in any of its four states. Used by every learner band. */
export const ActivityCard: React.FC<Props> = ({
  state,
  title,
  context,
  artUrl,
  minutes,
  xp,
  xpEarned,
  lastScore,
  questionCount,
  onStart,
}) => {
  const meta = STATE[state];
  const completed = state === "completed";
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-[1.5rem] bg-white/92 dark:bg-[#191338]/92 ${ACTIVITY_CARD}`}
    >
      <div className={`relative flex shrink-0 items-center justify-center ${ACTIVITY_ART} ${meta.panel}`}>
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${meta.chip}`}
        >
          {meta.label}
        </span>
        <img
          src={artUrl}
          alt=""
          className="h-[74%] w-[74%] object-contain mix-blend-multiply dark:mix-blend-normal"
        />
      </div>

      <div className="flex flex-1 flex-col px-4 py-3.5">
        <h3 className="text-base font-black leading-tight text-[#21183D] dark:text-[#F2EEFF]">{title}</h3>
        {context && (
          <p className="mt-0.5 truncate text-[11px] font-bold text-[#6E6480] dark:text-[#9A94B8]">{context}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-[#6E6480] dark:text-[#9A94B8]">
          {typeof minutes === "number" && (
            <span className="inline-flex items-center gap-1"><Clock size={12} /> {minutes} min</span>
          )}
          {typeof questionCount === "number" && questionCount > 0 && (
            <span>{questionCount} question{questionCount === 1 ? "" : "s"}</span>
          )}
          {completed && typeof xpEarned === "number" ? (
            <span className="inline-flex items-center gap-1 font-black text-amber-700 dark:text-amber-300">
              <Zap size={12} className="fill-current" /> +{xpEarned} XP
            </span>
          ) : typeof xp === "number" ? (
            <span className="inline-flex items-center gap-1 font-black text-amber-700 dark:text-amber-300">
              <Zap size={12} className="fill-current" /> {xp} XP
            </span>
          ) : null}
        </div>

        {typeof lastScore === "number" && (
          <p className="mt-2 inline-flex w-fit rounded-lg bg-[#F4F1FD] px-2 py-1 text-[11px] font-black text-[#4D4263] dark:bg-white/10 dark:text-[#C7BFE4]">
            Last score {Math.round(lastScore * 10)}/10
          </p>
        )}

        <Button
          type="button"
          onClick={onStart}
          className={`mt-auto h-11 w-full rounded-full border-transparent text-sm font-black uppercase tracking-wide ${
            completed
              ? "bg-white text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-50 dark:bg-white/10 dark:text-emerald-200 dark:ring-emerald-400/25"
              : "bg-gradient-to-r from-[#7663F4] to-[#5844DE] text-white shadow-md"
          }`}
        >
          {completed ? <RotateCcw size={16} /> : <Play size={16} className="fill-current" />} {meta.cta}
        </Button>
      </div>
    </article>
  );
};
