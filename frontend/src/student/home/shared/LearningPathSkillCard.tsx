import React from "react";
import { Check, Lock, Play, RotateCcw, Star, type LucideIcon } from "lucide-react";
import type { PathSkill, SkillPathStatus } from "../../../api/course";
import { Button } from "../../../components/ui";

interface Props {
  skill: PathSkill;
  artUrl?: string;
  isNext?: boolean;
  onStart?: (skillId: string) => void;
}

interface VisualState {
  icon: LucideIcon;
  label: string;
  card: string;
  medallion: string;
  iconColor: string;
  title: string;
  status: string;
}

const STATE: Record<SkillPathStatus, VisualState> = {
  completed: {
    icon: Check,
    label: "Completed",
    card: "border-[#DCE7E3] bg-white dark:border-emerald-400/15 dark:bg-white/[0.035]",
    medallion: "border-emerald-300/40 bg-emerald-500 shadow-emerald-500/25",
    iconColor: "text-white",
    title: "text-[#2D3850] dark:text-[#F0EDF9]",
    status: "text-emerald-600 dark:text-emerald-300",
  },
  overdue: {
    icon: RotateCcw,
    label: "Practice again",
    card: "border-rose-200 bg-rose-50/45 dark:border-rose-400/25 dark:bg-rose-400/5",
    medallion: "border-rose-300/40 bg-rose-500 shadow-rose-500/25",
    iconColor: "text-white",
    title: "text-[#2D3850] dark:text-[#F0EDF9]",
    status: "text-rose-600 dark:text-rose-300",
  },
  in_progress: {
    icon: Play,
    label: "In progress",
    card: "border-[#9AAFFF] bg-[#F2F5FF] dark:border-indigo-400/40 dark:bg-indigo-400/10",
    medallion: "border-indigo-300/50 bg-[#5579EF] shadow-indigo-500/30",
    iconColor: "text-white",
    title: "text-[#253557] dark:text-white",
    status: "text-[#5570D8] dark:text-indigo-300",
  },
  new: {
    icon: Star,
    label: "Ready",
    card: "border-[#DCE3EF] bg-white dark:border-white/10 dark:bg-white/[0.035]",
    medallion: "border-violet-300/40 bg-[#7657E8] shadow-violet-500/25",
    iconColor: "text-white",
    title: "text-[#2D3850] dark:text-[#F0EDF9]",
    status: "text-[#745CC8] dark:text-violet-300",
  },
  pending: {
    icon: Lock,
    label: "Locked",
    card: "border-[#E3E8F0] bg-[#FAFBFD] dark:border-white/10 dark:bg-white/[0.02]",
    medallion: "border-[#E0E6EF] bg-[#F0F3F8] shadow-slate-400/10 dark:border-white/10 dark:bg-[#25283B]",
    iconColor: "text-[#8993A5] dark:text-[#777F96]",
    title: "text-[#667085] dark:text-[#858BA0]",
    status: "text-[#9AA3B2] dark:text-[#747B91]",
  },
};

/**
 * One reusable node on the learner's curriculum path.
 *
 * Sizing notes, because two of these look arbitrary and are not:
 *  - `min-h` rather than a fixed height. A two-line title in a fixed 9rem box was
 *    clipped horizontally through the second line ("Living or Nonliving?"), and any
 *    fixed height just moves that failure to the next longer label or larger font.
 *  - `gap-0`. Button's default `md` size carries `gap-2`, which added 8px between all
 *    three children on top of the explicit `mt-3`/`mt-auto` spacing below — roughly
 *    3px more than the card had room for, which is what did the clipping.
 *
 * Width is the parent's to set, so the same card works in a scrolling row and in a
 * grid cell that fills the available space.
 */
export const LearningPathSkillCard: React.FC<Props> = ({ skill, artUrl, isNext = false, onStart }) => {
  const status = isNext && skill.status !== "completed" ? "in_progress" : skill.status;
  const visual = STATE[status];
  const actionLabel = skill.status === "overdue" && (skill.level === "beginner" || skill.level === "developing")
    ? "Keep practicing"
    : visual.label;
  const Icon = visual.icon;
  const canStart = Boolean(onStart) && skill.playable && skill.status !== "pending";
  const [artFailed, setArtFailed] = React.useState(false);

  React.useEffect(() => setArtFailed(false), [artUrl]);

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!canStart}
      onClick={() => canStart && onStart?.(skill.skillId)}
      aria-label={`${actionLabel}: ${skill.skillLabel}`}
      className={`relative flex h-full min-h-36 w-full flex-col items-stretch justify-start gap-0 rounded-2xl border-2 px-3.5 py-3.5 text-left shadow-none transition-all ${
        visual.card
      } ${canStart ? "hover:-translate-y-1 hover:shadow-md" : "cursor-default opacity-100"}`}
    >
      <span className="flex w-full items-center justify-between gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] shadow-md ${visual.medallion}`}>
          <Icon size={17} strokeWidth={2.5} className={visual.iconColor} />
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          {artUrl && !artFailed && (
            <img
              src={artUrl}
              alt=""
              onError={() => setArtFailed(true)}
              className="h-9 w-9 object-contain"
            />
          )}
        </span>
      </span>
      <span className={`mt-3 line-clamp-2 text-xs font-black leading-tight sm:text-sm ${visual.title}`}>
        {skill.skillLabel}
      </span>
      <span className={`mt-auto text-[10px] font-extrabold sm:text-[11px] ${visual.status}`}>
        {skill.playable ? actionLabel : "No activity"}
      </span>
    </Button>
  );
};
