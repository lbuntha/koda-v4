import React from "react";
import { BookOpen, Check } from "lucide-react";
import type { SubjectCatalogItem } from "../../api/academic";
import { OnboardingStep } from "./OnboardingStep";

interface Props {
  subjects: SubjectCatalogItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const GoalsStep: React.FC<Props> = ({ subjects, selected, onChange }) => {
  const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter(item => item !== key) : [...selected, key]);
  return (
    <OnboardingStep eyebrow="Learning goals" title="What would you like to focus on?" description="Choose one or more subjects. The first selection becomes the primary focus.">
      {subjects.length > 0 ? (
        <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-2">
          {subjects.map(subject => {
            const active = selected.includes(subject.key);
            return (
              <button key={subject.key} type="button" onClick={() => toggle(subject.key)} className={`flex items-center gap-3 rounded-2xl p-4 text-left transition-all ${active ? "bg-[#EEE9FF] ring-2 ring-[#7252D8] dark:bg-violet-400/15 dark:ring-[#BDA9FF]" : "bg-slate-50 hover:bg-[#F6F3FF] dark:bg-white/5 dark:hover:bg-white/10"}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: subject.color || "#7252D8" }}><BookOpen size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#334057] dark:text-white">{subject.name}</span>{subject.description && <span className="mt-0.5 line-clamp-2 block text-[11px] font-semibold text-[#8A95A8] dark:text-[#8F99AD]">{subject.description}</span>}</span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${active ? "bg-[#7252D8] text-white" : "bg-white text-transparent dark:bg-white/10"}`}><Check size={13} strokeWidth={3} /></span>
              </button>
            );
          })}
        </div>
      ) : <p className="mx-auto max-w-md rounded-2xl bg-amber-50 p-4 text-center text-xs font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">No subjects are available for this grade yet. Add one in Admin Settings.</p>}
    </OnboardingStep>
  );
};

