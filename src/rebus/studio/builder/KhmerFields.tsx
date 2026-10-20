/**
 * The same question in Khmer: one box for the question's words, one for why.
 * The answer, numbers and pictures are shared; only the words change.
 */

import React from "react";
import { useT } from "../../../lib/i18n";
import { UITextarea } from "../../../components/ui";
import type { PuzzleDraft } from "../studioApi";

export const KhmerFields: React.FC<{ draft: PuzzleDraft; onChange(patch: Partial<PuzzleDraft>): void }> = ({ draft, onChange }) => {
  const { t } = useT();
  const pieces = draft.km?.pieces ?? draft.pieces;
  const at = pieces.findIndex((p) => p.kind === "word");
  const question = at >= 0 && pieces[at].kind === "word" ? (pieces[at] as { text: string }).text : "";
  const setQuestion = (text: string) => {
    const base = draft.km?.pieces ?? draft.pieces;
    const index = base.findIndex((p) => p.kind === "word");
    if (index < 0) return;
    onChange({ km: { ...draft.km, pieces: base.map((p, i) => (i === index && p.kind === "word" ? { ...p, text } : p)) } });
  };
  return (
    <section className="flex flex-col gap-3" lang="km">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.khmer")}</h3>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.khmerQuestion")}</span>
        <UITextarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={240} disabled={at < 0} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.khmerExplanation")}</span>
        <UITextarea rows={2} value={draft.km?.explanation ?? ""} onChange={(e) => onChange({ km: { ...draft.km, explanation: e.target.value } })} maxLength={300} />
      </label>
    </section>
  );
};
