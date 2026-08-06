import React from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "../../../components/ui";

interface Props {
  subjectName: string;
  unitNumber: number;
  title: string;
  completed: number;
  total: number;
  onViewSkills: () => void;
  className?: string;
  buttonClassName?: string;
}

/** Reusable floating context banner for a learner moving through one curriculum unit. */
export const LearningUnitBanner: React.FC<Props> = ({
  subjectName,
  unitNumber,
  title,
  completed,
  total,
  onViewSkills,
  className = "",
  buttonClassName = "",
}) => (
  <aside
    aria-label={`${subjectName}, unit ${unitNumber}: ${title}`}
    className={`flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-white shadow-[0_16px_38px_-20px_rgba(26,29,45,0.55)] ring-1 ring-white/20 sm:px-5 sm:py-3.5 ${className}`}
  >
    <div className="min-w-0">
      <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-white/75">
        {subjectName} · Unit {unitNumber} · {completed}/{total} skills
      </p>
      <p className="mt-1 truncate text-xs font-black sm:text-sm">{title}</p>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onViewSkills}
      className={`shrink-0 rounded-xl border border-black/10 bg-black/10 px-3 text-[10px] font-black uppercase tracking-wide text-white hover:bg-black/15 hover:text-white ${buttonClassName}`}
    >
      <BookOpen size={15} />
      <span className="hidden xs:inline">View skills</span>
      <ArrowRight size={13} />
    </Button>
  </aside>
);
