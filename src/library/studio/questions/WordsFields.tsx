import { useState } from "react";
import { Check, ImagePlus } from "lucide-react";
import type { VocabQuestion } from "../../data/passage";
import { namesItself } from "../../data/verifyPassage";
import { pictureFor, storyWords, withVocabPicture, withVocabWord, type VocabEdit } from "../../draft";
import { Picture, PICTURE_KEYS } from "../../Picture";
import { photosOf } from "../../photos";
import { UIButton, UISelect } from "../../../components/ui";
import { PicturePanel } from "../PicturePanel";
import { KHMER, label, type Draft } from "./shared";
import { useT } from "../../../lib/i18n";

const wordSeed = (word: string) => `“${word}” on its own, clearly the main subject.`;

/**
 * A word's question from the curated word list straight away, or, for any other
 * story word, once a person has chosen the picture that shows it.
 */
function useWordPicker(draft: Draft, id: string, onChange: (next: VocabEdit) => void) {
  const { t } = useT();
  const [pending, setPending] = useState<string | null>(null);
  const pick = (word: string) => {
    const known = pictureFor(word, draft.language, PICTURE_KEYS);
    const next = known && withVocabWord(draft, id, word, known, PICTURE_KEYS);
    if (next) onChange(next);
    else setPending(word);
  };
  const panel = pending !== null && (
    <PicturePanel
      title={t("studio.q.pictureFor", { word: pending })}
      note={t("studio.q.pictureForNote", { word: pending })}
      chosen={draft.pictures[pending] ?? null}
      how="chosen"
      promptSeed={wordSeed(pending)}
      brief={{ subjectOnly: true, cambodia: draft.language === "km" }}
      suggested={draft.pictures[pending] ? [draft.pictures[pending]] : []}
      photos={photosOf(draft)}
      allowNone={false}
      at={null}
      onPlace={() => undefined}
      onChoose={(key) => {
        const next = key ? withVocabWord(draft, id, pending, key, PICTURE_KEYS) : null;
        if (next) onChange(next);
      }}
      onClose={() => setPending(null)}
    />
  );
  return { pick, panel };
}

/** A Words question: the story word, and the three pictures with the right one marked. */
export function WordsFields({ q, draft, onChange }: { q: VocabQuestion; draft: Draft; onChange(next: VocabEdit): void }) {
  const { t, tNodes } = useT();
  const km = draft.language === "km";
  const [editing, setEditing] = useState<number | null>(null);
  const { pick, panel } = useWordPicker(draft, q.id, onChange);
  const right = q.options[q.answer];
  const confirmed = draft.confirmedPictures ?? {};
  const needsConfirming = !namesItself(q.word, right) && (confirmed[q.word] ?? confirmed[q.word.toLowerCase()]) !== right;
  const choices = [...new Set([q.word, ...storyWords(draft.sentences, draft.language)])];

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
        <label>
          <span className={label}>{t("studio.q.wordFromStory")}</span>
          <UISelect className={km ? KHMER : ""} value={q.word} onChange={(e) => pick(e.target.value)}>
            {choices.map((w) => <option key={w}>{w}</option>)}
          </UISelect>
        </label>
        <div>
          <span className={label}>{t("studio.q.picturesShown")}</span>
          <div className="flex gap-2">
            {q.options.map((o, i) => (
              <button key={i} type="button" onClick={() => setEditing(i)}
                aria-label={i === q.answer ? t("studio.q.changeRight", { name: o }) : t("studio.q.changeWrong", { n: i + 1, name: o })} title={o}
                className={`h-16 w-20 overflow-hidden rounded-xl border-2 p-1 transition-colors ${i === q.answer ? "border-emerald-600 hover:border-emerald-500" : "border-line hover:border-indigo-400"}`}>
                <Picture name={o} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {needsConfirming && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-950/60 dark:text-rose-100">
          <span className="grow">{tNodes("studio.q.confirmPicture", { word: <b className={km ? KHMER : ""}>“{q.word}”</b> })}</span>
          <UIButton type="button" variant="secondary" size="sm" icon={<Check className="h-4 w-4" aria-hidden="true" />}
            onClick={() => onChange({ question: q, pictures: draft.pictures, confirmedPictures: { ...confirmed, [q.word]: right } })}>
            {t("studio.q.yesShows", { word: q.word })}
          </UIButton>
          <UIButton type="button" variant="ghost" size="sm" icon={<ImagePlus className="h-4 w-4" aria-hidden="true" />} onClick={() => setEditing(q.answer)}>
            {t("studio.q.chooseAnother")}
          </UIButton>
        </div>
      )}

      {editing !== null && (
        <PicturePanel
          title={editing === q.answer ? t("studio.q.pictureFor", { word: q.word }) : t("studio.q.wrongPictureFor", { word: q.word })}
          note={editing === q.answer ? t("studio.q.pictureForNote", { word: q.word }) : t("studio.q.wrongPictureNote")}
          chosen={q.options[editing]}
          how="chosen"
          // Only the right answer's picture is the word — naming it for a wrong
          // slot would draw the very thing that slot must not be.
          promptSeed={editing === q.answer ? wordSeed(q.word) : undefined}
          brief={{ subjectOnly: true, cambodia: km }}
          suggested={[...new Set([pictureFor(q.word, draft.language, PICTURE_KEYS), ...q.options])].filter((k): k is string => !!k)}
          suggestedLabel={t("studio.q.questionPictures")}
          photos={photosOf(draft)}
          allowNone={false}
          at={null}
          onPlace={() => undefined}
          onChoose={(key) => {
            if (key) onChange(withVocabPicture(q, draft.pictures, draft.language, editing, key, draft.confirmedPictures));
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {panel}
    </>
  );
}

/** A new Words question: pick an unused story word, then its picture. */
export function NewWordFields({ draft, id, onAdd, onCancel }: { draft: Draft; id: string; onAdd(next: VocabEdit): void; onCancel(): void }) {
  const { t } = useT();
  const km = draft.language === "km";
  const used = new Set(draft.questions.flatMap((q) => (q.kind === "vocab" ? [q.word] : [])));
  const unused = storyWords(draft.sentences, draft.language).filter((w) => !used.has(w));
  const [word, setWord] = useState(unused[0] ?? "");
  const { pick, panel } = useWordPicker(draft, id, onAdd);

  if (!unused.length) return <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t("studio.q.allWordsUsed")}</p>;
  return (
    <div className="grid gap-2 rounded-2xl border border-indigo-200 p-3 dark:border-indigo-800">
      <label>
        <span className={label}>{t("studio.q.newWord")}</span>
        <UISelect className={km ? KHMER : ""} value={word} onChange={(e) => setWord(e.target.value)}>
          {unused.map((w) => <option key={w}>{w}</option>)}
        </UISelect>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <UIButton type="button" variant="primary" size="sm" icon={<ImagePlus className="h-4 w-4" aria-hidden="true" />} disabled={!word} onClick={() => pick(word)}>
          {t("studio.q.choosePicture")}
        </UIButton>
        <UIButton type="button" variant="ghost" size="sm" onClick={onCancel}>{t("common.cancel")}</UIButton>
      </div>
      {panel}
    </div>
  );
}
