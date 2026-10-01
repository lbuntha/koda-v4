import type { Band, SpellQuestion } from "../../data/passage";
import { core, gapOf } from "../../data/text";
import { tilesOf, whyUnspellable } from "../../data/tiles";
import { BAND_LEVEL_CAP, levelName, spellingLevel, unitCue } from "../../data/khmerCoach";
import { UISelect } from "../../../components/ui";
import { KHMER, label, type Draft } from "./shared";
import { useT } from "../../../lib/i18n";

/** A Spell question: a sentence, the word taken out of it, and the gapped sentence a child sees. */
export function SpellFields({ q, draft, onChange }: { q: SpellQuestion; draft: Draft; onChange(p: Partial<SpellQuestion>): void }) {
  const { t } = useT();
  const km = draft.language === "km";
  const s = draft.sentences.find((x) => x.id === q.sentence);
  const words = s ? [...new Set(s.words.map(core).filter(Boolean))] : [];
  const g = s ? gapOf(s, q.word, draft.language) : null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label>
        <span className={label}>{t("studio.q.sentence")}</span>
        <UISelect className={km ? KHMER : ""} value={q.sentence} onChange={(e) => {
          const next = draft.sentences.find((x) => x.id === e.target.value)!;
          const w = core(next.words.find((t) => core(t).length >= 3) ?? next.words[0]);
          onChange({ sentence: next.id, word: km ? w : w.toLowerCase() });
        }}>
          {draft.sentences.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.text.slice(0, 60)}</option>)}
        </UISelect>
      </label>
      <label>
        <span className={label}>{t("studio.q.wordToSpell")}</span>
        <UISelect className={km ? KHMER : ""} value={words.find((w) => w.toLowerCase() === q.word.toLowerCase()) ?? q.word} onChange={(e) => onChange({ word: km ? e.target.value : e.target.value.toLowerCase() })}>
          {[...new Set([q.word, ...words])].map((w) => <option key={w} value={w}>{w}</option>)}
        </UISelect>
      </label>
      <p className={`rounded-xl bg-surface-muted px-3 py-2 text-ink sm:col-span-2 ${km ? `${KHMER} text-lg` : ""}`}>{g ? g.text : t("studio.q.notInSentence")}</p>
      {km && !whyUnspellable(q.word, "km") && <SpellLevel word={q.word} band={draft.band} />}
    </div>
  );
}

/** A Khmer spelling word's level and its units by name, so an author sees what a child will be asked. */
function SpellLevel({ word, band }: { word: string; band: Band }) {
  const { t } = useT();
  const units = tilesOf(word, "km");
  const level = spellingLevel(units);
  const over = level > BAND_LEVEL_CAP[band];
  return (
    <p className={`rounded-xl px-3 py-2 text-sm sm:col-span-2 ${over ? "bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-100" : "bg-surface-muted text-ink"}`}>
      <b>{t("studio.q.spellingLevel", { level })}</b> · {levelName(level)}
      {over && ` — ${t("studio.q.aboveCap", { cap: BAND_LEVEL_CAP[band], band })}`}
      <span className={`mt-1 block ${KHMER} text-base`}>{units.map(unitCue).join(" · ")}</span>
    </p>
  );
}
