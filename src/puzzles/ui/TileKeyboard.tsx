import React, { useState } from "react";
import { CornerDownLeft, Delete } from "lucide-react";
import { useT } from "../../lib/i18n";
import { makeRng } from "../../rebus/rng";
import type { PuzzleLang } from "../types";
import { tileLabel, type TileState } from "../wordGuess";
import { TILE_TONE } from "./WordTiles";

/**
 * The keys a child guesses with.
 *
 * Two ways in. **Easy tiles** shows only about ten: the word's own tiles and a
 * few that do not belong — enough to think about, few enough for a six-year-old
 * who cannot yet find ្ម among sixty keys. **All letters** is the real thing:
 * English as a keyboard, Khmer in three trays (consonants, feet, vowels) the
 * way a Khmer class sorts them.
 */

export const KM_CONSONANTS = "ក ខ គ ឃ ង ច ឆ ជ ឈ ញ ដ ឋ ឌ ឍ ណ ត ថ ទ ធ ន ប ផ ព ភ ម យ រ ល វ ស ហ ឡ អ ឥ ឧ ឪ ឯ ឱ".split(" ");
export const KM_FEET = "ក ខ គ ឃ ង ច ឆ ជ ឈ ញ ដ ឋ ឌ ឍ ណ ត ថ ទ ធ ន ប ផ ព ភ ម យ រ ល វ ស ហ អ".split(" ").map((c) => `្${c}`);
export const KM_VOWELS = "ា ិ ី ឹ ឺ ុ ូ ួ ើ ឿ ៀ េ ែ ៃ ោ ៅ ំ ាំ ុំ ះ ុះ េះ ោះ ់ ៈ".split(" ");
const EN_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** The easy set: the word's tiles plus look-alikes from the same trays, shuffled the same way every time for this word. */
export function easyTiles(answer: readonly string[], lang: PuzzleLang, seed: string): string[] {
  const rng = makeRng(seed);
  const trays = lang === "km" ? [KM_CONSONANTS.slice(0, 33), KM_FEET, KM_VOWELS] : [[..."abcdefghijklmnopqrstuvwxyz"]];
  const out = new Set(answer);
  const target = Math.min(answer.length + 6, 12);
  let guard = 0;
  while (out.size < target && guard++ < 200) {
    const tray = trays[out.size % trays.length];
    out.add(tray[Math.floor(rng() * tray.length)]);
  }
  const list = [...out];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export interface TileKeyboardProps {
  lang: PuzzleLang;
  easy: string[];
  states: ReadonlyMap<string, TileState>;
  mode: "easy" | "all";
  onMode(mode: "easy" | "all"): void;
  onTile(tile: string): void;
  onDelete(): void;
  onCheck(): void;
  canCheck: boolean;
}

export const TileKeyboard: React.FC<TileKeyboardProps> = ({ lang, easy, states, mode, onMode, onTile, onDelete, onCheck, canCheck }) => {
  const { t } = useT();
  const [tray, setTray] = useState(0);
  const trays = [
    { label: t("wordGuess.trayConsonants"), keys: KM_CONSONANTS },
    { label: t("wordGuess.trayFeet"), keys: KM_FEET },
    { label: t("wordGuess.trayVowels"), keys: KM_VOWELS },
  ];

  const key = (tile: string) => {
    const s = states.get(tile);
    return (
      <button
        key={tile}
        type="button"
        onClick={() => onTile(tile)}
        aria-label={s ? `${tile}, ${t(`wordGuess.state.${s}`)}` : tile}
        className={`grid h-12 min-w-[2.6rem] place-items-center rounded-xl border-2 px-1.5 text-xl font-black transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          s ? `${TILE_TONE[s]} ${s === "absent" ? "opacity-60" : ""}` : "border-line bg-surface text-ink hover:border-indigo-300"
        } ${lang === "en" ? "uppercase" : ""}`}
      >
        {tileLabel(tile, lang)}
      </button>
    );
  };

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
      active ? "bg-indigo-600 text-white" : "bg-surface text-body border-2 border-line"
    }`;

  return (
    <div className="space-y-3">
      {/* One row that scrolls sideways on a phone, so the letters keep the room. */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:justify-center" role="group" aria-label={t("wordGuess.keysLabel")}>
        <button type="button" className={chip(mode === "easy")} aria-pressed={mode === "easy"} onClick={() => onMode("easy")}>
          {t("wordGuess.easyKeys")}
        </button>
        {lang === "km" ? (
          trays.map((tr, i) => (
            <button
              key={tr.label}
              type="button"
              className={chip(mode === "all" && tray === i)}
              aria-pressed={mode === "all" && tray === i}
              onClick={() => {
                setTray(i);
                onMode("all");
              }}
            >
              {tr.label}
            </button>
          ))
        ) : (
          <button type="button" className={chip(mode === "all")} aria-pressed={mode === "all"} onClick={() => onMode("all")}>
            {t("wordGuess.allKeys")}
          </button>
        )}
      </div>

      {mode === "easy" ? (
        <div className="flex flex-wrap justify-center gap-2">{easy.map(key)}</div>
      ) : lang === "km" ? (
        <div className="flex flex-wrap justify-center gap-1.5">{trays[tray].keys.map(key)}</div>
      ) : (
        <div className="space-y-1.5">
          {EN_ROWS.map((row) => (
            <div key={row} className="flex justify-center gap-1">
              {[...row].map(key)}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDelete}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface text-base font-black text-ink active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Delete className="h-5 w-5" aria-hidden /> {t("wordGuess.delete")}
        </button>
        <button
          type="button"
          onClick={onCheck}
          aria-disabled={!canCheck}
          className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-black text-white active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            canCheck ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-300 dark:bg-indigo-900"
          }`}
        >
          <CornerDownLeft className="h-5 w-5" aria-hidden /> {t("wordGuess.check")}
        </button>
      </div>
    </div>
  );
};
