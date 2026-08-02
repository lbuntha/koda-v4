import React from "react";
import { LearnerPortrait } from "../../components/LearnerPortrait";
import { OnboardingStep } from "./OnboardingStep";
import type { LearnerGender } from "./types";

interface Props { value: LearnerGender; onChange: (value: LearnerGender) => void; }

export const LearnerStep: React.FC<Props> = ({ value, onChange }) => (
  <OnboardingStep eyebrow="Welcome" title="Who is learning?" description="This optional choice only personalizes the child profile. You can skip it.">
    <div className="mx-auto grid max-w-md grid-cols-2 gap-4">
      {(["boy", "girl"] as const).map(option => (
        <button key={option} type="button" onClick={() => onChange(option)} aria-pressed={value === option} className={`rounded-3xl p-5 text-center transition-all ${value === option ? "bg-[#EEE9FF] ring-2 ring-[#7252D8] dark:bg-violet-400/15 dark:ring-[#BDA9FF]" : "bg-slate-50 hover:bg-[#F6F3FF] dark:bg-white/5 dark:hover:bg-white/10"}`}>
          <span className={`mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full ring-4 ring-white shadow-sm dark:ring-white/10 ${option === "boy" ? "bg-blue-100 dark:bg-blue-400/15" : "bg-rose-100 dark:bg-rose-400/15"}`}>
            <LearnerPortrait variant={option} />
          </span>
          <span className="mt-3 block text-sm font-black capitalize text-[#334057] dark:text-white">{option}</span>
        </button>
      ))}
    </div>
  </OnboardingStep>
);
