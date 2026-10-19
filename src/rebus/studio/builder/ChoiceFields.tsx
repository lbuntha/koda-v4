/**
 * Writing a multiple-choice question: the question, a picture if it helps, and
 * two to four answers with one marked right.
 *
 * The question is a line of text (it becomes the puzzle's first piece), the
 * answers are lines of text, and the right one is a radio button, so there is no
 * answer to type twice. Which answer a child sees first is decided when they
 * play, so the right one is not always the top one.
 */

import React from "react";
import { Plus, X } from "lucide-react";
import { useT } from "../../../lib/i18n";
import { themeSystem } from "../../../lib/themeSystem";
import { UIButton, UIInput } from "../../../components/ui";
import { MAX_OPTION_CHARS, MAX_OPTIONS, MIN_OPTIONS, deriveChoice, type ChoiceSpec } from "../../choice";
import type { Piece } from "../../types";
import type { PuzzleDraft } from "../studioApi";
import { PiecesBuilder } from "./PiecesBuilder";

export const BLANK_CHOICE: ChoiceSpec = { options: ["", ""], correct: 0 };

/** The question's text: the first word piece. */
export const questionOf = (pieces: readonly Piece[]): string => {
  const word = pieces.find((p) => p.kind === "word");
  return word?.kind === "word" ? word.text : "";
};

const withQuestion = (pieces: Piece[], text: string): Piece[] => {
  const others = pieces.filter((p) => p.kind !== "word");
  return text.trim() === "" ? others : [{ kind: "word", text }, ...others];
};

/** The draft's fields that follow from the answers: the answer itself, and no extra accepted spellings. */
export const choicePatch = (choice: ChoiceSpec): Partial<PuzzleDraft> => {
  const derived = deriveChoice(choice);
  return derived ? { choice: derived.choice, answer: derived.answer, accepts: [] } : { choice, answer: "", accepts: [] };
};

export const ChoiceFields: React.FC<{ draft: PuzzleDraft; onChange(patch: Partial<PuzzleDraft>): void }> = ({ draft, onChange }) => {
  const { t } = useT();
  const choice = draft.choice ?? BLANK_CHOICE;
  const change = (next: ChoiceSpec) => onChange(choicePatch(next));
  const setOption = (i: number, text: string) => change({ ...choice, options: choice.options.map((o, j) => (j === i ? text : o)) });
  const removeOption = (i: number) => {
    if (choice.options.length <= MIN_OPTIONS) return;
    change({ options: choice.options.filter((_, j) => j !== i), correct: choice.correct === i ? 0 : choice.correct > i ? choice.correct - 1 : choice.correct });
  };

  return (
    <section className="flex flex-col gap-4" aria-label={t("rebus.studio.choice.title")}>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.choice.question")}</span>
        <UIInput value={questionOf(draft.pieces)} maxLength={40} onChange={(e) => onChange({ pieces: withQuestion(draft.pieces, e.target.value) })} placeholder={t("rebus.studio.choice.questionHint")} />
      </label>

      <PiecesBuilder visual compact pieces={draft.pieces} onChange={(pieces) => onChange({ pieces })} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.choice.answers")}</legend>
        {choice.options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct-answer"
              checked={choice.correct === i}
              aria-label={t("rebus.studio.choice.markRight", { n: i + 1 })}
              onChange={() => change({ ...choice, correct: i })}
              className="h-5 w-5 shrink-0 accent-emerald-600"
            />
            <UIInput aria-label={t("rebus.studio.choice.answerN", { n: i + 1 })} value={option} maxLength={MAX_OPTION_CHARS} onChange={(e) => setOption(i, e.target.value)} className="flex-1" />
            <UIButton variant="ghost" size="icon" aria-label={t("rebus.studio.choice.removeAnswer", { n: i + 1 })} icon={<X />} disabled={choice.options.length <= MIN_OPTIONS} onClick={() => removeOption(i)} />
          </div>
        ))}
        <p className={themeSystem.typography("caption")}>{t("rebus.studio.choice.rightHint")}</p>
        {choice.options.length < MAX_OPTIONS && (
          <div>
            <UIButton size="sm" variant="secondary" icon={<Plus />} onClick={() => change({ ...choice, options: [...choice.options, ""] })}>
              {t("rebus.studio.choice.addAnswer")}
            </UIButton>
          </div>
        )}
      </fieldset>
    </section>
  );
};
