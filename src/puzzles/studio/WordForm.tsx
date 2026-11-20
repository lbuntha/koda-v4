import React, { useState } from "react";
import { Rocket, Save, Send } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIInput, UISelect } from "../../components/ui";
import { messageOf } from "../../rebus/studio/useStudioAction";
import { PUZZLE_CATEGORIES, type PuzzleCategory, type PuzzleLang } from "../types";
import { tilesOf, wordProblem } from "../wordGuess";
import { WordTiles } from "../ui/WordTiles";
import { PICTURE_NAMES, WordPicture, suggestPicture } from "../ui/WordPicture";
import { PuzzleStudioAPI, type StudioWord } from "./studioApi";

/**
 * Add one word, or change one.
 *
 * The tiles appear as the word is typed, from the same spelling code the game
 * uses, so what the author sees is exactly what a child will guess. A problem
 * is said in plain words before anything is saved.
 */
export const WordForm: React.FC<{ canRun: boolean; editing?: StudioWord | null; onSaved(word: StudioWord): void; onCancel?(): void }> = ({
  canRun,
  editing = null,
  onSaved,
  onCancel,
}) => {
  const { t } = useT();
  const [lang, setLang] = useState<PuzzleLang>(editing?.lang ?? "km");
  const [word, setWord] = useState(editing?.data.word ?? "");
  const [category, setCategory] = useState<PuzzleCategory>(editing?.data.category ?? "animal");
  const [clueKm, setClueKm] = useState(editing?.data.clue.km ?? "");
  const [clueEn, setClueEn] = useState(editing?.data.clue.en ?? "");
  /* The picture follows the word until the author picks one themselves. */
  const [pictureChoice, setPictureChoice] = useState<string | null>(editing ? (editing.data.picture ?? "") : null);
  const picture = pictureChoice ?? suggestPicture(lang, word, clueEn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const problem = word.trim() ? wordProblem(word, lang) : null;
  const tiles = word.trim() && !problem ? tilesOf(word, lang) : [];

  const save = async (then: "draft" | "review" | "published") => {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const body = { word, category, clue: { km: clueKm.trim(), en: clueEn.trim() }, picture };
      let row = editing ? await PuzzleStudioAPI.edit(editing.id, body) : await PuzzleStudioAPI.create({ lang, ...body });
      if (then !== "draft" && row.status !== then) row = await PuzzleStudioAPI.status(row.id, then);
      setSaved(t(then === "published" ? "puzzleStudio.savedLive" : then === "review" ? "puzzleStudio.savedReview" : "puzzleStudio.savedDraft", { word: row.data.word }));
      if (!editing) {
        setWord("");
        setClueKm("");
        setClueEn("");
        setPictureChoice(null);
      }
      onSaved(row);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const label = "mb-1 block text-sm font-bold text-ink";
  return (
    <form
      className={themeSystem.card("default", "space-y-4 p-4 sm:p-5")}
      onSubmit={(e) => {
        e.preventDefault();
        void save(canRun ? "published" : "review");
      }}
    >
      {!editing && (
        <div>
          <span className={label}>{t("puzzleStudio.language")}</span>
          <div className="inline-flex rounded-2xl border-2 border-line bg-surface p-1" role="group">
            {(["km", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={`rounded-xl px-4 py-1.5 text-sm font-black ${lang === l ? "bg-indigo-600 text-white" : "text-body"}`}
              >
                {l === "km" ? "ខ្មែរ" : "English"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={label} htmlFor="ps-word">
          {t("puzzleStudio.word")}
        </label>
        <UIInput
          id="ps-word"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder={lang === "km" ? "ឆ្មា" : "cat"}
          autoComplete="off"
          className="text-2xl font-black"
          aria-describedby="ps-word-help"
        />
        <div id="ps-word-help" className="mt-2 min-h-[3rem]">
          {problem ? (
            <p className={themeSystem.flash("warning")}>{t(`puzzleStudio.problem.${problem}`)}</p>
          ) : tiles.length ? (
            <div className="flex flex-wrap items-center gap-3">
              <WordTiles tiles={tiles} lang={lang} size={44} />
              <span className="text-sm font-bold text-muted">{t(lang === "km" ? "puzzleStudio.tilesCount" : "puzzleStudio.lettersCount", { n: String(tiles.length) })}</span>
            </div>
          ) : (
            <p className="text-sm text-muted">{t(lang === "km" ? "puzzleStudio.wordHelpKm" : "puzzleStudio.wordHelpEn")}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="ps-cat">
            {t("puzzleStudio.category")}
          </label>
          <UISelect id="ps-cat" value={category} onChange={(e) => setCategory(e.target.value as PuzzleCategory)}>
            {PUZZLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`puzzles.category.${c}`)}
              </option>
            ))}
          </UISelect>
        </div>
        <div>
          <label className={label} htmlFor="ps-en">
            {t(lang === "km" ? "puzzleStudio.meaningEn" : "puzzleStudio.clueEn")}
          </label>
          <UIInput id="ps-en" value={clueEn} maxLength={120} onChange={(e) => setClueEn(e.target.value)} placeholder={lang === "km" ? "cat" : t("puzzleStudio.clueEnExample")} />
        </div>
        <div>
          <label className={label} htmlFor="ps-km">
            {t("puzzleStudio.clueKm")}
          </label>
          <UIInput id="ps-km" value={clueKm} maxLength={120} onChange={(e) => setClueKm(e.target.value)} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted">{t("puzzleStudio.clueHelp")}</p>

      <div className="flex flex-wrap items-end gap-3">
        {picture ? (
          <WordPicture id={picture} label={picture.replace(/^rebus-/, "")} size={72} />
        ) : (
          <span className="grid h-[72px] w-[72px] place-items-center rounded-2xl border-2 border-dashed border-line text-xs font-bold text-muted">{t("puzzleStudio.noPicture")}</span>
        )}
        <div className="min-w-[12rem] flex-1">
          <label className={label} htmlFor="ps-pic">
            {t("puzzleStudio.picture")}
          </label>
          <UISelect id="ps-pic" value={picture} onChange={(e) => setPictureChoice(e.target.value)}>
            <option value="">{t("puzzleStudio.noPicture")}</option>
            {PICTURE_NAMES.map((n) => (
              <option key={n} value={`rebus-${n}`}>
                {n}
              </option>
            ))}
          </UISelect>
          <p className="mt-1 text-xs text-muted">{t("puzzleStudio.pictureHelp")}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      {saved && <p className={themeSystem.flash("success")}>{saved}</p>}

      <div className="flex flex-wrap gap-2">
        {canRun ? (
          <UIButton type="submit" icon={<Rocket />} isLoading={busy} disabled={!tiles.length}>
            {editing && editing.status === "published" ? t("puzzleStudio.saveLive") : t("puzzleStudio.publish")}
          </UIButton>
        ) : (
          <UIButton type="submit" icon={<Send />} isLoading={busy} disabled={!tiles.length}>
            {t("puzzleStudio.sendReview")}
          </UIButton>
        )}
        {!(editing && editing.status === "published") && (
          <UIButton type="button" variant="outline" icon={<Save />} disabled={busy || !word.trim()} onClick={() => void save("draft")}>
            {t("puzzleStudio.saveDraft")}
          </UIButton>
        )}
        {onCancel && (
          <UIButton type="button" variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </UIButton>
        )}
      </div>
    </form>
  );
};
