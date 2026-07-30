import React from "react";
import { GradeSelect } from "../../components/academic";
import { FormField, Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui";
import { OnboardingStep } from "./OnboardingStep";
import type { LevelChoice } from "./types";

interface Props {
  value: string;
  levelChoice: LevelChoice;
  age: number;
  onChange: (value: string) => void;
  onLevelChoiceChange: (value: LevelChoice) => void;
  onAgeChange: (value: number) => void;
}

const AGES = [5, 6, 7, 8, 9, 10, 11, 12];

export const GradeStep: React.FC<Props> = ({ value, levelChoice, age, onChange, onLevelChoiceChange, onAgeChange }) => (
  <OnboardingStep eyebrow="Learning level" title="Choose an age or grade" description="This helps Koda begin at a comfortable curriculum level. You can update it later.">
    <Tabs value={levelChoice} onValueChange={next => onLevelChoiceChange(next as LevelChoice)} variant="learner" className="mx-auto max-w-md">
      <TabsList aria-label="Choose age or grade"><TabsTrigger value="age">Age</TabsTrigger><TabsTrigger value="grade">Grade</TabsTrigger></TabsList>
      <TabsContent value="age" className="mt-5">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {AGES.map(option => <button key={option} type="button" onClick={() => onAgeChange(option)} className={`h-12 rounded-xl text-sm font-black transition-all ${age === option ? "bg-[#7252D8] text-white shadow-sm shadow-violet-900/15" : "bg-slate-50 text-[#5F6B80] hover:bg-[#EEE9FF] hover:text-[#6844EA] dark:bg-white/5 dark:text-[#A8B0C1] dark:hover:bg-white/10"}`}>{option}</button>)}
        </div>
      </TabsContent>
      <TabsContent value="grade" className="mt-5"><FormField label="Grade model"><GradeSelect value={value} onChange={event => onChange(event.target.value)} className="h-12 rounded-xl text-sm font-bold" /></FormField></TabsContent>
    </Tabs>
  </OnboardingStep>
);
