import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { ChildInput } from "../../api/family";
import { useAcademicCatalog } from "../../components/academic";
import { Button, Dialog, Spinner } from "../../components/ui";
import { AVATARS } from "../AvatarPicker";
import { AvatarStep } from "./AvatarStep";
import { FinishStep } from "./FinishStep";
import { GoalsStep } from "./GoalsStep";
import { GradeStep } from "./GradeStep";
import { LearnerStep } from "./LearnerStep";
import { NameStep } from "./NameStep";
import { OnboardingProgress } from "./OnboardingProgress";
import { PlacementStep } from "./PlacementStep";
import type { KidOnboardingDraft } from "./types";
import { ONBOARDING_STEPS } from "./types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ChildInput) => Promise<void>;
}

const initialDraft = (gradeLevel: string, primarySubject: string): KidOnboardingDraft => ({
  profileGender: null,
  name: "",
  gradeLevel,
  levelChoice: "age",
  age: 8,
  learningGoals: primarySubject ? [primarySubject] : [],
  placementChoice: "check",
  avatar: AVATARS[0],
  pin: "",
});

const persistableAvatar = async (avatar: string) => {
  if (!avatar.startsWith("http://") && !avatar.startsWith("https://")) return avatar;
  try {
    const response = await fetch(avatar);
    if (!response.ok) return avatar;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await response.text())}`;
  } catch {
    return avatar;
  }
};

export const KidOnboardingWizard: React.FC<Props> = ({ isOpen, onClose, onSubmit }) => {
  const { grades, subjects, loading: catalogLoading } = useAcademicCatalog();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<KidOnboardingDraft>(() => initialDraft("grade_1", "math"));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [catalogSeeded, setCatalogSeeded] = useState(false);

  const subjectsForGrade = useMemo(
    () => subjects.filter(subject => !subject.grade_id || subject.grade_id === draft.gradeLevel || subject.grade_id === "all"),
    [draft.gradeLevel, subjects],
  );

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setDraft(initialDraft("grade_1", "math"));
    setError(null);
    setCatalogSeeded(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || catalogLoading || catalogSeeded) return;
    setDraft(current => {
      const orderedGrades = [...grades].sort((a, b) => a.order - b.order);
      const ageGrade = orderedGrades[Math.min(Math.max(current.age - 5, 0), Math.max(orderedGrades.length - 1, 0))]?.key;
      const grade = current.levelChoice === "age" && ageGrade
        ? ageGrade
        : grades.some(item => item.key === current.gradeLevel) ? current.gradeLevel : grades[0]?.key ?? current.gradeLevel;
      const matchingSubjects = subjects.filter(subject => !subject.grade_id || subject.grade_id === grade || subject.grade_id === "all");
      const retainedGoals = current.learningGoals.filter(key => matchingSubjects.some(subject => subject.key === key && subject.content_ready));
      const firstReady = matchingSubjects.find(subject => subject.content_ready);
      return {
        ...current,
        gradeLevel: grade,
        learningGoals: retainedGoals.length ? retainedGoals : firstReady ? [firstReady.key] : [],
      };
    });
    setCatalogSeeded(true);
  }, [catalogLoading, catalogSeeded, grades, isOpen, subjects]);

  const patch = (next: Partial<KidOnboardingDraft>) => setDraft(current => ({ ...current, ...next }));
  const changeGrade = (gradeLevel: string) => {
    setDraft(current => {
      const matching = subjects.filter(subject => !subject.grade_id || subject.grade_id === gradeLevel || subject.grade_id === "all");
      const retained = current.learningGoals.filter(key => matching.some(subject => subject.key === key && subject.content_ready));
      const firstReady = matching.find(subject => subject.content_ready);
      return { ...current, gradeLevel, learningGoals: retained.length ? retained : firstReady ? [firstReady.key] : [] };
    });
  };
  const changeAge = (age: number) => {
    const orderedGrades = [...grades].sort((a, b) => a.order - b.order);
    const inferredGrade = orderedGrades[Math.min(Math.max(age - 5, 0), Math.max(orderedGrades.length - 1, 0))]?.key ?? draft.gradeLevel;
    setDraft(current => {
      const matching = subjects.filter(subject => !subject.grade_id || subject.grade_id === inferredGrade || subject.grade_id === "all");
      const retained = current.learningGoals.filter(key => matching.some(subject => subject.key === key && subject.content_ready));
      const firstReady = matching.find(subject => subject.content_ready);
      return { ...current, age, levelChoice: "age", gradeLevel: inferredGrade, learningGoals: retained.length ? retained : firstReady ? [firstReady.key] : [] };
    });
  };
  const changeLevelChoice = (levelChoice: KidOnboardingDraft["levelChoice"]) => {
    if (levelChoice === "age") changeAge(draft.age);
    else patch({ levelChoice });
  };

  const validate = () => {
    if (step === 1 && !draft.name.trim()) return "Enter your child’s name to continue.";
    if (step === 1 && draft.pin && !/^\d{4,8}$/.test(draft.pin)) return "PIN must contain 4–8 digits.";
    if (step === 2 && !draft.gradeLevel) return "Choose a grade to continue.";
    if (step === 3 && draft.learningGoals.length === 0) return "Choose at least one subject with published content.";
    if (step === 5 && !draft.avatar) return "Choose an avatar to continue.";
    return null;
  };

  const next = () => {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    setStep(current => Math.min(ONBOARDING_STEPS.length - 1, current + 1));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: draft.name.trim(),
        avatar: await persistableAvatar(draft.avatar),
        grade_level: draft.gradeLevel,
        primary_subject: draft.learningGoals[0] ?? subjectsForGrade[0]?.key ?? "math",
        profile_gender: draft.profileGender,
        learning_goals: draft.learningGoals,
        placement_required: draft.placementChoice === "check",
        ...(draft.levelChoice === "age" ? { birth_year: new Date().getFullYear() - draft.age } : {}),
        ...(draft.pin ? { pin: draft.pin } : {}),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the child profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-4xl">
      <div className="flex min-h-[32rem] flex-col">
        <div className="pr-8">
          <p className="text-sm font-black text-[#27334A] dark:text-white">Add child</p>
          <p className="mt-0.5 text-xs font-semibold text-[#8792A5] dark:text-[#9AA3B5]">A simple setup for a personalized learning path.</p>
        </div>
        <div className="mt-4"><OnboardingProgress currentStep={step} onStepSelect={nextStep => { setError(null); setStep(nextStep); }} /></div>

        {step === 0 && <LearnerStep value={draft.profileGender} onChange={profileGender => patch({ profileGender })} />}
        {step === 1 && <NameStep name={draft.name} pin={draft.pin} onNameChange={name => patch({ name })} onPinChange={pin => patch({ pin })} />}
        {step === 2 && <GradeStep value={draft.gradeLevel} levelChoice={draft.levelChoice} age={draft.age} onLevelChoiceChange={changeLevelChoice} onAgeChange={changeAge} onChange={changeGrade} />}
        {step === 3 && <GoalsStep subjects={subjectsForGrade} selected={draft.learningGoals} onChange={learningGoals => patch({ learningGoals })} />}
        {step === 4 && <PlacementStep value={draft.placementChoice} onChange={placementChoice => patch({ placementChoice })} />}
        {step === 5 && <AvatarStep value={draft.avatar} onChange={avatar => patch({ avatar })} />}
        {step === 6 && <FinishStep draft={draft} grades={grades} subjects={subjects} />}

        {error && <div className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{error}</div>}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
          {step > 0 ? <Button type="button" variant="ghost" onClick={() => { setError(null); setStep(current => current - 1); }}><ArrowLeft size={15} /> Back</Button> : <Button type="button" variant="ghost" onClick={next}>Skip</Button>}
          <span className="text-[10px] font-bold text-slate-400">Step {step + 1} of {ONBOARDING_STEPS.length}</span>
          {step < ONBOARDING_STEPS.length - 1 ? (
            <Button type="button" onClick={next} disabled={catalogLoading && step >= 2 && step <= 3} className="bg-[#7252D8] hover:bg-[#6546CC]">Continue <ArrowRight size={15} /></Button>
          ) : (
            <Button type="button" onClick={() => void save()} disabled={saving} className="bg-[#7252D8] hover:bg-[#6546CC]">{saving ? <Spinner size="sm" label="Creating profile" /> : <><Check size={15} /> Create profile</>}</Button>
          )}
        </div>
      </div>
    </Dialog>
  );
};
