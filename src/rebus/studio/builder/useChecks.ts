import { useMemo } from "react";
import { useRebusCategories } from "../../bank";
import { useRebusIcons } from "../../icons/useRebusIcons";
import { validatePuzzle } from "../../puzzle";
import type { Puzzle } from "../../types";
import type { PuzzleDraft } from "../studioApi";

/** A draft as the checks read it: a puzzle with no id yet. */
export const asPuzzle = (d: PuzzleDraft): Puzzle => ({ ...d, id: "draft", ages: d.ages, difficulty: d.difficulty as Puzzle["difficulty"], source: "official" });

/**
 * The checks a puzzle runs before it can be approved, as the author types.
 *
 * The same rules the server runs (`rebus_verify.py`), so the list here is the
 * list the server would give. What only the server can know (a photo that was
 * never uploaded, an answer that is taken) comes back when the puzzle is saved.
 */
export const useChecks = (draft: PuzzleDraft): string[] => {
  const icons = useRebusIcons();
  const cats = useRebusCategories();
  const iconIds = useMemo(() => new Set(icons.map((i) => i.id)), [icons]);
  const categoryIds = useMemo(() => new Set(cats.map((c) => c.id)), [cats]);
  return useMemo(() => validatePuzzle(asPuzzle(draft), { iconIds, categoryIds }).map((i) => i.code), [draft, iconIds, categoryIds]);
};
