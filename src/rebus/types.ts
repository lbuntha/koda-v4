/**
 * What a rebus puzzle is made of.
 *
 * A puzzle is data, never code: a row of pieces that read aloud as an answer
 * (a germ + money = "Germany"). One renderer draws any of them, the Studio
 * writes them, a pack carries them, and a group room sends only their ids.
 */

import type { AgeRange } from "../lib/ages";
import type { ChoiceSpec } from "./choice";
import type { MathSpec } from "./math";

/**
 * A category's id: its address, never changed. Categories are data an owner manages
 * in the Studio (`categories.ts`), so this is a string, not a list in the code.
 */
export type CategoryId = string;

/** 1 easy – 3 hard. */
export type Difficulty = 1 | 2 | 3;

/** The trick a puzzle plays, so the Studio can see which ones are thin. */
export const TRICKS = ["compound", "sound-alike", "position", "size", "style", "add-remove"] as const;
export type Trick = (typeof TRICKS)[number];

export type WordStyle = "plain" | "cut" | "small" | "big" | "upside-down" | "reversed" | "spaced" | "underlined" | "crossed";

export type Piece =
  /** A photo an author uploaded, kept with the library's photos. `id` is `photo-<sha256>`; `name` is what it is read as. */
  | { kind: "photo"; id: string; name: string; scale?: "big" | "small" }
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
  /** "picture" (the default: pieces add up to a typed answer) or "math" (the numbers are in `math`). */
  kind?: "picture" | "math" | "choice" | "quiz";
  /** A math question's numbers. Its prompt (the one word piece), answer and explanation are worked out from them. */
  math?: MathSpec;
  /** A multiple-choice question's answers and which is right. Its `answer` is that option, worked out from it. */
  choice?: ChoiceSpec;
  /** The same question in Khmer. The answer, numbers and pictures are shared; only the words change. See `localize.ts`. */
  km?: { pieces?: Piece[]; explanation?: string; /** The answer in Khmer, typed and shown in Khmer; the English answer is accepted too. */ answer?: string; /** Multiple choice: the answers in Khmer, in the same order as `choice.options`. */ options?: string[] };
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
