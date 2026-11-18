/**
 * The Rebus Rush card on the Think shelf: the door into the game.
 *
 * The featured game, drawn with the same card, badge and button as the rest of
 * the app so it looks like part of it: the game's own mark, what it is in one
 * line, how much there is to play, and one Play. The whole card is the control,
 * so a child who taps anywhere on it gets in.
 *
 * The numbers come from the puzzles already on this device. Nothing here asks
 * the network: opening the game refreshes the list, and a Learn page should
 * never wait on it.
 */

import React, { useMemo, useSyncExternalStore } from "react";
import { Play } from "lucide-react";
import { formatCompact, useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge } from "../../components/ui";
import { bankSnapshot, subscribeBank } from "../bankStore";
import { loadResults } from "../resultsStore";
import { RebusMark } from "./RebusMark";

export const RebusEntry: React.FC<{ onOpen(): void }> = ({ onOpen }) => {
  const { t, language } = useT();
  const snap = useSyncExternalStore(subscribeBank, bankSnapshot, bankSnapshot);

  const stats = useMemo(() => {
    const puzzles = snap?.puzzles ?? [];
    if (!puzzles.length) return [];
    const results = loadResults();
    const played = puzzles.reduce((n, p) => n + (results[p.id] ? 1 : 0), 0);
    const topics = new Set(puzzles.map((p) => p.category)).size;
    return [
      t("rebus.entryPuzzles", { count: puzzles.length, shown: formatCompact(puzzles.length, language) }),
      t("rebus.entryTopics", { count: topics }),
      ...(played > 0 ? [t("rebus.entryPlayed", { count: played, shown: formatCompact(played, language) })] : []),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, language]);

  const play = (
    <>
      <Play className="fill-current" aria-hidden="true" />
      {t("common.play")}
    </>
  );

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${t("rebus.entryTitle")}. ${t("rebus.entryText")}`}
      className={themeSystem.card("interactive", "group w-full p-4 text-left")}
    >
      <span className="flex items-center gap-4">
        <RebusMark size={56} className="shrink-0 transition-transform group-hover:-rotate-3" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-lg font-black text-ink">{t("rebus.entryTitle")}</span>
            <UIBadge variant="primary">{t("rebus.new")}</UIBadge>
          </span>
          <span className="mt-0.5 block text-sm text-body">{t("rebus.entryText")}</span>
          {stats.length > 0 && (
            <span className="mt-1.5 block text-xs font-semibold text-muted">{stats.join(" · ")}</span>
          )}
        </span>
        {/* Spans, not nested buttons: the whole card is the control. */}
        <span className="hidden shrink-0 sm:block">
          <span className={`${themeSystem.button("primary", "md")} pointer-events-none`}>{play}</span>
        </span>
      </span>
      {/* On a phone, Play takes its own row: the biggest thing to tap. */}
      <span className="mt-3 block sm:hidden">
        <span className={`${themeSystem.button("primary", "md")} pointer-events-none w-full`}>{play}</span>
      </span>
    </button>
  );
};
