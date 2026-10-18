/**
 * Build the answer from letter tiles, for children who are not typing yet.
 *
 * The owner turns this on (or, later, an age does): a keyboard hides half the
 * screen on a phone and asks a six-year-old to spell from nothing. Here the
 * letters are all on screen, a few extras mixed in, and the slots show how long
 * the answer is. When the last slot fills it is checked; a wrong try clears the
 * slots so the child starts the word again, not hunts for the bad letter.
 */

import React, { useMemo, useState } from "react";
import { Delete } from "lucide-react";
import { useT } from "../../lib/i18n";
import { UIButton } from "../../components/ui";
import { normalizeAnswer } from "../answer";
import { makeRng, shuffled } from "../rng";
import { cue } from "../sound";

const LATIN = "abcdefghijklmnopqrstuvwxyz".split("");

const graphemes = (text: string): string[] =>
  typeof Intl !== "undefined" && "Segmenter" in Intl ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment) : [...text];

export interface LetterTilesProps {
  answer: string;
  /** Stable per puzzle, so the tiles do not reshuffle on every redraw. */
  seed: string;
  onSubmit(text: string): void;
}

export const LetterTiles: React.FC<LetterTilesProps> = ({ answer, seed, onSubmit }) => {
  const { t } = useT();
  const words = useMemo(() => normalizeAnswer(answer).split(" ").filter(Boolean).map(graphemes), [answer]);
  const letters = useMemo(() => words.flat(), [words]);
  const tiles = useMemo(() => {
    const rng = makeRng(seed);
    const isLatin = letters.every((l) => LATIN.includes(l));
    const extras = isLatin ? shuffled(rng, LATIN.filter((l) => !letters.includes(l))).slice(0, Math.max(3, Math.ceil(letters.length / 3))) : [];
    return shuffled(rng, [...letters, ...extras]).map((letter, id) => ({ id, letter }));
  }, [letters, seed]);

  const [picked, setPicked] = useState<number[]>([]);
  const byId = (id: number) => tiles.find((tile) => tile.id === id)?.letter ?? "";

  const pick = (id: number) => {
    cue("pick");
    const next = [...picked, id];
    if (next.length < letters.length) return setPicked(next);
    setPicked([]);
    onSubmit(next.map(byId).join(""));
  };

  let slot = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div role="group" className="flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label={t("rebus.answerLabel")}>
        {words.map((word, w) => (
          <div key={w} className="flex gap-1.5">
            {word.map(() => {
              const id = picked[slot++];
              return (
                <span key={slot} className="flex h-11 w-9 items-center justify-center rounded-xl border-2 border-line bg-surface text-xl font-black text-ink">
                  {id === undefined ? "" : byId(id).toLocaleUpperCase()}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {tiles.map(({ id, letter }) => (
          <UIButton key={id} variant="secondary" size="choice" disabled={picked.includes(id)} onClick={() => pick(id)} className="!min-w-11 uppercase">
            {letter}
          </UIButton>
        ))}
      </div>

      <UIButton variant="ghost" size="sm" icon={<Delete />} disabled={picked.length === 0} onClick={() => setPicked((p) => p.slice(0, -1))}>
        {t("rebus.undo")}
      </UIButton>
    </div>
  );
};
