import React from "react";
import { Check, MoveHorizontal } from "lucide-react";
import { useT } from "../../lib/i18n";
import type { PuzzleLang } from "../types";
import { tileLabel, type TileState } from "../wordGuess";

/**
 * One row of letter tiles.
 *
 * Colour is never the only signal: a right tile also carries a tick and a tile
 * in the wrong place a two-way arrow, so a child who cannot tell green from
 * violet — and a grandparent reading over their shoulder — still can.
 */

export const TILE_TONE: Record<TileState, string> = {
  correct: "bg-emerald-500 text-white border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600",
  present: "bg-violet-500 text-white border-violet-500 dark:bg-violet-600 dark:border-violet-600",
  absent: "bg-slate-400 text-white border-slate-400 dark:bg-slate-600 dark:border-slate-600",
};

const MARK: Record<TileState, React.ReactNode> = {
  correct: <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />,
  present: <MoveHorizontal className="h-3 w-3" strokeWidth={3} aria-hidden />,
  absent: null,
};

export interface WordTilesProps {
  tiles: readonly (string | undefined)[];
  lang: PuzzleLang;
  /** Colours after a guess is checked; none while typing. */
  result?: readonly TileState[];
  /** Side of one tile, in px. */
  size?: number;
  /** Turn each tile over in order, as the guess is checked. */
  reveal?: boolean;
  /** The row the child is typing in. */
  active?: boolean;
  shake?: boolean;
  /** The tick and arrow on checked tiles. Off for a tiny decorative row. */
  marks?: boolean;
}

export const WordTiles: React.FC<WordTilesProps> = ({ tiles, lang, result, size = 52, reveal = false, active = false, shake = false, marks = true }) => {
  const { t } = useT();
  return (
    <div className={`flex justify-center gap-1.5 ${shake ? "animate-[wg-shake_0.3s]" : ""}`} role="group">
      {tiles.map((tile, i) => {
        const state = result?.[i];
        const filled = Boolean(tile);
        const tone = state
          ? TILE_TONE[state]
          : filled
            ? "bg-surface text-ink border-muted"
            : active
              ? "bg-surface text-ink border-indigo-200 dark:border-indigo-800"
              : "bg-surface text-ink border-line";
        const said = tile ? `${tile}${state ? `, ${t(`wordGuess.state.${state}`)}` : ""}` : t("wordGuess.emptyTile");
        return (
          <div
            key={i}
            aria-label={said}
            style={{ width: size, height: size, fontSize: lang === "km" ? size * 0.42 : size * 0.48, animationDelay: reveal ? `${i * 120}ms` : undefined }}
            className={`relative grid place-items-center rounded-xl border-2 font-black leading-none select-none motion-safe:transition-colors ${tone} ${
              reveal ? "motion-safe:animate-[wg-flip_0.45s_ease_both]" : filled && !state ? "motion-safe:animate-[wg-pop_0.12s_ease-out]" : ""
            } ${lang === "km" ? "" : "uppercase"}`}
          >
            {tile ? tileLabel(tile, lang) : ""}
            {marks && state && MARK[state] ? <span className="absolute right-1 top-1 opacity-90">{MARK[state]}</span> : null}
          </div>
        );
      })}
    </div>
  );
};

/** The keyframes the tiles use, once per page. */
export const WordTileStyles: React.FC = () => (
  <style>{`
@keyframes wg-pop { 50% { transform: scale(1.08); } }
@keyframes wg-flip { 0% { transform: rotateX(0); } 50% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }
@keyframes wg-shake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
`}</style>
);
