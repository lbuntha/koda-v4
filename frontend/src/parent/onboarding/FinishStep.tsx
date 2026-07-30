import React from "react";
import { BookOpen, Compass, Sparkles } from "lucide-react";
import type { GradeCatalogItem, SubjectCatalogItem } from "../../api/academic";
import { KidAvatar } from "../../components/KidAvatar";
import { OnboardingStep } from "./OnboardingStep";
import type { KidOnboardingDraft } from "./types";

interface Props { draft: KidOnboardingDraft; grades: GradeCatalogItem[]; subjects: SubjectCatalogItem[]; }

export const FinishStep: React.FC<Props> = ({ draft, grades, subjects }) => {
  const grade = grades.find(item => item.key === draft.gradeLevel)?.name ?? draft.gradeLevel;
  const goals = draft.learningGoals.map(key => subjects.find(item => item.key === key)?.name ?? key).join(" · ");
  return (
    <OnboardingStep eyebrow="Ready to learn" title={`${draft.name || "Your child"} is ready!`} description="Review the learning setup, then create the profile.">
      <div className="mx-auto max-w-lg rounded-3xl bg-gradient-to-br from-[#F5F2FF] to-[#EDE8FF] p-5 dark:from-white/10 dark:to-white/5">
        <div className="flex items-center gap-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-[#191338]"><KidAvatar avatar={draft.avatar} className="h-17 w-17 text-5xl" /></span>
          <div className="min-w-0"><h3 className="truncate text-xl font-black text-[#27334A] dark:text-white">{draft.name}</h3><p className="mt-1 text-xs font-bold text-[#7252D8] dark:text-[#CDBEFF]">{draft.levelChoice === "age" ? `Age ${draft.age}` : grade}</p></div>
          <Sparkles className="ml-auto text-amber-400" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl bg-white/75 p-3 dark:bg-white/5"><BookOpen size={17} className="mt-0.5 shrink-0 text-[#7252D8]" /><div><p className="text-[10px] font-black uppercase tracking-wide text-[#8A95A8]">Learning goals</p><p className="mt-1 text-xs font-bold text-[#334057] dark:text-white">{goals || "Grade foundations"}</p></div></div>
          <div className="flex items-start gap-3 rounded-2xl bg-white/75 p-3 dark:bg-white/5"><Compass size={17} className="mt-0.5 shrink-0 text-[#7252D8]" /><div><p className="text-[10px] font-black uppercase tracking-wide text-[#8A95A8]">Starting point</p><p className="mt-1 text-xs font-bold text-[#334057] dark:text-white">{draft.placementChoice === "check" ? "Placement check" : "Grade foundations"}</p></div></div>
        </div>
      </div>
    </OnboardingStep>
  );
};
