import React from "react";
import type { SubjectCatalogItem } from "../../api/academic";
import { SubjectChoiceGrid } from "../SubjectChoiceGrid";
import { OnboardingStep } from "./OnboardingStep";

interface Props {
  subjects: SubjectCatalogItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const GoalsStep: React.FC<Props> = ({ subjects, selected, onChange }) => {
  return (
    <OnboardingStep eyebrow="Learning goals" title="What would you like to focus on?" description="Choose one or more subjects. The first selection becomes the primary focus.">
      <SubjectChoiceGrid subjects={subjects} selected={selected} onChange={onChange} />
    </OnboardingStep>
  );
};
