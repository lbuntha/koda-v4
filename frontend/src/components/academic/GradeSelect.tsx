import React from "react";
import { Select } from "../ui/Select";
import { useAcademicCatalog } from "./useAcademicCatalog";

export interface GradeSelectProps extends Omit<React.ComponentPropsWithoutRef<typeof Select>, "children"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  fallbackOptions?: { value: string; label: string }[];
}

const DEFAULT_GRADE_FALLBACKS = [
  { value: "grade_1", label: "Grade 1 (Primary Math, Ages 6–7)" },
  { value: "kindergarten", label: "Kindergarten (Ages 5–6)" },
  { value: "pre_k", label: "Pre-K (Early Math, Ages 3–4)" },
  { value: "grade_2", label: "Grade 2 (Elementary Math, Ages 7–8)" },
  { value: "grade_3", label: "Grade 3 (Intermediate Math, Ages 8–9)" },
  { value: "grade_4", label: "Grade 4 (Upper Primary, Ages 9–10)" },
  { value: "grade_5", label: "Grade 5 (Advanced Math, Ages 10–11)" },
];

export const GradeSelect: React.FC<GradeSelectProps> = ({
  value,
  onChange,
  fallbackOptions = DEFAULT_GRADE_FALLBACKS,
  className,
  disabled,
  ...props
}) => {
  const { grades, loading } = useAcademicCatalog();

  const options = grades.length > 0
    ? grades.map((g) => ({
        value: g.key,
        label: `${g.name}${g.age_range ? ` (${g.age_range})` : ""}`,
      }))
    : fallbackOptions;

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {options.map((g) => (
        <option key={g.value} value={g.value}>
          {g.label}
        </option>
      ))}
    </Select>
  );
};
