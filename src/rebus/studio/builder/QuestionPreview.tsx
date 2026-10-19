import React from "react";
import { useT } from "../../../lib/i18n";
import { themeSystem } from "../../../lib/themeSystem";
import { UIChoiceGrid } from "../../../components/ui";
import { isChoiceSpec, visibleOptions } from "../../choice";
import { PuzzleCanvas } from "../../ui/PieceView";
import type { PuzzleDraft } from "../studioApi";

/**
 * The question as a child will meet it: the same pieces, and for a choice the same answers
 * to tap (the right one ticked, so the author can see which is which). Nothing here can be answered.
 */
export const QuestionPreview: React.FC<{ draft: PuzzleDraft }> = ({ draft }) => {
  const { t } = useT();
  const choice = draft.kind === "choice" && isChoiceSpec(draft.choice) ? draft.choice : null;
  return (
    <section className="flex flex-col gap-3" aria-label={t("rebus.studio.preview")}>
      <h4 className={themeSystem.typography("h4")}>{t("rebus.studio.preview")}</h4>
      <PuzzleCanvas pieces={draft.pieces} label={t("rebus.puzzle")} />
      {choice ? (
        <UIChoiceGrid label={t("rebus.chooseAnswer")} options={visibleOptions(choice, 0, "preview").filter((o) => o.trim() !== "")} chosen={draft.answer || null} onPick={() => {}} disabled />
      ) : (
        draft.answer && (
          <p className="text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
            {t("rebus.studio.math.answerIs", { n: draft.answer })}
          </p>
        )
      )}
    </section>
  );
};
