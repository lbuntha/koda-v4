import React from "react";
import { CheckCircle2, Clock, Play, RotateCcw, Star, Target, Zap } from "lucide-react";

export type RecommendationTone = "purple" | "blue" | "green" | "amber" | "pink";
export type ActivityCardStatus = "practice" | "completed" | "new";

/** Three dots, filled to the level — costs a row nothing and needs no words. */
const LEVEL_DOT: Record<"easy" | "medium" | "hard", string> = {
  easy: "bg-emerald-500",
  medium: "bg-amber-500",
  hard: "bg-rose-500",
};

interface Props {
  tone?: RecommendationTone;
  status?: ActivityCardStatus;
  title: string;
  /** Unit name from the curriculum. */
  subtitle?: string;
  /** The skill's published artwork URL, or undefined when the curriculum sent none. */
  artUrl?: string;
  /** Why the engine picked this — shown verbatim, never invented. */
  reason?: string;
  lastScore?: string;
  /** Authored on the questions — the hardest one sets the level. */
  difficulty?: { label: string; filled: number; level: "easy" | "medium" | "hard" };
  minutes?: number;
  xp?: number;
  onStart: () => void;
}

const BADGE_CONFIG = {
  practice: {
    label: "GIVE IT ANOTHER SPIN!",
    Icon: Target,
    badgeBg: "bg-[#FF6B00]",
    border: "border-2 border-[#FFD2B8] dark:border-amber-500/30",
    btn: "border-2 border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-400 dark:hover:text-slate-950",
    btnText: "Practice",
  },
  completed: {
    label: "ACTIVITY COMPLETE!",
    Icon: CheckCircle2,
    badgeBg: "bg-[#00B862]",
    border: "border-2 border-[#B8F0D0] dark:border-emerald-500/30",
    btn: "border-2 border-[#00B862] text-[#00B862] hover:bg-[#00B862] hover:text-white dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-400 dark:hover:text-slate-950",
    btnText: "Replay",
  },
  new: {
    label: "BRAND NEW ADVENTURE!",
    Icon: Star,
    badgeBg: "bg-[#6346F1]",
    border: "border-2 border-[#D0C5FF] dark:border-indigo-500/30",
    btn: "bg-[#6346F1] text-white hover:bg-[#5235E0] shadow-md shadow-indigo-500/20 dark:shadow-none",
    btnText: "Play",
  },
};

export const RecommendationCard: React.FC<Props> = ({
  status,
  tone = "purple",
  title,
  subtitle,
  artUrl,
  reason,
  lastScore,
  difficulty,
  minutes,
  xp,
  onStart,
}) => {
  // Infer badge type if not explicitly supplied
  const type: ActivityCardStatus = status ?? (
    tone === "amber" || reason?.toLowerCase().includes("practice") ? "practice" :
    tone === "green" ? "completed" : "new"
  );

  const config = BADGE_CONFIG[type];
  const BadgeIcon = config.Icon;

  return (
    <article className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white p-3 sm:p-3.5 transition-shadow hover:shadow-md dark:bg-[#191338] ${config.border}`}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          {/* One pill, not two lines: the badge and the reason carried the same signal —
              "NEW FOR YOU" above "Brand new for you". The pill keeps the colour coding and
              the icon, and says it in the warmer wording the kid band writes. */}
          <span className={`inline-flex max-w-full items-center gap-1 rounded-full ${config.badgeBg} px-2 py-0.5 text-[10px] font-extrabold text-white`}>
            <BadgeIcon size={11} className="shrink-0 fill-current text-white" />
            <span className="truncate">{reason || config.label}</span>
          </span>

          <h3 className="mt-1.5 line-clamp-2 text-sm font-black leading-tight text-[#1E1538] sm:text-base dark:text-[#F2EEFF]">
            {title}
          </h3>

          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[#8C84A3] dark:text-[#9A94B8]">
              {subtitle}
            </p>
          )}
        </div>

        {/* Same rule as NextUpCard: the skill's published artwork or an honest gap. No
            fallback art, and no raw-markup branch — `artUrl` is a URL by construction. */}
        {artUrl ? (
          <img
            src={artUrl}
            data-art-src={artUrl}
            alt=""
            className="h-16 w-16 shrink-0 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105 sm:h-20 sm:w-20"
          />
        ) : (
          <span
            data-art-src="none"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 px-1 text-center text-[9px] font-bold leading-tight text-slate-400 sm:h-20 sm:w-20 dark:border-white/20 dark:text-slate-500"
          >
            No artwork
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* One meta row for every state. `lastScore` used to print here *and* as a chip
            above, so a completed card stated the same score twice. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-[#6E6480] dark:text-[#9A94B8]">
          {lastScore && (
            <span className={type === "completed" ? "font-extrabold text-[#00B862] dark:text-emerald-400" : ""}>
              Last {lastScore}
            </span>
          )}
          {difficulty && (
            <span className="inline-flex items-center gap-0.5" title={`${difficulty.label} difficulty`}>
              {[0, 1, 2].map(dot => (
                <span
                  key={dot}
                  className={`h-1.5 w-1.5 rounded-full ${
                    dot < difficulty.filled ? LEVEL_DOT[difficulty.level] : "bg-slate-200 dark:bg-white/15"
                  }`}
                />
              ))}
            </span>
          )}
          {typeof minutes === "number" && (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} className="text-[#8C84A3]" /> {minutes} min
            </span>
          )}
          {typeof xp === "number" && (
            <span className="inline-flex items-center gap-1">
              <Zap size={12} className="fill-current text-amber-500" />
              {type === "completed" ? `+${xp} XP` : `${xp} XP`}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onStart}
          aria-label={`${config.btnText} ${title}`}
          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-extrabold transition-all ${config.btn}`}
        >
          {type === "completed" && <RotateCcw size={12} />}
          {type === "new" && <Play size={12} className="fill-current" />}
          {config.btnText}
        </button>
      </div>
    </article>
  );
};
