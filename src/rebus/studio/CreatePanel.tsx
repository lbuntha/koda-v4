/**
 * Make new puzzles: write one yourself, or have a model draft a batch.
 *
 * Both roads end in the same place. A new puzzle is saved as a draft for review,
 * or approved straight away when every check passes, and from there it waits for
 * the next release like any other.
 */

import React, { useState } from "react";
import { Calculator, PenLine, Sparkles } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { GeneratePanel } from "./GeneratePanel";
import { blankMath } from "./MathFields";
import { BLANK_DRAFT, PuzzleEditor } from "./PuzzleEditor";
import { StudioAPI } from "./studioApi";
import { messageOf } from "./useStudioAction";

type Way = "choose" | "write" | "math" | "ai";

export const CreatePanel: React.FC<{ onChanged(): void }> = ({ onChanged }) => {
  const { t } = useT();
  const [way, setWay] = useState<Way>("choose");
  const [done, setDone] = useState("");
  // A fresh editor each time, so a saved puzzle does not linger in the next one.
  const [round, setRound] = useState(0);

  if (way === "write" || way === "math") {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-3" aria-label={t(way === "math" ? "rebus.studio.math.title" : "rebus.studio.writeTitle")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={themeSystem.typography("h3")}>{t(way === "math" ? "rebus.studio.math.title" : "rebus.studio.writeTitle")}</h3>
          <UIButton size="sm" variant="ghost" onClick={() => setWay("choose")}>
            {t("rebus.studio.back")}
          </UIButton>
        </div>
        {done && (
          <p role="status" className={themeSystem.flash("success")}>
            {done}
          </p>
        )}
        <PuzzleEditor
          key={round}
          initial={way === "math" ? blankMath() : BLANK_DRAFT}
          approvable
          onCancel={() => setWay("choose")}
          onSave={async (draft, approve) => {
            try {
              const row = await StudioAPI.create({ ...draft, approve });
              const label = draft.kind === "math" ? row.pieces.map((p) => (p.kind === "word" ? p.text : "")).join("") : draft.answer;
              setDone(t(row.status === "approved" ? "rebus.studio.savedApproved" : approve ? "rebus.studio.savedNotApproved" : "rebus.studio.savedDraft", { answer: label }));
              setRound((n) => n + 1);
              onChanged();
              return null;
            } catch (e) {
              return messageOf(e);
            }
          }}
        />
      </section>
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
      onClick={() => setWay(id)}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {card("write", <PenLine />, t("rebus.studio.writeOne"), t("rebus.studio.writeOneText"))}
        {card("math", <Calculator />, t("rebus.studio.math.card"), t("rebus.studio.math.cardText"))}
        {card("ai", <Sparkles />, t("rebus.studio.draftAi"), t("rebus.studio.draftAiText"))}
      </div>
    </section>
  );
};
