/**
 * Fix or write one puzzle, all on one page.
 *
 * It is the same parts the guided creator uses, one after another: what kind of
 * question it is decides the builder (pictures and words, numbers, or a
 * question with answers); then the answer and why, the category and level, and
 * the checks the server will run, shown as the author works. A puzzle is saved
 * however it stands, so work is never lost; it can only be approved once the
 * checklist is clear.
 */

import React, { useState } from "react";
import { Check, Save, X } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIInput, UISelect, UITextarea } from "../../components/ui";
import { categoryLabel } from "../categoryNames";
import { useRebusCategories } from "../bank";
import { deriveMath } from "../math";
import { PuzzleCanvas } from "../ui/PieceView";
import { ChecksList } from "./builder/ChecksList";
import { ChoiceFields } from "./builder/ChoiceFields";
import { LevelFields } from "./builder/LevelFields";
import { PiecesBuilder } from "./builder/PiecesBuilder";
import { useChecks } from "./builder/useChecks";
import { MathFields } from "./MathFields";
import type { PuzzleDraft } from "./studioApi";

export const BLANK_DRAFT: PuzzleDraft = { category: "food", ages: [6, 12], difficulty: 1, trick: "compound", pieces: [], answer: "", accepts: [], explanation: "" };

/** The answer a picture puzzle is read as, and why. */
export const AnswerFields: React.FC<{ draft: PuzzleDraft; onChange(patch: Partial<PuzzleDraft>): void; withAnswer?: boolean }> = ({ draft, onChange, withAnswer = true }) => {
  const { t } = useT();
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      {withAnswer && (
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.answer")}</span>
          <UIInput value={draft.answer} onChange={(e) => onChange({ answer: e.target.value })} maxLength={80} />
        </label>
      )}
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.explanation")}</span>
        <UITextarea rows={2} value={draft.explanation} onChange={(e) => onChange({ explanation: e.target.value })} maxLength={200} />
      </label>
    </section>
  );
};

/** The category a question is filed under: only ones children can pick, and the one it already has. */
export const CategoryField: React.FC<{ value: string; onChange(id: string): void }> = ({ value, onChange }) => {
  const { t } = useT();
  const cats = useRebusCategories();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.category")}</span>
      <UISelect value={value} onChange={(e) => onChange(e.target.value)}>
        {!cats.some((c) => c.id === value) && <option value={value}>{categoryLabel(value)}</option>}
        {cats.map((c) => (
          <option key={c.id} value={c.id}>
            {categoryLabel(c.id)}
          </option>
        ))}
      </UISelect>
    </label>
  );
};

export interface PuzzleEditorProps {
  initial: PuzzleDraft;
  /**
   * Saving is the parent's job (create or patch); it returns an error message, or null.
   * `approve` is true when the author chose "Save & approve".
   */
  onSave(draft: PuzzleDraft, approve: boolean): Promise<string | null>;
  onCancel(): void;
  /** Offer "Save & approve" beside "Save as draft". Off for a puzzle that is already live. */
  approvable?: boolean;
  saveLabel?: string;
}

export const PuzzleEditor: React.FC<PuzzleEditorProps> = ({ initial, onSave, onCancel, approvable = false, saveLabel }) => {
  const { t } = useT();
  const [draft, setDraft] = useState<PuzzleDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<PuzzleDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const issues = useChecks(draft);
  const kind = draft.kind ?? "picture";

  const save = async (approve: boolean) => {
    setBusy(true);
    setError("");
    const message = await onSave(draft, approve);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="flex flex-col gap-5">
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
          <PuzzleCanvas pieces={draft.pieces} label={t("rebus.puzzle")} />
          <PiecesBuilder pieces={draft.pieces} onChange={(pieces) => set({ pieces })} />
          <AnswerFields draft={draft} onChange={set} />
        </>
      )}

      <CategoryField value={draft.category} onChange={(category) => set({ category })} />
      <LevelFields draft={draft} onChange={set} />
      <ChecksList issues={issues} />

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {approvable && (
          <UIButton variant="success" icon={<Check />} isLoading={busy} disabled={busy || issues.length > 0} onClick={() => void save(true)}>
            {t("rebus.studio.saveApprove")}
          </UIButton>
        )}
        <UIButton variant={approvable ? "secondary" : "primary"} icon={<Save />} isLoading={busy && !approvable} disabled={busy} onClick={() => void save(false)}>
          {saveLabel ?? (approvable ? t("rebus.studio.saveAsDraft") : t("rebus.studio.save"))}
        </UIButton>
        <UIButton variant="ghost" icon={<X />} onClick={onCancel}>
          {t("rebus.studio.cancel")}
        </UIButton>
      </div>
    </div>
  );
};
