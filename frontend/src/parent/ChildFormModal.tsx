import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Input, FormModal, FormField, Select } from "../components/ui";
import { AvatarPicker, AVATARS } from "../components/AvatarPicker";
import { KidAvatar } from "../components/KidAvatar";
import { Child, ChildInput } from "../api/family";
import { GradeSelect, useAcademicCatalog } from "../components/academic";
import { KidOnboardingWizard } from "./onboarding/KidOnboardingWizard";
import { SubjectChoiceGrid } from "./SubjectChoiceGrid";
import { inlineRemoteAvatar } from "../lib/avatar";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ChildInput) => Promise<void>;
  initial?: Child | null;
  firstRun?: boolean;
}

export const ChildFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, initial, firstRun = false }) => {
  const editing = !!initial;
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [gradeLevel, setGradeLevel] = useState("grade_1");
  const [primarySubject, setPrimarySubject] = useState("math");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [pin, setPin] = useState("");

  const { grades, subjects, loading: catalogLoading } = useAcademicCatalog();

  useEffect(() => {
    if (!isOpen) return;
    setName(initial?.name ?? "");
    setAvatar(initial?.avatar ?? AVATARS[0]);
    const nextGrade = initial?.grade_level ?? grades[0]?.key ?? "grade_1";
    const subjectsForGrade = subjects.filter(subject => !subject.grade_id || subject.grade_id === nextGrade || subject.grade_id === "all");
    const existingSubjects = (initial?.learning_goals?.length ? initial.learning_goals : [initial?.primary_subject]).filter((key): key is string => Boolean(key) && subjectsForGrade.some(subject => subject.key === key));
    const fallbackSubject = subjectsForGrade.find(subject => subject.content_ready)?.key ?? "";
    const nextSubjects = existingSubjects.length ? existingSubjects : fallbackSubject ? [fallbackSubject] : [];
    setGradeLevel(nextGrade);
    setSelectedSubjects(nextSubjects);
    setPrimarySubject(nextSubjects.includes(initial?.primary_subject ?? "") ? initial?.primary_subject ?? nextSubjects[0] : nextSubjects[0] ?? "");
    setPin("");
  }, [isOpen, initial, grades, subjects]);

  const changeGrade = (nextGrade: string) => {
    setGradeLevel(nextGrade);
    const matchingSubjects = subjects.filter(subject => !subject.grade_id || subject.grade_id === nextGrade || subject.grade_id === "all");
    const retained = selectedSubjects.filter(key => matchingSubjects.some(subject => subject.key === key && subject.content_ready));
    const next = retained.length ? retained : matchingSubjects.find(subject => subject.content_ready) ? [matchingSubjects.find(subject => subject.content_ready)!.key] : [];
    setSelectedSubjects(next);
    setPrimarySubject(next.includes(primarySubject) ? primarySubject : next[0] ?? "");
  };

  const changeSubjects = (next: string[]) => {
    setSelectedSubjects(next);
    if (!next.includes(primarySubject)) setPrimarySubject(next[0] ?? "");
  };

  const submit = async () => {
    if (pin && !/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits.");
    if (!selectedSubjects.length) throw new Error("Choose at least one subject with published content.");
    const unavailable = selectedSubjects.filter(key => !subjects.find(subject => subject.key === key)?.content_ready);
    if (unavailable.length) throw new Error("Remove subjects marked as unavailable before saving.");

    const finalAvatar = await inlineRemoteAvatar(avatar);

    const orderedSubjects = [primarySubject, ...selectedSubjects.filter(key => key !== primarySubject)];
    const data: ChildInput = {
      name: name.trim(),
      avatar: finalAvatar,
      grade_level: gradeLevel,
      primary_subject: primarySubject,
      learning_goals: orderedSubjects,
    };
    if (pin.trim()) data.pin = pin.trim();
    await onSubmit(data);
  };

  const selectedGrade = grades.find((g) => g.key === gradeLevel);
  const selectedGradeLabel = selectedGrade ? selectedGrade.name : gradeLevel;
  const selectedSubject = subjects.find((s) => s.key === primarySubject);
  const selectedSubjectLabel = selectedSubject ? selectedSubject.name : primarySubject;

  if (!editing) {
    return <KidOnboardingWizard isOpen={isOpen} onClose={onClose} onSubmit={onSubmit} firstRun={firstRun} />;
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit Student Profile" : "Add Student"}
      description={editing ? "Update avatar, grade, and profile details." : "Create a new kid profile with personalized grade placement recommendations."}
      submitLabel={editing ? "Save Profile" : "Add Student"}
      onSubmit={submit}
      maxWidthClassName="max-w-md sm:max-w-2xl"
    >
      {/* Live Profile Header Preview */}
      <div className="mb-4 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F5F2FF] to-[#EBE4FF] p-3.5 text-center dark:from-white/10 dark:to-white/5 border border-indigo-100/70 dark:border-white/10">
        <div className="relative flex h-18 w-18 items-center justify-center rounded-full bg-white shadow-lg shadow-indigo-500/20 ring-4 ring-[#5C46DF]/20 dark:bg-[#191338]">
          <KidAvatar avatar={avatar} className="h-12 w-12" />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#5C46DF] text-white shadow dark:bg-[#BEACFF] dark:text-[#191338]">
            <Sparkles size={11} />
          </span>
        </div>
        <h4 className="mt-2 text-sm font-black text-[#1E1538] dark:text-[#F2EEFF]">
          {name.trim() || (editing ? "Student Profile" : "New Student")}
        </h4>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-extrabold text-[#5C46DF] dark:text-[#BEACFF]">
          <span>{selectedGradeLabel}</span>
          <span>•</span>
          <span className="capitalize">{selectedSubjectLabel}</span>
        </div>
      </div>

      <FormField label="Child's Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ada, Thana, Jutta"
          required
          autoFocus
          className="h-11 rounded-xl text-sm font-extrabold"
        />
      </FormField>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label="Grade Model"
          hint="Loaded from Curriculum models catalog."
        >
          <GradeSelect
            value={gradeLevel}
            onChange={(e) => changeGrade(e.target.value)}
            className="h-11 rounded-xl text-sm font-bold"
          />
        </FormField>

        <FormField label="Primary subject" hint="This subject opens first when learning begins.">
          <Select
            value={primarySubject}
            onChange={(e) => setPrimarySubject(e.target.value)}
            disabled={catalogLoading || selectedSubjects.length === 0}
            required
            className="h-11 rounded-xl text-sm font-bold"
          >
            {selectedSubjects.map(key => <option key={key} value={key}>{subjects.find(subject => subject.key === key)?.name ?? key}</option>)}
          </Select>
        </FormField>
      </div>

      <FormField label="Learning subjects" hint="Select every subject this child can access. Subjects without published content stay unavailable.">
        <SubjectChoiceGrid
          subjects={subjects.filter(subject => !subject.grade_id || subject.grade_id === gradeLevel || subject.grade_id === "all")}
          selected={[primarySubject, ...selectedSubjects.filter(key => key !== primarySubject)].filter(Boolean)}
          onChange={changeSubjects}
          compact
        />
      </FormField>

      <FormField label="Select Avatar">
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </FormField>

      <FormField
        label={editing ? "New PIN (optional)" : "PIN (optional)"}
        hint="A 4–8 digit PIN allows your child to sign in independently."
      >
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder={editing ? "Leave blank to keep current PIN" : "4–8 digits"}
          maxLength={8}
          className="h-11 rounded-xl font-mono text-sm"
        />
      </FormField>
    </FormModal>
  );
};
