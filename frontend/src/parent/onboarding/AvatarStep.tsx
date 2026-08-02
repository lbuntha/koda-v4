import React from "react";
import { AvatarPicker } from "../../components/AvatarPicker";
import { OnboardingStep } from "./OnboardingStep";

interface Props { value: string; onChange: (value: string) => void; }

export const AvatarStep: React.FC<Props> = ({ value, onChange }) => (
  <OnboardingStep eyebrow="Profile picture" title="Choose an avatar" description="Pick a friendly character your child will recognize on their learning page.">
    <AvatarPicker value={value} onChange={onChange} className="mx-auto max-w-2xl" />
  </OnboardingStep>
);

