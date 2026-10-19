/**
 * Make one question, in three clear steps.
 *
 *   1  What kind of question, and which category.
 *   2  Build it. The builder follows the kind: pictures and words, a photo to
 *      name, two numbers, or a question with answers to choose from.
 *   3  Check it and save: the question as a child will meet it, the checks the
 *      server will run, a level, and Save as draft or Save & approve.
 *
 * "Next" stays off until the step is done and always says what is missing, in
 * words, taken from the same checks the server runs. Nothing is lost: a
 * question can be saved however far it got, as a draft.
 */

import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { deriveMath } from "../math";
import { useRebusCategories } from "../bank";
import { ChecksList } from "./builder/ChecksList";
import { ChoiceFields } from "./builder/ChoiceFields";
import { KINDS, blankFor, type QuestionKind } from "./builder/kinds";
import { LevelFields } from "./builder/LevelFields";
import { PiecesBuilder } from "./builder/PiecesBuilder";
import { QuestionPreview } from "./builder/QuestionPreview";
import { useChecks } from "./builder/useChecks";
import { MathFields } from "./MathFields";
import { AnswerFields, CategoryField } from "./PuzzleEditor";
import { useIssueText } from "./PuzzleCard";
import type { PuzzleDraft } from "./studioApi";

type Step = 1 | 2 | 3;

export interface QuestionWizardProps {
  /** Saving is the parent's job; it returns an error message, or null. */
  onSave(draft: PuzzleDraft, approve: boolean): Promise<string | null>;
  onCancel(): void;
  /** Start on a kind, skipping the first question (for "Write a math question"). */
  initialKind?: QuestionKind;
}

export const QuestionWizard: React.FC<QuestionWizardProps> = ({ onSave, onCancel, initialKind }) => {
  const { t } = useT();
  const issueText = useIssueText();
  const cats = useRebusCategories();
  const firstCategory = (kind: QuestionKind): string => (kind === "math" && cats.some((c) => c.id === "math") ? "math" : (cats[0]?.id ?? "food"));

  const [kind, setKind] = useState<QuestionKind | null>(initialKind ?? null);
  const [draft, setDraft] = useState<PuzzleDraft>(() => blankFor(initialKind ?? "picture", initialKind ? firstCategory(initialKind) : (cats[0]?.id ?? "food")));
  const [step, setStep] = useState<Step>(initialKind ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<PuzzleDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const issues = useChecks(draft);

  const choose = (next: QuestionKind) => {
    setKind(next);
    // A new kind starts fresh, but keeps the category already picked unless it is Math's own.
    setDraft((d) => blankFor(next, next === "math" && cats.some((c) => c.id === "math") ? "math" : d.category));
  };

  const save = async (approve: boolean) => {
    setBusy(true);
    setError("");
    const message = await onSave(draft, approve);
    setBusy(false);
    if (message) setError(message);
  };

  const steps = [t("rebus.studio.wizard.stepKind"), t("rebus.studio.wizard.stepBuild"), t("rebus.studio.wizard.stepCheck")];
  const blocked = step === 1 ? (kind === null ? t("rebus.studio.wizard.pickKind") : "") : step === 2 && issues.length > 0 ? issueText(issues[0]) : "";

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5" aria-label={t("rebus.studio.wizard.title")}>
      <ol className="flex items-center gap-2" aria-label={t("rebus.studio.wizard.steps")}>
        {steps.map((label, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const here = n === step;
          return (
            <li key={label} aria-current={here ? "step" : undefined} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!done}
                onClick={() => setStep(n)}
                className={`flex min-w-0 items-center gap-2 rounded-full px-1 py-1 text-sm font-black ${here ? "text-indigo-700 dark:text-indigo-300" : done ? "text-ink" : "text-muted"}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${here ? "bg-indigo-600 text-white" : done ? "bg-emerald-500 text-white" : "bg-surface-muted text-muted"}`}>{done ? <Check className="h-4 w-4" /> : n}</span>
                <span className="truncate">{label}</span>
              </button>
              {i < steps.length - 1 && <span aria-hidden="true" className={`h-0.5 flex-1 rounded ${done ? "bg-emerald-500" : "bg-line"}`} />}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h3 className={themeSystem.typography("h3")}>{t("rebus.studio.wizard.kindTitle")}</h3>
          <div role="radiogroup" aria-label={t("rebus.studio.wizard.kindTitle")} className="grid gap-3 sm:grid-cols-2">
            {KINDS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={kind === id}
                onClick={() => choose(id)}
                className={themeSystem.card("interactive", `${themeSystem.spacing.cardSm} flex min-h-[44px] flex-col items-start gap-1 text-left ${kind === id ? "!border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800" : ""}`)}
              >
                <span className="text-indigo-600 dark:text-indigo-400 [&>svg]:h-6 [&>svg]:w-6">
                  <Icon />
                </span>
                <span className={themeSystem.typography("h4")}>{t(`rebus.studio.wizard.kind_${id}`)}</span>
                <span className={themeSystem.typography("body-sm")}>{t(`rebus.studio.wizard.kind_${id}_text`)}</span>
              </button>
            ))}
          </div>
          <CategoryField value={draft.category} onChange={(category) => set({ category })} />
        </div>
      )}

      {step === 2 && kind && (
        <div className="flex flex-col gap-5">
          <h3 className={themeSystem.typography("h3")}>{t(`rebus.studio.wizard.kind_${kind}`)}</h3>
          {kind === "math" && draft.math ? (
            <MathFields
              spec={draft.math}
              onChange={(math) => {
                const derived = deriveMath(math);
                set(derived ? { math, ...derived } : { math, pieces: [], answer: "", accepts: [], explanation: "" });
              }}
            />
          ) : kind === "choice" ? (
            <>
              <ChoiceFields draft={draft} onChange={set} />
              <AnswerFields draft={draft} onChange={set} withAnswer={false} />
            </>
          ) : (
            <>
              <PiecesBuilder visual={kind === "photo"} pieces={draft.pieces} onChange={(pieces) => set({ pieces })} />
              <AnswerFields draft={draft} onChange={set} />
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <h3 className={themeSystem.typography("h3")}>{t("rebus.studio.wizard.checkTitle")}</h3>
          <QuestionPreview draft={draft} />
          <LevelFields draft={draft} onChange={set} />
          <ChecksList issues={issues} />
          {error && (
            <p role="alert" className={themeSystem.flash("error")}>
              {error}
            </p>
          )}
        </div>
      )}

      {blocked && (
        <p role="status" className={themeSystem.flash("info")}>
          {t("rebus.studio.wizard.toContinue", { what: blocked })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {step > 1 && !(step === 2 && initialKind) && (
          <UIButton variant="ghost" icon={<ArrowLeft />} onClick={() => setStep((s) => (s - 1) as Step)}>
            {t("rebus.studio.back")}
          </UIButton>
        )}
        {step < 3 ? (
          <UIButton icon={<ArrowRight />} disabled={blocked !== ""} onClick={() => setStep((s) => (s + 1) as Step)}>
            {t("rebus.studio.wizard.next")}
          </UIButton>
        ) : (
          <>
            <UIButton variant="success" icon={<Check />} isLoading={busy} disabled={busy || issues.length > 0} onClick={() => void save(true)}>
              {t("rebus.studio.saveApprove")}
            </UIButton>
            <UIButton variant="secondary" icon={<Save />} disabled={busy} onClick={() => void save(false)}>
              {t("rebus.studio.saveAsDraft")}
            </UIButton>
          </>
        )}
        <UIButton variant="ghost" onClick={onCancel}>
          {t("rebus.studio.cancel")}
        </UIButton>
      </div>
    </section>
  );
};
