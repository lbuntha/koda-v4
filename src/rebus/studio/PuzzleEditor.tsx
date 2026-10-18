/**
 * Write or fix one puzzle.
 *
 * The pieces are built from the icon library (nothing can name a drawing that
 * does not exist), with a live preview and the same checks the server will
 * run, shown as the author types. A puzzle is saved however it stands, so work
 * is never lost; it can only be approved once the checklist is clear.
 *
 * Kept simple: the picture row, the answer and why it works, a category and a
 * level. The exact ages, difficulty, trick and extra accepted answers sit under
 * "More options".
 */

import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Save, X } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIAgePicker, UIButton, UIInput, UISelect, UITabs, UITextarea } from "../../components/ui";
import { LEVELS, levelOf } from "./levels";
import { CATEGORIES } from "../categories";
import { useRebusIcons } from "../icons/useRebusIcons";
import { validatePuzzle } from "../puzzle";
import { TRICKS, type Piece, type Puzzle, type Trick } from "../types";
import { PuzzleCanvas } from "../ui/PieceView";
import { IconPicker } from "./IconPicker";
import { useIssueText } from "./PuzzleCard";
import type { PuzzleDraft } from "./studioApi";

export const BLANK_DRAFT: PuzzleDraft = { category: "food", ages: [6, 12], difficulty: 1, trick: "compound", pieces: [], answer: "", accepts: [], explanation: "" };

const asPuzzle = (d: PuzzleDraft): Puzzle => ({ ...d, id: "draft", ages: d.ages, difficulty: d.difficulty as Puzzle["difficulty"], category: d.category as Puzzle["category"], source: "official" });

/** What each piece is called in the list, so the author can find and fix it. */
const pieceLabel = (p: Piece): string => (p.kind === "icon" ? p.name : p.kind === "word" ? p.text : p.kind === "stack" ? `${p.top} / ${p.bottom}` : p.op);

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
  const issueText = useIssueText();
  const [draft, setDraft] = useState<PuzzleDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wordText, setWordText] = useState("");
  const [stackTop, setStackTop] = useState("");
  const [stackBottom, setStackBottom] = useState("");
  const [more, setMore] = useState(false);

  const set = (patch: Partial<PuzzleDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const icons = useRebusIcons();
  const iconIds = useMemo(() => new Set(icons.map((i) => i.id)), [icons]);
  const issues = useMemo(() => validatePuzzle(asPuzzle(draft), { iconIds }).map((i) => i.code), [draft, iconIds]);

  const add = (piece: Piece) => set({ pieces: [...draft.pieces, piece] });
  const remove = (i: number) => set({ pieces: draft.pieces.filter((_, j) => j !== i) });
  const move = (i: number, by: -1 | 1) => {
    const next = [...draft.pieces];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ pieces: next });
  };
  const rename = (i: number, name: string) => set({ pieces: draft.pieces.map((p, j) => (j === i && p.kind === "icon" ? { ...p, name } : p)) });

  const save = async (approve: boolean) => {
    setBusy(true);
    setError("");
    const message = await onSave(draft, approve);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="flex flex-col gap-5">
      <PuzzleCanvas pieces={draft.pieces} label={t("rebus.puzzle")} />

      <section className="flex flex-col gap-2" aria-label={t("rebus.studio.pieces")}>
        <h4 className={themeSystem.typography("h4")}>{t("rebus.studio.pieces")}</h4>
        <ol className="flex flex-col gap-1.5">
          {draft.pieces.map((p, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted px-2.5 py-1.5">
              {p.kind === "icon" ? (
                <UIInput aria-label={t("rebus.studio.readAs", { n: i + 1 })} value={p.name} onChange={(e) => rename(i, e.target.value)} className="!min-h-9 flex-1 !py-1" />
              ) : (
                <span className="flex-1 text-sm font-bold text-ink">{pieceLabel(p)}</span>
              )}
              <UIButton variant="ghost" size="icon" aria-label={t("rebus.studio.moveLeft", { n: i + 1 })} icon={<ArrowLeft />} disabled={i === 0} onClick={() => move(i, -1)} />
              <UIButton variant="ghost" size="icon" aria-label={t("rebus.studio.moveRight", { n: i + 1 })} icon={<ArrowRight />} disabled={i === draft.pieces.length - 1} onClick={() => move(i, 1)} />
              <UIButton variant="ghost" size="icon" aria-label={t("rebus.studio.removePiece", { n: i + 1 })} icon={<X />} onClick={() => remove(i)} />
            </li>
          ))}
          {draft.pieces.length === 0 && <li className="text-sm text-muted">{t("rebus.studio.noPieces")}</li>}
        </ol>

        <IconPicker onPick={(id, name) => add({ kind: "icon", id, name })} />

        <div className="flex flex-wrap gap-2">
          <UIButton size="sm" variant="secondary" onClick={() => add({ kind: "op", op: "+" })}>
            +
          </UIButton>
          <UIButton size="sm" variant="secondary" onClick={() => add({ kind: "op", op: "&" })}>
            &amp;
          </UIButton>
        </div>
        <div className="flex gap-2">
          <UIInput aria-label={t("rebus.studio.wordText")} placeholder={t("rebus.studio.wordText")} value={wordText} onChange={(e) => setWordText(e.target.value)} maxLength={40} />
          <UIButton variant="secondary" disabled={!wordText.trim()} onClick={() => { add({ kind: "word", text: wordText.trim() }); setWordText(""); }}>
            {t("rebus.studio.addWord")}
          </UIButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <UIInput aria-label={t("rebus.studio.stackTop")} placeholder={t("rebus.studio.stackTop")} value={stackTop} onChange={(e) => setStackTop(e.target.value)} maxLength={40} className="min-w-32 flex-1" />
          <UIInput aria-label={t("rebus.studio.stackBottom")} placeholder={t("rebus.studio.stackBottom")} value={stackBottom} onChange={(e) => setStackBottom(e.target.value)} maxLength={40} className="min-w-32 flex-1" />
          <UIButton variant="secondary" disabled={!stackTop.trim() || !stackBottom.trim()} onClick={() => { add({ kind: "stack", top: stackTop.trim(), bottom: stackBottom.trim() }); setStackTop(""); setStackBottom(""); }}>
            {t("rebus.studio.addStack")}
          </UIButton>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.answer")}</span>
          <UIInput value={draft.answer} onChange={(e) => set({ answer: e.target.value })} maxLength={80} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.category")}</span>
          <UISelect value={draft.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(`rebus.categories.${c.id}`)}
              </option>
            ))}
          </UISelect>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.explanation")}</span>
          <UITextarea rows={2} value={draft.explanation} onChange={(e) => set({ explanation: e.target.value })} maxLength={200} />
        </label>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.level")}</span>
          <UITabs
            label={t("rebus.studio.level")}
            items={LEVELS.map((l) => ({ id: l.id, label: t(`rebus.studio.level_${l.id}`) }))}
            value={levelOf(draft.ages, draft.difficulty) ?? ""}
            onChange={(id) => {
              const level = LEVELS.find((l) => l.id === id);
              if (level) set({ ages: [level.ages[0], level.ages[1]], difficulty: level.difficulty });
            }}
          />
          <span className={themeSystem.typography("caption")}>{t("rebus.studio.levelLine", { min: draft.ages[0], max: draft.ages[1], difficulty: t(`rebus.studio.difficulty.${draft.difficulty}`) })}</span>
        </div>

        <div className="sm:col-span-2">
          <UIButton size="sm" variant="ghost" aria-expanded={more} onClick={() => setMore((v) => !v)}>
            {more ? t("rebus.studio.fewerOptions") : t("rebus.studio.moreOptions")}
          </UIButton>
        </div>
        {more && (
          <>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.accepts")}</span>
              <UIInput value={draft.accepts.join(", ")} onChange={(e) => set({ accepts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder={t("rebus.studio.acceptsHint")} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.trick")}</span>
              <UISelect value={draft.trick} onChange={(e) => set({ trick: e.target.value as Trick })}>
                {TRICKS.map((k) => (
                  <option key={k} value={k}>
                    {t(`rebus.studio.trickName.${k}`)}
                  </option>
                ))}
              </UISelect>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.difficultyLabel")}</span>
              <UITabs label={t("rebus.studio.difficultyLabel")} items={[1, 2, 3].map((d) => ({ id: String(d), label: t(`rebus.studio.difficulty.${d}`) }))} value={String(draft.difficulty)} onChange={(id) => set({ difficulty: Number(id) })} />
            </div>
            <div className="sm:col-span-2">
              <UIAgePicker value={draft.ages} onChange={(ages) => set({ ages: [ages[0], ages[1]] })} />
            </div>
          </>
        )}
      </section>

      <section aria-label={t("rebus.studio.checks")} className={themeSystem.card("default", themeSystem.spacing.cardSm)}>
        <h4 className={themeSystem.typography("h4")}>{t("rebus.studio.checks")}</h4>
        {issues.length === 0 ? (
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{t("rebus.studio.checksPass")}</p>
        ) : (
          <ul className="mt-1 list-disc pl-5 text-sm font-bold text-rose-700 dark:text-rose-300">
            {issues.map((code) => (
              <li key={code}>{issueText(code)}</li>
            ))}
          </ul>
        )}
      </section>

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
