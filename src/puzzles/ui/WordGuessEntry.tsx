import React, { useSyncExternalStore } from "react";
import { Check, Flame, Play } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge } from "../../components/ui";
import { puzzleDay } from "../day";
import { liveStreak, readPlay } from "../playStore";
import { dailySnapshot, subscribeDaily } from "../store";
import { WordTiles } from "./WordTiles";

/** The Word Guess card on the Think shelf: what it is, whether today's word is done, and one Play. */
export const WordGuessEntry: React.FC<{ onOpen(): void }> = ({ onOpen }) => {
  const { t } = useT();
  useSyncExternalStore(subscribeDaily, dailySnapshot, dailySnapshot);
  const today = puzzleDay();
  const play = readPlay();
  const doneToday = Object.entries(play.daily).some(([k, g]) => k.endsWith(`|${today}`) && g.over);
  const streak = liveStreak(play.streak, today);
  const label = (
    <>
      <Play className="fill-current" aria-hidden="true" />
      {doneToday ? t("wordGuess.practice") : t("common.play")}
    </>
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${t("wordGuess.title")}. ${t("wordGuess.entryText")}`}
      className={themeSystem.card("interactive", "group w-full p-4 text-left")}
    >
      <span className="flex items-center gap-4">
        <span className="shrink-0 transition-transform group-hover:-rotate-3" aria-hidden>
          <WordTiles tiles={["W", "O", "R", "D"]} lang="en" result={["correct", "present", "absent", "correct"]} size={28} marks={false} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-ink">{t("wordGuess.title")}</span>
            {doneToday ? (
              <UIBadge variant="success">
                <Check className="mr-1 inline h-3 w-3" aria-hidden />
                {t("wordGuess.doneToday")}
              </UIBadge>
            ) : (
              <UIBadge variant="primary">{t("wordGuess.newToday")}</UIBadge>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-body">{t("wordGuess.entryText")}</span>
          {streak > 0 && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <Flame className="h-3.5 w-3.5" aria-hidden /> {t("wordGuess.streak", { n: String(streak) })}
            </span>
          )}
        </span>
        <span className="hidden shrink-0 sm:block">
          <span className={`${themeSystem.button("primary", "md")} pointer-events-none`}>{label}</span>
        </span>
      </span>
      <span className="mt-3 block sm:hidden">
        <span className={`${themeSystem.button("primary", "md")} pointer-events-none w-full`}>{label}</span>
      </span>
    </button>
  );
};
