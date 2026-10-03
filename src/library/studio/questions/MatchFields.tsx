import { Plus, X } from "lucide-react";
import { MATCH_MAX_PAIRS, MATCH_MIN_PAIRS, type MatchPair, type MatchQuestion } from "../../data/passage";
import { UIInput, UISelect } from "../../../components/ui";
import { KHMER, label, type Draft } from "./shared";
import { useT } from "../../../lib/i18n";

/** What a new matching question asks, in the book's own language — it is content, not app text. */
export const matchPrompt = (lang: Draft["language"]) => (lang === "km" ? "ផ្គូផ្គងសំណួរនីមួយៗទៅនឹងចម្លើយរបស់វា។" : "Match each question to its answer.");

/** A new matching question: the prompt and three empty pairs to fill in. */
export const blankMatch = (id: string, lang: Draft["language"]): MatchQuestion => ({
  id,
  kind: "match",
  prompt: matchPrompt(lang),
  pairs: Array.from({ length: MATCH_MIN_PAIRS }, () => ({ left: "", right: "" })),
});

/**
 * A matching question: its instruction, then 3–5 pairs. Each pair is a question
 * (or word) and its answer, and may name the sentence the answer comes from so
 * the check can hold it to that sentence rather than the whole story.
 */
export function MatchFields({ q, draft, onChange }: { q: MatchQuestion; draft: Draft; onChange(p: Partial<MatchQuestion>): void }) {
  const { t } = useT();
  const km = draft.language === "km";
  const setPair = (i: number, patch: Partial<MatchPair>) =>
    onChange({ pairs: q.pairs.map((pr, j) => (j === i ? { ...pr, ...patch } : pr)) });
  return (
    <div className="grid gap-3">
      <label>
        <span className={label}>{t("studio.q.matchPrompt")}</span>
        <UIInput className={km ? KHMER : ""} lang={draft.language} value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </label>
      <fieldset className="grid gap-2">
        <legend className={label}>{t("studio.q.pairs", { min: MATCH_MIN_PAIRS, max: MATCH_MAX_PAIRS })}</legend>
        {q.pairs.map((pr, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <UIInput className={km ? KHMER : ""} lang={draft.language} value={pr.left} placeholder={t("studio.q.pairLeft")} aria-label={t("studio.q.pairLeftN", { n: i + 1 })} onChange={(e) => setPair(i, { left: e.target.value })} />
            <UIInput className={km ? KHMER : ""} lang={draft.language} value={pr.right} placeholder={t("studio.q.pairRight")} aria-label={t("studio.q.pairRightN", { n: i + 1 })} onChange={(e) => setPair(i, { right: e.target.value })} />
            <button
              type="button"
              disabled={q.pairs.length <= MATCH_MIN_PAIRS}
              onClick={() => onChange({ pairs: q.pairs.filter((_, j) => j !== i) })}
              aria-label={t("studio.q.removePair", { n: i + 1 })}
              title={t("studio.q.removePair", { n: i + 1 })}
              className="grid h-10 w-10 place-items-center self-center rounded-full text-rose-700 hover:bg-rose-50 disabled:opacity-30 dark:text-rose-300 dark:hover:bg-rose-950"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <UISelect
              className={`sm:col-span-3 ${km ? KHMER : ""}`}
              aria-label={t("studio.q.pairEvidenceN", { n: i + 1 })}
              value={pr.evidence && draft.sentences.some((s) => s.id === pr.evidence) ? pr.evidence : ""}
              onChange={(e) => setPair(i, { evidence: e.target.value || undefined })}
            >
              <option value="">{t("studio.q.anywhereInStory")}</option>
              {draft.sentences.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.text.slice(0, 70)}</option>)}
            </UISelect>
          </div>
        ))}
      </fieldset>
      <div>
        <button
          type="button"
          disabled={q.pairs.length >= MATCH_MAX_PAIRS}
          onClick={() => onChange({ pairs: [...q.pairs, { left: "", right: "" }] })}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold text-ink hover:border-indigo-400 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("studio.q.addPair")}
        </button>
      </div>
    </div>
  );
}
