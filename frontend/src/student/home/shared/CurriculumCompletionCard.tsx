import React from "react";
import { Check, Trophy } from "lucide-react";
import { CelebrationEffects } from "./CelebrationEffects";

interface Props {
  subjectName: string;
  gradeName?: string | null;
  skillsMastered: number;
}

export const CurriculumCompletionCard: React.FC<Props> = ({ subjectName, gradeName, skillsMastered }) => (
  <section className="relative mt-4 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#6C4CE3] via-[#7556E8] to-[#4B86F7] px-5 py-7 text-white shadow-[0_18px_45px_rgba(92,70,205,0.24)] sm:px-8 sm:py-9">
    <CelebrationEffects tone="trophy" className="pointer-events-none absolute left-1/2 top-1/2 opacity-70" />
    <div className="relative z-10 flex flex-col items-center text-center sm:flex-row sm:text-left">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-white/20 shadow-inner ring-1 ring-white/30 sm:h-20 sm:w-20">
        <Trophy size={36} className="text-[#FFE36E] drop-shadow" />
      </span>
      <div className="mt-4 min-w-0 sm:ml-5 sm:mt-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Curriculum complete</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">You mastered {gradeName ? `${gradeName} ` : ""}{subjectName}!</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-white/85">
          Amazing work—{skillsMastered} skill{skillsMastered === 1 ? "" : "s"} mastered. Your grown-up can choose your next learning adventure.
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25">
          <Check size={13} /> Review activities stay available
        </span>
      </div>
    </div>
  </section>
);
