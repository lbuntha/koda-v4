/**
 * What a rebus puzzle is made of.
 *
 * A puzzle is data, never code: a row of pieces that read aloud as an answer
 * (a germ + money = "Germany"). One renderer draws any of them, the Studio
 * writes them, a pack carries them, and a group room sends only their ids.
 */

import type { AgeRange } from "../lib/ages";

export const CATEGORY_IDS = ["countries", "food", "sayings", "animals", "sports", "school", "science", "khmer"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** 1 easy – 3 hard. */
export type Difficulty = 1 | 2 | 3;

/** The trick a puzzle plays, so the Studio can see which ones are thin. */
export const TRICKS = ["compound", "sound-alike", "position", "size", "style", "add-remove"] as const;
export type Trick = (typeof TRICKS)[number];

export type WordStyle = "plain" | "cut" | "small" | "big" | "upside-down";

export type Piece =
  /** A picture from Koda's own icon library. `id` is the library id; `name` is what it is called, said aloud. */
  | { kind: "icon"; id: string; name: string; scale?: "big" | "small" }
  /** Written text that is part of the puzzle, optionally styled (CAKE with a slice cut out). */
  | { kind: "word"; text: string; style?: WordStyle }
  /** One piece of text over another (MAN over BOARD). */
  | { kind: "stack"; top: string; bottom: string }
  | { kind: "op"; op: "+" | "&" | "-" };

export type PuzzleSource = "official" | "community" | "ai";

export interface Puzzle {
  id: string;
  category: CategoryId;
  /** Who it is for, in years. Required, like every piece of Learn content. */
  ages: AgeRange;
  difficulty: Difficulty;
  trick: Trick;
  pieces: Piece[];
  /** The answer as it is shown after the puzzle. */
  answer: string;
  /** Other answers that are also right ("piece of cake" for "slice of cake"). */
  accepts: string[];
  /** One short sentence a child can follow: why these pieces say that. */
  explanation: string;
  source: PuzzleSource;
  /** A maker's nickname, only ever the nickname. */
  author?: string;
}
