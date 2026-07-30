import React from "react";
import { Compass, Flag } from "lucide-react";
import { OnboardingStep } from "./OnboardingStep";
import type { PlacementChoice } from "./types";

interface Props { value: PlacementChoice; onChange: (value: PlacementChoice) => void; }

export const PlacementStep: React.FC<Props> = ({ value, onChange }) => (
  <OnboardingStep eyebrow="Starting point" title="Where should learning begin?" description="A short placement check can find a comfortable starting point, or your child can begin with the grade foundations.">
    <div className="mx-auto grid max-w-xl gap-4 sm:grid-cols-2">
      {[
        { value: "beginning" as const, title: "Start from the beginning", detail: "Begin with foundational skills", icon: Flag, tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300" },
        { value: "check" as const, title: "Take a placement check", detail: "A short adaptive warm-up", icon: Compass, tone: "bg-blue-100 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300" },
      ].map(option => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)} className={`rounded-3xl p-5 text-left transition-all ${value === option.value ? "bg-[#EEE9FF] ring-2 ring-[#7252D8] dark:bg-violet-400/15 dark:ring-[#BDA9FF]" : "bg-slate-50 hover:bg-[#F6F3FF] dark:bg-white/5 dark:hover:bg-white/10"}`}>
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${option.tone}`}><option.icon size={22} /></span>
          <span className="mt-4 block text-sm font-black text-[#334057] dark:text-white">{option.title}</span>
          <span className="mt-1 block text-xs font-semibold text-[#8A95A8] dark:text-[#8F99AD]">{option.detail}</span>
        </button>
      ))}
    </div>
  </OnboardingStep>
);

