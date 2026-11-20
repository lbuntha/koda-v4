import React, { useState } from "react";
import { WordPicture } from "./WordPicture";
import { ArrowRight, Copy, Flame, PartyPopper, Star } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { liveStreak, readPlay, type GameRecord } from "../playStore";
import type { DailyPuzzle } from "../types";
import { MAX_GUESSES, tileLabel, tilesOf } from "../wordGuess";

/**
 * The end of a game: the word, what it means, how it went, and one thing to do next.
 *
 * The share text never holds the answer — only the coloured grid — so a friend
 * who has not played yet still can. Squares, not emoji: Koda draws its own art.
 */

export function shareText(puzzle: DailyPuzzle, game: GameRecord, day: string): string {
  const grid = game.rows.map((r) => r.result.map((s) => (s === "correct" ? "■" : s === "present" ? "◩" : "□")).join("")).join("\n");
  const lang = puzzle.lang === "km" ? "ខ្មែរ" : "English";
  const score = game.won ? `${game.rows.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  return `Koda Word Guess · ${lang} · ${day}\n${score}${game.hints ? ` · hint ${game.hints}` : ""}\n${grid}`;
}

export const WordGuessResult: React.FC<{ puzzle: DailyPuzzle; game: GameRecord; daily: boolean; day: string; xp: number; onNext(): void }> = ({
  puzzle,
  game,
  daily,
  day,
  xp,
  onNext,
}) => {
  const { t } = useT();
  const [copied, setCopied] = useState<"" | "yes" | "show">("");
  const tiles = tilesOf(puzzle.data.word, puzzle.lang);
  const streak = liveStreak(readPlay().streak, day);
  const cheers = ["wordGuess.win1", "wordGuess.win2", "wordGuess.win3", "wordGuess.win4", "wordGuess.win5", "wordGuess.win6"];
  const title = game.won ? t(cheers[Math.min(game.rows.length, MAX_GUESSES) - 1]) : t("wordGuess.lose");
  /* Both languages after the game: the English meaning or clue, then the Khmer one. */
  const { en, km } = puzzle.data.clue;
  const lines = [en ? (puzzle.lang === "km" ? t("wordGuess.means", { word: en }) : en) : "", km].filter(Boolean);

  const copy = async () => {
    const text = shareText(puzzle, game, day);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      setCopied("show");
    }
  };

  return (
    <section ref={(el) => el?.scrollIntoView?.({ behavior: "smooth", block: "nearest" })} className={themeSystem.card("default", "space-y-4 p-5 text-center")} aria-live="polite">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
        {game.won ? <PartyPopper className="h-7 w-7" aria-hidden /> : <Star className="h-7 w-7" aria-hidden />}
      </div>
      <h3 className="text-2xl font-black text-ink">{title}</h3>
      {puzzle.data.picture && (
        <div className="flex justify-center">
          <WordPicture id={puzzle.data.picture} label={puzzle.data.word} size={96} />
        </div>
      )}

      <div className="space-y-1">
        <div className="text-sm font-bold text-muted">{t("wordGuess.theWordWas")}</div>
        <div className={`text-4xl font-black text-ink ${puzzle.lang === "en" ? "uppercase tracking-wide" : ""}`}>{puzzle.data.word}</div>
        {lines.map((line) => (
          <div key={line} className="text-sm font-bold text-body">
            {line}
          </div>
        ))}
        {puzzle.lang === "km" && <div className="text-sm text-muted">{t("wordGuess.spelled", { tiles: tiles.map((x) => tileLabel(x, "km")).join(" + ") })}</div>}
      </div>

      <div className="flex flex-wrap justify-center gap-2 text-sm font-black">
        <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
          {game.won ? (game.rows.length === 1 ? t("wordGuess.inOneTry") : t("wordGuess.inTries", { n: String(game.rows.length) })) : t("wordGuess.notThisTime")}
        </span>
        {xp > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">+{xp} XP</span>}
        {daily && streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <Flame className="h-4 w-4" aria-hidden /> {t("wordGuess.streak", { n: String(streak) })}
          </span>
        )}
      </div>

      <div className="mx-auto inline-grid gap-1" aria-label={t("wordGuess.yourGrid")}>
        {game.rows.map((r, i) => (
          <div key={i} className="flex justify-center gap-1">
            {r.result.map((s, j) => (
              <span
                key={j}
                className={`h-4 w-4 rounded ${s === "correct" ? "bg-emerald-500" : s === "present" ? "bg-violet-500" : "bg-slate-300 dark:bg-slate-600"}`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {daily && (
          <UIButton variant="outline" size="lg" icon={<Copy />} onClick={() => void copy()}>
            {t("wordGuess.share")}
          </UIButton>
        )}
        <UIButton size="lg" iconRight={<ArrowRight />} onClick={onNext} className={daily ? "" : "sm:col-span-2"}>
          {daily ? t("wordGuess.playMore") : t("wordGuess.nextWord")}
        </UIButton>
      </div>
      {copied === "yes" && <p className="text-xs font-semibold text-muted">{t("wordGuess.copied")}</p>}
      {copied === "show" && <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-left text-xs dark:bg-slate-900/40">{shareText(puzzle, game, day)}</pre>}
      {daily && <p className="text-xs font-semibold text-muted">{t("wordGuess.comeBack")}</p>}
    </section>
  );
};
