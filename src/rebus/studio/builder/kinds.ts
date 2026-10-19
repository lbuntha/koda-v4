import { Calculator, ImageIcon, ListChecks, Puzzle as PuzzleIcon, type LucideIcon } from "lucide-react";
import { deriveMath } from "../../math";
import { BLANK_MATH } from "../MathFields";
import type { PuzzleDraft } from "../studioApi";
import { BLANK_CHOICE } from "./ChoiceFields";

/**
 * The kinds of question the creator offers. "photo" is not a stored kind: it is a
 * picture puzzle started from one picture or photo, with the answer to name it.
 */
export type QuestionKind = "picture" | "photo" | "math" | "choice";

export const KINDS: ReadonlyArray<{ id: QuestionKind; icon: LucideIcon }> = [
  { id: "picture", icon: PuzzleIcon },
  { id: "photo", icon: ImageIcon },
  { id: "math", icon: Calculator },
  { id: "choice", icon: ListChecks },
];

/** A new question of a kind, with a level that suits it, in a category. */
export const blankFor = (kind: QuestionKind, category: string): PuzzleDraft => {
  const base = { category, trick: "compound" as const, pieces: [], answer: "", accepts: [], explanation: "" };
  switch (kind) {
    case "math":
      return { ...base, ages: [7, 12], difficulty: 2, kind: "math", math: BLANK_MATH, ...(deriveMath(BLANK_MATH) ?? {}) };
    case "choice":
      return { ...base, ages: [7, 12], difficulty: 1, kind: "choice", choice: { ...BLANK_CHOICE } };
    case "photo":
      return { ...base, ages: [5, 10], difficulty: 1 };
    default:
      return { ...base, ages: [6, 12], difficulty: 1 };
  }
};
