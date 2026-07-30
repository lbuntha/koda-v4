import React from "react";
import { Check } from "lucide-react";
import { ONBOARDING_STEPS } from "./types";

interface Props {
  currentStep: number;
  onStepSelect: (step: number) => void;
}

export const OnboardingProgress: React.FC<Props> = ({ currentStep, onStepSelect }) => (
  <nav aria-label="Add child progress" className="overflow-x-auto pb-1">
    <ol className="flex min-w-max items-center gap-1 sm:min-w-0 sm:justify-between">
      {ONBOARDING_STEPS.map((step, index) => {
        const complete = index < currentStep;
        const active = index === currentStep;
        return (
          <React.Fragment key={step.id}>
            <li>
              <button
                type="button"
                onClick={() => index < currentStep && onStepSelect(index)}
                disabled={index > currentStep}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-extrabold transition-colors ${active ? "bg-[#EEE9FF] text-[#6844EA] dark:bg-violet-400/15 dark:text-[#CDBEFF]" : complete ? "cursor-pointer text-emerald-600 dark:text-emerald-300" : "text-slate-400 dark:text-slate-600"}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-[#7252D8] text-white" : complete ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300" : "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-600"}`}>
                  {complete ? <Check size={14} strokeWidth={3} /> : index + 1}
                </span>
                <span className="hidden lg:inline">{step.label}</span>
              </button>
            </li>
            {index < ONBOARDING_STEPS.length - 1 && <span aria-hidden className={`h-px w-3 sm:flex-1 ${index < currentStep ? "bg-emerald-300 dark:bg-emerald-400/30" : "bg-slate-200 dark:bg-white/10"}`} />}
          </React.Fragment>
        );
      })}
    </ol>
  </nav>
);

