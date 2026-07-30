import React from "react";
import { Award } from "lucide-react";
import type { MasteryLevel, PathSkill } from "../../../api/course";
import { LearningPathSkillCard } from "./LearningPathSkillCard";

interface Props {
  title: string;
  skills: PathSkill[];
  rungs: MasteryLevel[];
  progress: number;
  mastered: number;
  total: number;
  duePractice?: number;
  milestone?: string;
  nextSkillId?: string | null;
  onStart?: (skillId: string) => void;
}

/** One curriculum unit rendered as a connected horizontal row of reusable skill cards. */
export const UnitPathCard: React.FC<Props> = ({
  title,
  skills,
  progress,
  mastered,
  total,
  duePractice = 0,
  milestone,
  nextSkillId,
  onStart,
}) => {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <article className="overflow-hidden rounded-[1.5rem] bg-white px-4 pb-5 pt-4 shadow-[0_14px_38px_-32px_rgba(35,55,90,0.65)] sm:px-5 dark:bg-[#131D30] dark:shadow-none">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-[#253047] sm:text-base dark:text-[#F2EEFF]">{title}</h3>
          <p className="mt-0.5 text-[10px] font-bold text-[#8A95A8] dark:text-[#8F99AD]">
            {mastered} of {total} completed · {pct}% progress
          </p>
        </div>
        {duePractice > 0 && (
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
            {duePractice} to practise
          </span>
        )}
      </header>

      <div className="relative mt-9">
        {skills.length > 1 && (
          <span aria-hidden className="absolute left-20 right-20 top-0 border-t-2 border-dashed border-[#D9DFEA] dark:border-white/10" />
        )}
        <ol className="relative flex snap-x gap-5 overflow-x-auto px-1 pb-2 pt-7 [scrollbar-width:thin] sm:gap-6">
          {skills.map(skill => (
            <li key={skill.skillId} className="snap-start">
              <LearningPathSkillCard
                skill={skill}
                isNext={skill.skillId === nextSkillId}
                onStart={onStart}
              />
            </li>
          ))}
        </ol>
      </div>

      {milestone && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-300">
          <Award size={13} /> <span className="truncate">{milestone}</span>
        </p>
      )}
    </article>
  );
};
