import { useMemo } from "react";
import { CHOICES, type ComprehensionQuestion } from "../../data/passage";
import { UIInput, UIRadio, UISelect } from "../../../components/ui";
import { lengthFixes } from "./choiceSuggestions";
import { KHMER, label, type Draft } from "./shared";
import { useT } from "../../../lib/i18n";

/** An Understand question: its text, three choices with one marked right, and the sentence that proves it. */
export function UnderstandFields({ q, draft, onChange }: { q: ComprehensionQuestion; draft: Draft; onChange(p: Partial<ComprehensionQuestion>): void }) {
  const { t } = useT();
  const km = draft.language === "km";
  return (
    <div className="grid gap-2">
      <label>
        <span className={label}>{t("studio.q.question")}</span>
        <UIInput className={km ? KHMER : ""} value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </label>
      <fieldset>
        <legend className={label}>{t("studio.q.choices")}</legend>
        <div className="grid gap-2">
          {q.options.slice(0, CHOICES).map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <UIRadio name={`ans-${q.id}`} checked={q.answer === i} onChange={() => onChange({ answer: i })} aria-label={t("studio.q.choiceIsRight", { n: i + 1 })} />
              <UIInput className={km ? KHMER : ""} value={o} aria-label={t("studio.q.choice", { n: i + 1 })} onChange={(e) => onChange({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })} />
            </div>
          ))}
        </div>
      </fieldset>
      <label>
        <span className={label}>{t("studio.q.evidence")}</span>
        <UISelect className={km ? KHMER : ""} value={draft.sentences.some((s) => s.id === q.evidence) ? q.evidence : ""} onChange={(e) => onChange({ evidence: e.target.value })}>
          {!draft.sentences.some((s) => s.id === q.evidence) && <option value="" disabled>{t("studio.q.pickEvidence")}</option>}
          {draft.sentences.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.text.slice(0, 70)}</option>)}
        </UISelect>
      </label>
      <LengthSuggestions q={q} draft={draft} onChange={onChange} />
    </div>
  );
}

/** One-tap fixes when the right answer is the only long choice. */
function LengthSuggestions({ q, draft, onChange }: { q: ComprehensionQuestion; draft: Draft; onChange(p: Partial<ComprehensionQuestion>): void }) {
  const { t } = useT();
  const km = draft.language === "km";
  const fixes = useMemo(() => lengthFixes(q, draft), [q, draft]);
  if (!fixes.wrong.length && !fixes.answer.length) return null;
  const put = (index: number, text: string) => onChange({ options: q.options.map((x, j) => (j === index ? text : x)) });
  const chip = `rounded-xl border border-indigo-200 bg-white px-2.5 py-1 text-indigo-900 hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100 dark:hover:bg-indigo-900 ${km ? KHMER : ""}`;
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm dark:border-indigo-800 dark:bg-indigo-950/50">
      <p className="font-bold text-ink">{t("studio.q.longOnly")}</p>
      <p className="mt-0.5 text-muted">{t("studio.q.longFix")}</p>
      {fixes.wrong.map(({ index, options }) => (
        <div key={index} className="mt-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("studio.q.replaceChoice", { n: index + 1 })} · <span className={km ? `${KHMER} normal-case` : "normal-case"}>{q.options[index]}</span></p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {options.map((text) => (
              <button key={text} type="button" className={chip} lang={draft.language} aria-label={t("studio.q.useFor", { text, n: index + 1 })} onClick={() => put(index, text)}>{text}</button>
            ))}
          </div>
        </div>
      ))}
      {fixes.answer.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("studio.q.shorter")}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {fixes.answer.map((text) => (
              <button key={text} type="button" className={chip} lang={draft.language} aria-label={t("studio.q.useAsAnswer", { text })} onClick={() => put(q.answer, text)}>{text}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
