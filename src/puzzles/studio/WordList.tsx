import React, { useCallback, useEffect, useState } from "react";
import { WordPicture } from "../ui/WordPicture";
import { Archive, Pencil, RotateCcw, Rocket, Send, Trash2, Undo2 } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton, UISearchInput, UISelect } from "../../components/ui";
import { useStudioAction } from "../../rebus/studio/useStudioAction";
import type { PuzzleStatus } from "../types";
import { CategoryIcon } from "../ui/categoryIcon";
import { WordTiles } from "../ui/WordTiles";
import { WordForm } from "./WordForm";
import { PuzzleStudioAPI, type StudioWord } from "./studioApi";

const BADGE: Record<PuzzleStatus, "success" | "primary" | "info" | "neutral"> = {
  published: "success",
  review: "info",
  draft: "primary",
  retired: "neutral",
};

/** Every word, filterable, each with the one or two actions that fit where it stands. */
export const WordList: React.FC<{ canRun: boolean; initialStatus?: PuzzleStatus | ""; onChanged(): void }> = ({ canRun, initialStatus = "", onChanged }) => {
  const { t } = useT();
  const [lang, setLang] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState<string>(initialStatus);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<StudioWord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const { busy, error, run } = useStudioAction();

  const load = useCallback(async () => {
    const res = await PuzzleStudioAPI.list({ lang, level: level ? Number(level) : undefined, status, q });
    setRows(res.puzzles);
    setTotal(res.total);
  }, [lang, level, status, q]);

  useEffect(() => {
    const id = setTimeout(() => void run(load), q ? 250 : 0);
    return () => clearTimeout(id);
  }, [load, run, q]);

  const act = async (fn: () => Promise<unknown>) => {
    if (await run(fn)) {
      await run(load);
      onChanged();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid items-end gap-2 sm:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="sm:col-span-3 lg:col-span-1">
          <UISearchInput label={t("puzzleStudio.search")} placeholder={t("puzzleStudio.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <UISelect aria-label={t("puzzleStudio.language")} value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="">{t("puzzleStudio.allLanguages")}</option>
          <option value="km">ខ្មែរ</option>
          <option value="en">English</option>
        </UISelect>
        <UISelect aria-label={t("puzzleStudio.length")} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">{t("puzzleStudio.allLengths")}</option>
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {t("puzzleStudio.nTiles", { n: String(n) })}
            </option>
          ))}
        </UISelect>
        <UISelect aria-label={t("puzzleStudio.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("puzzleStudio.allStatuses")}</option>
          {(["published", "review", "draft", "retired"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`puzzleStudio.statusName.${s}`)}
            </option>
          ))}
        </UISelect>
      </div>

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}

      {rows === null ? (
        <p className="text-sm text-muted">{t("puzzleStudio.loading")}</p>
      ) : rows.length === 0 ? (
        <p className={themeSystem.card("default", "p-6 text-center text-body")}>{t("puzzleStudio.noneFound")}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-muted">{t("puzzleStudio.shown", { n: String(rows.length), total: String(total) })}</p>
          <ul className="space-y-2">
            {rows.map((w) =>
              editing === w.id ? (
                <li key={w.id}>
                  <WordForm
                    canRun={canRun}
                    editing={w}
                    onCancel={() => setEditing(null)}
                    onSaved={() => {
                      setEditing(null);
                      void run(load);
                      onChanged();
                    }}
                  />
                </li>
              ) : (
                <li key={w.id} className={themeSystem.card("default", "flex flex-wrap items-center gap-3 p-3")}>
                  {w.data.picture ? (
                    <WordPicture id={w.data.picture} label={w.data.word} size={44} />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                      <CategoryIcon category={w.data.category} className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xl font-black text-ink ${w.lang === "en" ? "uppercase" : ""}`}>{w.data.word}</span>
                      <UIBadge variant={BADGE[w.status]}>{t(`puzzleStudio.statusName.${w.status}`)}</UIBadge>
                      <span className="text-xs font-bold text-muted">
                        {w.lang === "km" ? "ខ្មែរ" : "English"} · {t("puzzleStudio.nTiles", { n: String(w.level) })} · {t(`puzzles.category.${w.data.category}`)}
                      </span>
                    </div>
                    <div className="truncate text-sm text-body">{[w.data.clue.en, w.data.clue.km].filter(Boolean).join(" · ") || t("puzzleStudio.noClue")}</div>
                    {w.createdByName && w.owner === "creator" && <div className="text-xs text-muted">{t("puzzleStudio.by", { name: w.createdByName })}</div>}
                    {w.issues.length > 0 && <div className="text-xs font-bold text-rose-600 dark:text-rose-400">{w.issues.map((c) => t(`puzzleStudio.problem.${c}`)).join(" ")}</div>}
                  </div>
                  <div className="hidden sm:block">
                    <WordTiles tiles={w.data.tiles} lang={w.lang} size={30} />
                  </div>
                  <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                    {(canRun || !["published", "retired"].includes(w.status)) && (
                      <UIButton size="sm" variant="ghost" icon={<Pencil />} onClick={() => setEditing(w.id)}>
                        {t("puzzleStudio.edit")}
                      </UIButton>
                    )}
                    {w.status === "draft" && !canRun && (
                      <UIButton size="sm" variant="outline" icon={<Send />} disabled={busy} onClick={() => void act(() => PuzzleStudioAPI.status(w.id, "review"))}>
                        {t("puzzleStudio.sendReview")}
                      </UIButton>
                    )}
                    {w.status === "review" && !canRun && (
                      <UIButton size="sm" variant="ghost" icon={<Undo2 />} disabled={busy} onClick={() => void act(() => PuzzleStudioAPI.status(w.id, "draft"))}>
                        {t("puzzleStudio.backToDraft")}
                      </UIButton>
                    )}
                    {canRun && (w.status === "draft" || w.status === "review") && (
                      <UIButton size="sm" icon={<Rocket />} disabled={busy || w.issues.length > 0} onClick={() => void act(() => PuzzleStudioAPI.status(w.id, "published"))}>
                        {t("puzzleStudio.publish")}
                      </UIButton>
                    )}
                    {canRun && w.status === "review" && (
                      <UIButton size="sm" variant="ghost" icon={<Undo2 />} disabled={busy} onClick={() => void act(() => PuzzleStudioAPI.status(w.id, "draft"))}>
                        {t("puzzleStudio.sendBack")}
                      </UIButton>
                    )}
                    {canRun && w.status === "published" && (
                      <UIButton size="sm" variant="outline" icon={<Archive />} disabled={busy} onClick={() => void act(() => PuzzleStudioAPI.status(w.id, "retired"))}>
                        {t("puzzleStudio.retire")}
                      </UIButton>
                    )}
                    {canRun && w.status === "retired" && (
                      <UIButton size="sm" variant="outline" icon={<RotateCcw />} disabled={busy} onClick={() => void act(() => PuzzleStudioAPI.status(w.id, "published"))}>
                        {t("puzzleStudio.bringBack")}
                      </UIButton>
                    )}
                    {(w.status === "draft" || w.status === "review") && (
                      <UIButton size="sm" variant="ghost" icon={<Trash2 />} disabled={busy} onClick={() => void act(() => PuzzleStudioAPI.remove(w.id))}>
                        {t("puzzleStudio.delete")}
                      </UIButton>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </div>
  );
};
