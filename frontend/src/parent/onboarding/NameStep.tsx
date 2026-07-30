import React from "react";
import { Input, FormField } from "../../components/ui";
import { OnboardingStep } from "./OnboardingStep";

interface Props { name: string; pin: string; onNameChange: (value: string) => void; onPinChange: (value: string) => void; }

export const NameStep: React.FC<Props> = ({ name, pin, onNameChange, onPinChange }) => (
  <OnboardingStep eyebrow="Profile" title="What is your child’s name?" description="This is the name they’ll see throughout their learning space.">
    <div className="mx-auto max-w-md space-y-4">
      <FormField label="Child’s name"><Input autoFocus required value={name} onChange={event => onNameChange(event.target.value)} placeholder="e.g. Jutta" className="h-12 rounded-xl text-base font-bold" /></FormField>
      <FormField label="Independent login PIN (optional)" hint="Use 4–8 digits, or leave blank to add one later."><Input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={event => onPinChange(event.target.value.replace(/\D/g, ""))} placeholder="4–8 digits" className="h-12 rounded-xl font-mono text-base" /></FormField>
    </div>
  </OnboardingStep>
);

