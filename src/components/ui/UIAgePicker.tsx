import React from "react";
import { GRADE_CHIPS, chipSelected, gradesOf, isAgeRange, toggleGrade, type AgeRange } from "../../lib/ages";
import { useT } from "../../lib/i18n";
import { UIButton } from "./ThemeUI";

export interface UIAgePickerProps {
  value: AgeRange | null | undefined;
  onChange(next: AgeRange): void;
  className?: string;
}

/**
 * Who this is for, picked as school grades and saved as ages.
 *
 * One row of chips from pre-school to Grade 12; the chosen ones are always one
 * unbroken run (see `toggleGrade`). The line under it reads the choice back in
 * both terms, so an author who thinks in ages can check the grades meant what
 * they wanted. Required to publish, so an empty picker says so.
 */
export const UIAgePicker: React.FC<UIAgePickerProps> = ({ value, onChange, className = "" }) => {
  const { t } = useT();
  const gradeName = (grade: number) => (grade === 0 ? t("ages.preK") : t("ages.grade", { grade }));
  const set = isAgeRange(value);
  const [first, last] = set ? gradesOf(value) : [0, 0];

  return (
    <fieldset className={`flex flex-col gap-2 ${className}`}>
      {/* The studios' own field-label style, so it sits among them as one more field. */}
      <legend className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted">{t("ages.label")}</legend>
      <div className="flex flex-wrap gap-1.5">
        {GRADE_CHIPS.map((chip) => {
          const on = chipSelected(value, chip);
          return (
            <UIButton
              key={chip.grade}
              type="button"
              size="sm"
              variant={on ? "primary" : "secondary"}
              aria-pressed={on}
              className="min-w-11 rounded-full"
              onClick={() => onChange(toggleGrade(value, chip.grade))}
            >
              {chip.grade === 0 ? t("ages.preK") : chip.grade}
            </UIButton>
          );
        })}
      </div>
      <p className={`text-xs ${set ? "text-muted" : "font-bold text-rose-600 dark:text-rose-400"}`} aria-live="polite">
        {set
          ? t(value[0] === value[1] ? "ages.summaryOne" : "ages.summary", {
              grades: first === last ? gradeName(first) : `${gradeName(first)} – ${gradeName(last)}`,
              from: value[0],
              to: value[1],
            })
          : t("ages.required")}
      </p>
    </fieldset>
  );
};
