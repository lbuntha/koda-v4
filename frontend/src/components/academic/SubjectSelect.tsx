import React from "react";
import { Select } from "../ui/Select";
import { useAcademicCatalog } from "./useAcademicCatalog";

export interface SubjectSelectProps extends Omit<React.ComponentPropsWithoutRef<typeof Select>, "children"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  gradeId?: string;
  fallbackOptions?: { value: string; label: string }[];
}

const DEFAULT_SUBJECT_FALLBACKS = [
  { value: "math", label: "Mathematics & Numeracy" },
  { value: "logic", label: "Logic & Pattern Reasoning" },
  { value: "all", label: "Full STEM Curriculum" },
];

export const SubjectSelect: React.FC<SubjectSelectProps> = ({
  value,
  onChange,
  gradeId,
  fallbackOptions = DEFAULT_SUBJECT_FALLBACKS,
  className,
  disabled,
  ...props
}) => {
  const { subjects, loading, error } = useAcademicCatalog();

  const matchingSubjects = gradeId
    ? subjects.filter((s) => !s.grade_id || s.grade_id === gradeId || s.grade_id === "all")
    : subjects;

  const catalogOptions: { value: string; label: string }[] = matchingSubjects.length > 0
    ? Array.from(
        new Map(matchingSubjects.map((s) => [s.key, { value: s.key, label: s.name }])).values()
      )
    : [];
  const options: { value: string; label: string }[] = catalogOptions.length > 0 ? catalogOptions : error ? fallbackOptions : [];
  const currentOption = value && !options.some(option => option.value === value)
    ? { value, label: `${value.replace(/[_-]/g, " ")} (currently assigned)` }
    : null;

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {loading && options.length === 0 && <option value="">Loading subjects…</option>}
      {!loading && options.length === 0 && !currentOption && <option value="">No subjects configured for this grade</option>}
      {currentOption && <option value={currentOption.value}>{currentOption.label}</option>}
      {options.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </Select>
  );
};
