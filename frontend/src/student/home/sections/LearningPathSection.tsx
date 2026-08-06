import React, { useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Calculator,
  Check,
  Flag,
  FlaskConical,
  Lock,
  Play,
  RotateCcw,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { PathSkill, SkillPathStatus } from "../../../api/course";
import { Button } from "../../../components/ui";
import type { KidUnitCard } from "../kidHomeModel";

interface Props {
  units: KidUnitCard[];
  subtitle: string;
  subjectId?: string;
  subjectName: string;
  thumbnailBySkillId: ReadonlyMap<string, string | undefined>;
  nextSkillId?: string | null;
  onStartSkill: (skillId: string) => void;
  onViewAll: () => void;
}

interface NodeStyle {
  icon: LucideIcon;
  label: string;
  node: string;
  iconClass: string;
  labelClass: string;
}

interface SubjectPalette {
  icon: LucideIcon;
  iconWell: string;
  activeNode: string;
  activeLabel: string;
}

const subjectPalette = (subjectId: string | undefined, subjectName: string): SubjectPalette => {
  const subject = `${subjectId ?? ""} ${subjectName}`.toLowerCase();
  if (subject.includes("science")) {
    return {
      icon: FlaskConical,
      iconWell: "bg-emerald-50 text-[#0D9488] dark:bg-emerald-400/15 dark:text-emerald-300",
      activeNode: "border-teal-200 bg-gradient-to-br from-[#2DD4BF] to-[#0D9488] shadow-[0_8px_0_#08776F,0_14px_26px_rgba(13,148,136,0.28)] dark:border-teal-100/40",
      activeLabel: "text-[#0D9488] dark:text-teal-300",
    };
  }
  if (subject.includes("thinking") || subject.includes("logic")) {
    return {
      icon: BrainCircuit,
      iconWell: "bg-rose-50 text-[#D94F78] dark:bg-rose-400/15 dark:text-rose-300",
      activeNode: "border-rose-200 bg-gradient-to-br from-[#F08A5D] to-[#D94F78] shadow-[0_8px_0_#B63D67,0_14px_26px_rgba(217,79,120,0.27)] dark:border-rose-100/40",
      activeLabel: "text-[#D94F78] dark:text-rose-300",
    };
  }
  if (subject.includes("math")) {
    return {
      icon: Calculator,
      iconWell: "bg-[#EEE9FF] text-[#6844EA] dark:bg-violet-400/15 dark:text-[#CDBEFF]",
      activeNode: "border-violet-300 bg-gradient-to-br from-[#9A72F3] to-[#6844EA] shadow-[0_8px_0_#5432C5,0_14px_26px_rgba(104,68,234,0.3)] dark:border-violet-200/40",
      activeLabel: "text-[#6844EA] dark:text-[#CDBEFF]",
    };
  }
  return {
    icon: Flag,
    iconWell: "bg-blue-50 text-[#4774D9] dark:bg-blue-400/15 dark:text-blue-300",
    activeNode: "border-blue-200 bg-gradient-to-br from-[#69A0F4] to-[#4774D9] shadow-[0_8px_0_#365BB5,0_14px_26px_rgba(71,116,217,0.28)] dark:border-blue-100/40",
    activeLabel: "text-[#4774D9] dark:text-blue-300",
  };
};

const NODE_STYLE: Record<SkillPathStatus, NodeStyle> = {
  completed: {
    icon: Check,
    label: "Completed",
    node: "border-emerald-200 bg-white shadow-[0_7px_0_#D7E8E1,0_11px_18px_rgba(83,95,110,0.1)] dark:border-emerald-300/20 dark:bg-[#242A38] dark:shadow-[0_7px_0_#181D29]",
    iconClass: "text-emerald-500",
    labelClass: "text-emerald-600 dark:text-emerald-300",
  },
  overdue: {
    icon: RotateCcw,
    label: "Practice again",
    node: "border-rose-200 bg-rose-50 shadow-[0_7px_0_#F2D4DB,0_11px_18px_rgba(83,95,110,0.1)] dark:border-rose-300/20 dark:bg-rose-400/10 dark:shadow-[0_7px_0_#181D29]",
    iconClass: "text-rose-500",
    labelClass: "text-rose-600 dark:text-rose-300",
  },
  in_progress: {
    icon: Play,
    label: "Continue",
    node: "border-violet-300 bg-gradient-to-br from-[#9A72F3] to-[#6844EA] shadow-[0_8px_0_#5432C5,0_14px_26px_rgba(104,68,234,0.3)] dark:border-violet-200/40",
    iconClass: "fill-current text-white",
    labelClass: "text-[#6844EA] dark:text-[#CDBEFF]",
  },
  new: {
    icon: Star,
    label: "Ready",
    node: "border-[#DDE2EA] bg-[#F4F5F7] shadow-[0_7px_0_#CDD2DA,0_11px_18px_rgba(83,95,110,0.1)] dark:border-white/10 dark:bg-[#292D3F] dark:shadow-[0_7px_0_#1C2030]",
    iconClass: "fill-current text-[#A8AFBA] dark:text-[#747C91]",
    labelClass: "text-[#8E96A5] dark:text-[#7E869A]",
  },
  pending: {
    icon: Lock,
    label: "Locked",
    node: "border-[#DDE2EA] bg-[#EEF1F5] shadow-[0_8px_0_#CDD2DA] dark:border-white/10 dark:bg-[#292D3F] dark:shadow-[0_8px_0_#1C2030]",
    iconClass: "text-[#9AA3B2] dark:text-[#6F778E]",
    labelClass: "text-[#98A0AE] dark:text-[#777F96]",
  },
};

const COLUMN_PATTERN = [1, 0, 1, 2] as const;
const COLUMN_X = [50, 150, 250] as const;
const ROW_HEIGHT = 168;
const NODE_CENTER_Y = 61;

const journeyPath = (count: number): string => {
  if (count < 2) return "";
  const points = Array.from({ length: count }, (_, index) => ({
    x: COLUMN_X[COLUMN_PATTERN[index % COLUMN_PATTERN.length]],
    y: index * ROW_HEIGHT + NODE_CENTER_Y,
  }));
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const middle = (previous.y + point.y) / 2;
    return `${path} C ${previous.x} ${middle}, ${point.x} ${middle}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
};

const JourneyNode: React.FC<{
  skill: PathSkill;
  index: number;
  artUrl?: string;
  isNext: boolean;
  palette: SubjectPalette;
  onStart: (skillId: string) => void;
}> = ({ skill, index, artUrl, isNext, palette, onStart }) => {
  const highlighted = isNext && skill.status !== "completed" && skill.status !== "pending";
  const status: SkillPathStatus = highlighted ? "in_progress" : skill.status;
  const visual = NODE_STYLE[status];
  const actionLabel = skill.status === "overdue" && (skill.level === "beginner" || skill.level === "developing")
    ? "Keep practicing"
    : visual.label;
  const subjectActive = highlighted || status === "in_progress";
  const Icon = visual.icon;
  const canStart = skill.playable && skill.status !== "pending";
  const [artFailed, setArtFailed] = useState(false);
  const column = COLUMN_PATTERN[index % COLUMN_PATTERN.length];

  React.useEffect(() => setArtFailed(false), [artUrl]);

  return (
    <div
      className="relative z-10 flex h-[168px] min-w-0 flex-col items-center pt-5 text-center"
      style={{ gridColumn: column + 1, gridRow: index + 1 }}
    >
      {highlighted && (
        <span className="absolute top-0 rounded-xl border border-[#DDE1E8] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#646C7B] shadow-sm after:absolute after:-bottom-1 after:left-1/2 after:h-2 after:w-2 after:-translate-x-1/2 after:rotate-45 after:border-b after:border-r after:border-[#DDE1E8] after:bg-white dark:border-white/10 dark:bg-[#252939] dark:text-[#C4CAD7] dark:after:border-white/10 dark:after:bg-[#252939]">
          {skill.status === "in_progress" ? "Continue" : "Start"}
        </span>
      )}
      <button
        type="button"
        disabled={!canStart}
        onClick={() => canStart && onStart(skill.skillId)}
        aria-label={`${actionLabel}: ${skill.skillLabel}`}
        className={`relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full border-[5px] transition-transform sm:h-20 sm:w-20 ${subjectActive ? palette.activeNode : visual.node} ${
          canStart ? "cursor-pointer hover:-translate-y-1 active:translate-y-1 active:shadow-none" : "cursor-default"
        }`}
      >
        {status !== "pending" && artUrl && !artFailed ? (
          <span className="flex h-[3.1rem] w-[3.1rem] items-center justify-center rounded-full bg-white/95 p-1.5 shadow-inner sm:h-14 sm:w-14">
            <img src={artUrl} alt="" onError={() => setArtFailed(true)} className="h-full w-full object-contain" />
          </span>
        ) : (
          <Icon size={status === "pending" ? 24 : 29} strokeWidth={2.7} className={visual.iconClass} />
        )}
        {status === "completed" && artUrl && !artFailed && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white ring-[3px] ring-white dark:ring-[#15182A]">
            <Check size={14} strokeWidth={3.5} />
          </span>
        )}
      </button>
      <p className="mt-3 w-[7.4rem] break-words text-[11px] font-black leading-[1.25] text-[#27334A] sm:w-36 sm:text-xs dark:text-[#F2EEFF]">
        {skill.skillLabel}
      </p>
      <p className={`mt-0.5 text-[9px] font-extrabold ${subjectActive ? palette.activeLabel : visual.labelClass}`}>
        {skill.playable ? actionLabel : "Coming soon"}
      </p>
    </div>
  );
};

/** A unit-aware, connected skill journey for the kid home page. */
export const LearningPathSection: React.FC<Props> = ({
  units,
  subtitle,
  subjectId,
  subjectName,
  thumbnailBySkillId,
  nextSkillId,
  onStartSkill,
  onViewAll,
}) => {
  const totalSkills = units.reduce((sum, unit) => sum + unit.skills.length, 0);
  const palette = subjectPalette(subjectId, subjectName);
  const SubjectIcon = palette.icon;

  if (totalSkills === 0) return null;

  return (
    <section id="kid-paths" aria-label={subtitle} className="mt-7 scroll-mt-5">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${palette.iconWell}`}>
              <SubjectIcon size={18} />
            </span>
            <div>
              <h2 className="text-base font-black text-[#27334A] sm:text-lg dark:text-white">Your {subjectName} journey</h2>
              <p className="text-[10px] font-bold text-[#8792A5] sm:text-[11px] dark:text-[#8F99AD]">{subtitle}</p>
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="xs" onClick={onViewAll} className="rounded-full px-3 font-extrabold text-[#6844EA] dark:text-[#CDBEFF]">
          Explore skills <ArrowRight size={13} />
        </Button>
      </header>

      <div className="mt-4 space-y-6">
        {units.map(unit => {
          const unitIndex = units.findIndex(candidate => candidate.id === unit.id);
          const svgHeight = Math.max(1, unit.skills.length) * ROW_HEIGHT;

          return (
            <article key={unit.id} className="relative pt-2">
              <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
                <span className="h-px min-w-5 flex-1 bg-[#E1E4EA] dark:bg-white/10" />
                <h3 className="max-w-[75%] whitespace-normal break-words text-center text-[10px] font-extrabold leading-relaxed text-[#929BAA] sm:max-w-[80%] sm:text-xs dark:text-[#7F899C]">
                  Unit {unitIndex + 1} · {unit.title}
                </h3>
                <span className="h-px min-w-5 flex-1 bg-[#E1E4EA] dark:bg-white/10" />
              </div>

              <div className="relative mx-auto w-full max-w-[22.5rem] overflow-hidden px-3 pb-2 pt-5 sm:px-0">
                {unit.skills.length > 1 && (
                  <svg
                    aria-hidden="true"
                    viewBox={`0 0 300 ${svgHeight}`}
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-x-0 top-4 h-auto w-full"
                    style={{ height: svgHeight }}
                  >
                    <path d={journeyPath(unit.skills.length)} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className="text-[#E3E6EC] dark:text-[#2A3044]" />
                    <path d={journeyPath(unit.skills.length)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 13" className="text-white dark:text-[#596078]" />
                  </svg>
                )}
                <div className="relative grid grid-cols-3" style={{ minHeight: svgHeight }}>
                  {unit.skills.map((skill, index) => (
                    <JourneyNode
                      key={skill.skillId}
                      skill={skill}
                      index={index}
                      artUrl={thumbnailBySkillId.get(skill.skillId)}
                      isNext={skill.skillId === nextSkillId}
                      palette={palette}
                      onStart={onStartSkill}
                    />
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
