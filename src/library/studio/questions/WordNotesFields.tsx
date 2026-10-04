import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { WordNote } from "../../data/passage";
import { core } from "../../data/text";
import { requestAiWordNotes, type Provider } from "../../api";
import { SectionEmpty, SectionHeader } from "./SectionHeader";
import { notesQuiz } from "../../session";
import { UIButton, UIInput, UISelect } from "../../../components/ui";
import { KHMER, label, type Draft } from "./shared";
import { useT } from "../../../lib/i18n";

/** Every distinct word in the story, as it is keyed: Khmer as written, English in lower case. */
function storyWordList(draft: Draft): string[] {
  const km = draft.language === "km";
  return [...new Set(draft.sentences.flatMap((s) => s.words.map((w) => (km ? core(w) : core(w).toLowerCase())).filter(Boolean)))];
}

/** Story words given a reading (ប្រជាប្រិយ → ប្រជា ប្រី) and an opposite (ធំ → តូច). Its own section, not tied to a question. */
export function WordNotesFields({ draft, provider, onChange, onInQuiz }: {
  draft: Draft; provider?: Provider; onChange(notes: Record<string, WordNote>): void; onInQuiz(next: NonNullable<Draft["notesInQuiz"]>): void;
}) {
  const { t } = useT();
  const km = draft.language === "km";
  const notes = draft.wordNotes ?? {};
  const words = storyWordList(draft);
  const unused = words.filter((w) => !(w in notes));
  const [adding, setAdding] = useState("");
  const [picking, setPicking] = useState(false);
  const pick = adding && unused.includes(adding) ? adding : unused[0] ?? "";
  const font = km ? KHMER : "";
  const [asking, setAsking] = useState(false);
  const [aiError, setAiError] = useState("");
  const [offered, setOffered] = useState<Array<{ word: string; reading?: string; opposite?: string; use: boolean }> | null>(null);

  // Listed words still missing a part get those parts; with none, the AI picks words.
  const suggest = async () => {
    setAsking(true);
    setPicking(false);
    setAiError("");
    setOffered(null);
    try {
      const gaps = Object.entries(notes).filter(([, n]) => !n.reading || !n.opposite).map(([w]) => w);
      const made = await requestAiWordNotes({ provider, language: draft.language, band: draft.band, sentences: draft.sentences.map((s) => s.text), words: gaps, have: Object.keys(notes) });
      // Only what is new: a story word, and a part the author has not written.
      const fresh = made.flatMap((n) => {
        const word = km ? n.word : n.word.toLowerCase();
        if (!words.includes(word)) return [];
        const had = notes[word] ?? {};
        const reading = had.reading ? undefined : n.reading;
        const opposite = had.opposite ? undefined : n.opposite;
        return reading || opposite ? [{ word, reading, opposite, use: true }] : [];
      });
      if (fresh.length) setOffered(fresh);
      else setAiError(t("studio.notes.aiNothing"));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : t("studio.notes.aiFailed"));
    } finally {
      setAsking(false);
    }
  };
  const useOffered = () => {
    const next = { ...notes };
    for (const o of offered ?? []) {
      if (!o.use) continue;
      const had = next[o.word] ?? {};
      next[o.word] = { ...had, ...(o.reading && !had.reading ? { reading: o.reading } : {}), ...(o.opposite && !had.opposite ? { opposite: o.opposite } : {}) };
    }
    onChange(next);
    setOffered(null);
  };

  const set = (word: string, patch: WordNote) => {
    const next = { ...notes[word], ...patch };
    for (const k of ["reading", "opposite"] as const) if (!next[k]) delete next[k];
    onChange({ ...notes, [word]: next });
  };
  const remove = (word: string) => {
    const { [word]: _gone, ...rest } = notes;
    onChange(rest);
  };

  const filled = Object.values(notes).filter((n) => n.reading || n.opposite).length;
  return (
    <div className="grid gap-3">
      <SectionHeader
        title={t("studio.notes.tab")}
        help={t("studio.notes.help")}
        have={filled}
        manualLabel={t("studio.section.write")}
        onManual={() => { setOffered(null); setAiError(""); setPicking(true); }}
        aiLabel={t("studio.section.make")}
        onAi={() => void suggest()}
        aiBusy={asking}
      >
        {picking && (unused.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-indigo-200 p-3 dark:border-indigo-800">
            <label className="min-w-40 grow">
              <span className={label}>{t("studio.notes.addWord")}</span>
              <UISelect className={font} value={pick} onChange={(e) => setAdding(e.target.value)}>
                {unused.map((w) => <option key={w}>{w}</option>)}
              </UISelect>
            </label>
            <UIButton type="button" variant="primary" size="sm" icon={<Plus className="h-4 w-4" aria-hidden="true" />} disabled={!pick}
              onClick={() => { onChange({ ...notes, [pick]: {} }); setAdding(""); setPicking(false); }}>
              {t("studio.notes.add")}
            </UIButton>
            <UIButton type="button" variant="ghost" size="sm" onClick={() => setPicking(false)}>{t("common.cancel")}</UIButton>
          </div>
        ) : <p className="text-sm text-muted">{t("studio.notes.allWords")}</p>)}
        {aiError && <p role="status" className="text-sm font-semibold text-rose-700 dark:text-rose-300">{aiError}</p>}
        {offered && (
          <div className="grid gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950/50">
            <p className="text-sm font-extrabold text-ink">{t("studio.notes.aiTitle")}</p>
            <p className="text-xs text-muted">{t("studio.notes.aiCheck")}</p>
            {offered.map((o, i) => (
              <label key={o.word} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl px-2 py-1.5 text-ink hover:bg-white/60 dark:hover:bg-indigo-900/40 ${font}`}>
                <input type="checkbox" className="h-4 w-4 self-center accent-indigo-600" checked={o.use}
                  onChange={(e) => setOffered(offered.map((x, j) => (j === i ? { ...x, use: e.target.checked } : x)))} />
                <b className="text-lg">{o.word}</b>
                {o.reading && <span className="text-sm"><span className="text-muted">{t("studio.notes.reading")}:</span> <b>{o.reading}</b></span>}
                {o.opposite && <span className="text-sm"><span className="text-muted">{t("studio.notes.opposite")}:</span> <b>{o.opposite}</b></span>}
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <UIButton type="button" variant="primary" size="sm" disabled={!offered.some((o) => o.use)} onClick={useOffered}>{t("studio.notes.aiUse")}</UIButton>
              <UIButton type="button" variant="ghost" size="sm" onClick={() => setOffered(null)}>{t("studio.notes.aiDismiss")}</UIButton>
            </div>
          </div>
        )}
      </SectionHeader>
      <QuizToggles draft={draft} onInQuiz={onInQuiz} />
      {Object.keys(notes).length === 0 && !picking && !offered && <SectionEmpty text={t("studio.notes.empty")} />}
      {Object.entries(notes).map(([word, note]) => (
        <div key={word} className="grid items-end gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[minmax(6rem,10rem)_1fr_1fr_auto]">
          <div>
            <span className={label}>{t("studio.notes.word")}</span>
            <p className={`py-2 text-lg font-extrabold text-ink ${font}`}>
              {word}
              {!words.includes(word) && <span className="ml-2 text-xs font-bold text-rose-700 dark:text-rose-300">{t("studio.notes.notInStory")}</span>}
            </p>
          </div>
          <label>
            <span className={label}>{t("studio.notes.reading")}</span>
            <UIInput className={font} lang={draft.language} value={note.reading ?? ""} placeholder={t(km ? "studio.notes.readingHintKm" : "studio.notes.readingHintEn")}
              onChange={(e) => set(word, { reading: e.target.value })} />
          </label>
          <label>
            <span className={label}>{t("studio.notes.opposite")}</span>
            <UIInput className={font} lang={draft.language} value={note.opposite ?? ""} placeholder={t(km ? "studio.notes.oppositeHintKm" : "studio.notes.oppositeHintEn")}
              onChange={(e) => set(word, { opposite: e.target.value })} />
          </label>
          <button type="button" onClick={() => remove(word)} aria-label={t("studio.notes.remove", { word })} title={t("studio.notes.remove", { word })}
            className="grid h-10 w-10 place-items-center rounded-xl text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Whether the notes also become quiz boards — "join each word to its opposite",
 * "join each word to how it is read". Off until the author ticks it; a board
 * needs two words with that note, so the line says how many it will have.
 */
function QuizToggles({ draft, onInQuiz }: { draft: Draft; onInQuiz(next: NonNullable<Draft["notesInQuiz"]>): void }) {
  const { t } = useT();
  const on = draft.notesInQuiz ?? {};
  return (
    <fieldset className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
      <legend className="px-1 text-sm font-extrabold text-ink">{t("studio.notes.inQuiz")}</legend>
      {(["opposite", "reading"] as const).map((kind) => {
        const ready = Object.keys(draft.wordNotes ?? {}).filter((w) => draft.wordNotes?.[w]?.[kind]?.trim()).length;
        const boards = notesQuiz({ ...draft, rev: 0, notesInQuiz: { [kind]: true } }, kind).length;
        return (
          <label key={kind} className="flex items-start gap-3 rounded-xl px-1 py-1 text-ink">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-600" checked={Boolean(on[kind])}
              onChange={(e) => onInQuiz({ ...on, [kind]: e.target.checked })} />
            <span>
              <span className="block font-bold">{t(`studio.notes.inQuiz${kind === "opposite" ? "Opposite" : "Reading"}`)}</span>
              <span className={`block text-xs ${boards ? "text-muted" : "font-semibold text-rose-700 dark:text-rose-300"}`}>
                {boards ? t("studio.notes.inQuizBoards", { words: ready, boards }) : t("studio.notes.inQuizNeedTwo")}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
