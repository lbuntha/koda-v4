import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, Lock, Sparkles } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UISelect } from "../../components/ui";
import { useStudioAction } from "../../rebus/studio/useStudioAction";
import { WordTiles } from "../ui/WordTiles";
import { PuzzleStudioAPI, type CalendarDay, type Line, type StudioWord } from "./studioApi";

/** Fewer new words than this on a line, and the Studio says so: about two weeks' warning. */
export const LOW_DAYS = 14;

/**
 * The next four weeks on one line: which word each day has, and whether it was
 * chosen by a person or picked by Koda. The owner can choose any day from
 * tomorrow; today is fixed because children may already be playing it.
 */
export const CalendarPanel: React.FC<{ lines: Line[]; canRun: boolean; onChanged(): void }> = ({ lines, canRun, onChanged }) => {
  const { t, language } = useT();
  const [slot, setSlot] = useState(lines[0]?.slot ?? "word-guess:km:3");
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [today, setToday] = useState("");
  const [left, setLeft] = useState(0);
  const [live, setLive] = useState<StudioWord[]>([]);
  const { busy, error, run } = useStudioAction();
  const [, lang, level] = slot.split(":");

  const load = useCallback(async () => {
    const [cal, words] = await Promise.all([
      PuzzleStudioAPI.calendar(slot, 28),
      PuzzleStudioAPI.list({ lang, level: Number(level), status: "published" }),
    ]);
    setDays(cal.days);
    setToday(cal.today);
    setLeft(cal.newDaysLeft);
    setLive(words.puzzles);
  }, [slot, lang, level]);

  useEffect(() => {
    void run(load);
  }, [load, run]);

  const dateLabel = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(language === "km" ? "km-KH" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-bold text-ink" htmlFor="ps-line">
          {t("puzzleStudio.line")}
        </label>
        <UISelect id="ps-line" value={slot} onChange={(e) => setSlot(e.target.value)} className="w-auto">
          {lines.map((l) => (
            <option key={l.slot} value={l.slot}>
              {l.lang === "km" ? "ខ្មែរ" : "English"} · {t("puzzleStudio.nTiles", { n: String(l.level) })}
            </option>
          ))}
        </UISelect>
      </div>

      {days && (
        <p className={themeSystem.flash(left < LOW_DAYS ? "warning" : "info")}>
          {left < LOW_DAYS ? t("puzzleStudio.lowDays", { n: String(left) }) : t("puzzleStudio.daysLeft", { n: String(left) })}
        </p>
      )}
      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}

      {days === null ? (
        <p className="text-sm text-muted">{t("puzzleStudio.loading")}</p>
      ) : (
        <ul className="space-y-2">
          {days.map((d) => {
            const isToday = d.day === today;
            const locked = d.day <= today;
            return (
              <li key={d.day} className={themeSystem.card("default", `flex flex-wrap items-center gap-3 p-3 ${isToday ? "ring-2 ring-indigo-400" : ""}`)}>
                <div className="w-28 shrink-0">
                  <div className="font-black text-ink">{dateLabel(d.day)}</div>
                  <div className="text-xs font-bold text-muted">
                    {isToday ? t("puzzleStudio.today") : d.pinned ? t("puzzleStudio.chosen") : t("puzzleStudio.kodaPick")}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {d.puzzle ? (
                    <>
                      <span className={`text-lg font-black text-ink ${d.puzzle.lang === "en" ? "uppercase" : ""}`}>{d.puzzle.data.word}</span>
                      <span className="hidden sm:inline">
                        <WordTiles tiles={d.puzzle.data.tiles} lang={d.puzzle.lang} size={26} />
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </div>
                {locked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-muted">
                    <Lock className="h-3.5 w-3.5" aria-hidden /> {t("puzzleStudio.fixed")}
                  </span>
                ) : canRun ? (
                  <UISelect
                    aria-label={t("puzzleStudio.chooseFor", { day: dateLabel(d.day) })}
                    value={d.pinned ? d.puzzleId : ""}
                    disabled={busy}
                    className="w-full sm:w-48"
                    onChange={(e) =>
                      void run(async () => {
                        await PuzzleStudioAPI.pin(slot, d.day, e.target.value || null);
                        await load();
                        onChanged();
                      })
                    }
                  >
                    <option value="">{t("puzzleStudio.letKodaPick")}</option>
                    {live.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.data.word}
                        {w.data.clue.en ? ` · ${w.data.clue.en}` : ""}
                      </option>
                    ))}
                  </UISelect>
                ) : d.pinned ? (
                  <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4 text-muted" aria-hidden />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
