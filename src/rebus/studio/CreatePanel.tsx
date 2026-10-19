/**
 * Make new questions: build one yourself in three steps, or have a model draft a batch.
 *
 * Both roads end in the same place. A new question is saved as a draft for
 * review, or approved straight away when every check passes, and from there it
 * waits for the next release like any other.
 */

import React, { useState } from "react";
import { PenLine, Sparkles } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { GeneratePanel } from "./GeneratePanel";
import { QuestionWizard } from "./QuestionWizard";
import { StudioAPI, type PuzzleDraft } from "./studioApi";
import { messageOf } from "./useStudioAction";

type Way = "choose" | "write" | "ai";

/** What a saved question is called in the "saved" message: its answer, or for a math question the sum. */
const labelOf = (draft: PuzzleDraft, pieces: ReadonlyArray<{ kind: string; text?: string }>): string => (draft.kind === "math" ? pieces.map((p) => p.text ?? "").join("") : draft.answer);

export const CreatePanel: React.FC<{ onChanged(): void }> = ({ onChanged }) => {
  const { t } = useT();
  const [way, setWay] = useState<Way>("choose");
  const [done, setDone] = useState("");
  // A fresh creator each time, so a saved question does not linger in the next one.
  const [round, setRound] = useState(0);

  if (way === "write") {
    return (
      <div className="flex flex-col gap-3">
        {done && (
          <p role="status" className={themeSystem.flash("success")}>
            {done}
          </p>
        )}
        <QuestionWizard
          key={round}
          onCancel={() => setWay("choose")}
          onSave={async (draft, approve) => {
            try {
              const row = await StudioAPI.create({ ...draft, approve });
              const label = labelOf(draft, row.pieces as never);
              setDone(t(row.status === "approved" ? "rebus.studio.savedApproved" : approve ? "rebus.studio.savedNotApproved" : "rebus.studio.savedDraft", { answer: label }));
              setRound((n) => n + 1);
              onChanged();
              return null;
            } catch (e) {
              return messageOf(e);
            }
          }}
        />
      </div>
    );
  }

  if (way === "ai") {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <UIButton size="sm" variant="ghost" onClick={() => setWay("choose")}>
            {t("rebus.studio.back")}
          </UIButton>
        </div>
        <GeneratePanel onSaved={onChanged} />
      </div>
    );
  }

  const card = (id: Way, icon: React.ReactNode, title: string, text: string) => (
    <button
      type="button"
      onClick={() => {
        setDone("");
        setWay(id);
      }}
      className={themeSystem.card("interactive", `${themeSystem.spacing.card} flex min-h-[44px] flex-col items-start gap-2 text-left`)}
    >
      <span className="text-indigo-600 dark:text-indigo-400 [&>svg]:h-7 [&>svg]:w-7">{icon}</span>
      <span className={themeSystem.typography("h3")}>{title}</span>
      <span className={themeSystem.typography("body-sm")}>{text}</span>
    </button>
  );

  return (
    <section className="flex flex-col gap-4" aria-label={t("rebus.studio.tabCreate")}>
      <div>
        <h3 className={themeSystem.typography("h3")}>{t("rebus.studio.createTitle")}</h3>
        <p className={themeSystem.typography("body-sm", "mt-1")}>{t("rebus.studio.createText")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {card("write", <PenLine />, t("rebus.studio.writeOne"), t("rebus.studio.writeOneText"))}
        {card("ai", <Sparkles />, t("rebus.studio.draftAi"), t("rebus.studio.draftAiText"))}
      </div>
    </section>
  );
};
