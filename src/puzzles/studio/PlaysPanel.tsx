/**
 * Plays: how Word Guess is going, for the adults behind it.
 *
 * Read on a phone by a busy owner or teacher, so the answer comes first — how
 * many games, how many children, how many solved — then two short lists to scan:
 * the children (tap one to see their games) and the hardest words (the ones to
 * fix). A teacher sees only their own words and never a child.
 */

import React, { useEffect, useState } from "react";
import { ArrowLeft, BookOpenCheck, ChevronRight, Gamepad2, Lightbulb, Target, Users } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIAvatar, UIBadge, UIButton, UISectionHeader, UIStatGrid, UIStatTile } from "../../components/ui";
import { messageOf } from "../../rebus/studio/useStudioAction";
import { WordPicture } from "../ui/WordPicture";
import { PuzzleStudioAPI, type PlayChild, type PlayGame, type Plays } from "./studioApi";

const PERIODS = [1, 7, 30] as const;

export const PlaysPanel: React.FC<{ today: string }> = ({ today }) => {
  const { t } = useT();
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<Plays | null>(null);
  const [error, setError] = useState("");
  const [child, setChild] = useState<PlayChild | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    PuzzleStudioAPI.plays(days)
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(messageOf(e)));
    return () => {
      live = false;
    };
  }, [days]);

  if (child) return <ChildPlays child={child} today={today} onBack={() => setChild(null)} />;

  return (
    <div className="space-y-5">
      <Periods days={days} onDays={setDays} />
      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      {!data ? (
        <p className="text-sm text-muted">{t("puzzleStudio.loading")}</p>
      ) : data.totals.games === 0 ? (
        <div className={themeSystem.card("default", "p-6 text-center")}>
          <Gamepad2 className="mx-auto h-8 w-8 text-indigo-500" aria-hidden />
          <p className="mt-2 font-bold text-ink">{t("puzzleStudio.plays.none")}</p>
          <p className="text-sm text-muted">{t(data.canSeeChildren ? "puzzleStudio.plays.noneHelp" : "puzzleStudio.plays.noneMine")}</p>
        </div>
      ) : (
        <>
          <UIStatGrid>
            <UIStatTile icon={<Gamepad2 />} value={data.totals.games} label={t("puzzleStudio.plays.games")} tone="primary" />
            {data.canSeeChildren && (
              <UIStatTile icon={<Users />} value={data.totals.children} label={t("puzzleStudio.plays.children")} tone="primary" />
            )}
            <UIStatTile icon={<Target />} value={`${data.totals.solvedPct}%`} label={t("puzzleStudio.plays.solved")} tone="success" />
          </UIStatGrid>

          {data.canSeeChildren && (
            <section className="space-y-2">
              <UISectionHeader title={t("puzzleStudio.plays.childrenTitle")} subtitle={t("puzzleStudio.plays.childrenHelp")} />
              <ul className="space-y-2">
                {data.children.map((c) => (
                  <li key={c.learnerId}>
                    <button
                      type="button"
                      onClick={() => setChild(c)}
                      className={themeSystem.card(
                        "default",
                        "flex w-full items-center gap-3 p-3 text-left transition hover:border-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      )}
                    >
                      <UIAvatar name={c.name || "?"} seed={c.avatarSeed} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-black text-ink">
                          {c.name || t("puzzleStudio.plays.unnamed")}
                          {ageOf(c, today) !== null && (
                            <span className="font-semibold text-muted">
                              {" "}
                              · {t("puzzleStudio.plays.age", { n: String(ageOf(c, today)) })}
                            </span>
                          )}
                        </span>
                        <span className="block text-sm text-body">
                          {t("puzzleStudio.plays.childLine", { games: String(c.games) })} · {dayLabel(c.lastDay, today, t)}
                        </span>
                      </span>
                      <SolvedBar pct={c.solvedPct} />
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <UISectionHeader title={t("puzzleStudio.plays.wordsTitle")} subtitle={t("puzzleStudio.plays.wordsHelp")} />
            <ul className="space-y-2">
              {data.words.slice(0, 30).map((w) => (
                <li key={`${w.lang}:${w.word}`} className={themeSystem.card("default", "flex items-center gap-3 p-3")}>
                  {w.picture ? (
                    <WordPicture id={w.picture} label={w.word} size={40} />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                      <BookOpenCheck className="h-5 w-5" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-lg font-black text-ink ${w.lang === "en" ? "uppercase" : ""}`}>{w.word}</span>
                    <span className="block text-sm text-body">
                      {t("puzzleStudio.plays.wordLine", { played: String(w.played), guesses: String(w.avgGuesses) })}
                      {w.hints > 0 &&
                        ` · ${t(w.hints === 1 ? "puzzleStudio.plays.hint1" : "puzzleStudio.plays.hints", { n: String(w.hints) })}`}
                    </span>
                  </span>
                  <SolvedBar pct={w.solvedPct} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
};

const ChildPlays: React.FC<{ child: PlayChild; today: string; onBack(): void }> = ({ child, today, onBack }) => {
  const { t } = useT();
  const [days, setDays] = useState<number>(30);
  const [games, setGames] = useState<PlayGame[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setGames(null);
    PuzzleStudioAPI.childPlays(child.learnerId, days)
      .then((d) => live && setGames(d.games))
      .catch((e: unknown) => live && setError(messageOf(e)));
    return () => {
      live = false;
    };
  }, [child.learnerId, days]);

  const solved = games?.filter((g) => g.solved) ?? [];
  const words = new Set(solved.map((g) => `${g.lang}:${g.word}`)).size;
  const byDay = groupByDay(games ?? []);
  const age = ageOf(child, today);

  return (
    <div ref={(el) => el?.scrollIntoView?.({ block: "start" })} className="scroll-mt-20 space-y-5">
      <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
        {t("puzzleStudio.plays.allChildren")}
      </UIButton>
      <div className="flex items-center gap-3">
        <UIAvatar name={child.name || "?"} seed={child.avatarSeed} size="lg" />
        <div className="min-w-0">
          <h3 className="truncate text-xl font-black text-ink">{child.name || t("puzzleStudio.plays.unnamed")}</h3>
          {age !== null && <p className="text-sm text-muted">{t("puzzleStudio.plays.age", { n: String(age) })}</p>}
        </div>
      </div>
      <Periods days={days} onDays={setDays} />
      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      {!games ? (
        <p className="text-sm text-muted">{t("puzzleStudio.loading")}</p>
      ) : games.length === 0 ? (
        <p className={themeSystem.card("default", "p-6 text-center text-body")}>{t("puzzleStudio.plays.none")}</p>
      ) : (
        <>
          <UIStatGrid>
            <UIStatTile icon={<Gamepad2 />} value={games.length} label={t("puzzleStudio.plays.games")} tone="primary" />
            <UIStatTile
              icon={<Target />}
              value={`${Math.round((100 * solved.length) / games.length)}%`}
              label={t("puzzleStudio.plays.solved")}
              tone="success"
            />
            <UIStatTile icon={<BookOpenCheck />} value={words} label={t("puzzleStudio.plays.wordsSpelled")} tone="success" />
          </UIStatGrid>
          {byDay.map(([day, list]) => (
            <section key={day} className="space-y-2">
              <h4 className="text-sm font-black uppercase tracking-wide text-muted">{dayLabel(day, today, t)}</h4>
              <ul className="space-y-2">
                {list.map((g, i) => (
                  <li key={`${g.ts}:${i}`} className={themeSystem.card("default", "flex items-center gap-3 p-3")}>
                    {g.picture ? (
                      <WordPicture id={g.picture} label={g.word} size={40} />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                        <BookOpenCheck className="h-5 w-5" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-lg font-black text-ink ${g.lang === "en" ? "uppercase" : ""}`}>{g.word}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-sm text-body">
                        {g.solved ? t("puzzleStudio.plays.solvedIn", { n: String(g.guesses) }) : t("puzzleStudio.plays.notSolved")}
                        {g.hints > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-muted">
                            · <Lightbulb className="h-3.5 w-3.5" aria-hidden /> {g.hints}
                          </span>
                        )}
                      </span>
                    </span>
                    <UIBadge variant={g.practice ? "neutral" : "primary"}>
                      {t(g.practice ? "puzzleStudio.plays.practice" : "puzzleStudio.plays.daily")}
                    </UIBadge>
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full ${g.solved ? "bg-emerald-500" : "bg-rose-400"}`}
                      aria-label={g.solved ? t("puzzleStudio.plays.solved") : t("puzzleStudio.plays.notSolved")}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
};

const Periods: React.FC<{ days: number; onDays(n: number): void }> = ({ days, onDays }) => {
  const { t } = useT();
  return (
    <div role="group" aria-label={t("puzzleStudio.plays.period")} className="inline-flex rounded-full border border-line bg-surface p-1">
      {PERIODS.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={days === n}
          onClick={() => onDays(n)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            days === n ? "bg-indigo-600 text-white" : "text-body hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
          }`}
        >
          {n === 1 ? t("puzzleStudio.plays.today") : t("puzzleStudio.plays.lastDays", { n: String(n) })}
        </button>
      ))}
    </div>
  );
};

/** A small solved meter: green for how much was solved, the rest rose. The number sits beside it, so colour is never the only signal. */
const SolvedBar: React.FC<{ pct: number }> = ({ pct }) => {
  const { t } = useT();
  const tone =
    pct >= 70
      ? "text-emerald-700 dark:text-emerald-300"
      : pct >= 40
        ? "text-indigo-700 dark:text-indigo-300"
        : "text-rose-700 dark:text-rose-300";
  return (
    <span className="flex shrink-0 flex-col items-end">
      <span className={`text-lg font-black leading-none ${tone}`}>{pct}%</span>
      <span className="text-[11px] font-bold text-muted">{t("puzzleStudio.plays.solvedShort")}</span>
    </span>
  );
};

const ageOf = (c: PlayChild, today: string): number | null => (c.birthYear ? Number(today.slice(0, 4)) - c.birthYear : null);

function dayLabel(day: string, today: string, t: (k: string, v?: Record<string, string>) => string): string {
  if (!day) return "";
  const diff = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  if (diff === 0) return t("puzzleStudio.plays.today");
  if (diff === 1) return t("puzzleStudio.plays.yesterday");
  return t("puzzleStudio.plays.daysAgo", { n: String(diff) });
}

function groupByDay(games: PlayGame[]): Array<[string, PlayGame[]]> {
  const out = new Map<string, PlayGame[]>();
  for (const g of games) out.set(g.day, [...(out.get(g.day) ?? []), g]);
  return [...out.entries()];
}
