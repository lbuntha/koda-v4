/**
 * Fifteen puzzles that stand for the real bank in tests, and seed the first
 * play screen until Phase 2 brings the real content.
 */

import type { AgeRange } from "../../lib/ages";
import type { CategoryId, Difficulty, Piece, Puzzle, Trick } from "../types";

const icon = (name: string, scale?: "big" | "small"): Piece => ({ kind: "icon", id: `rebus-${name}`, name, ...(scale ? { scale } : {}) });
const plus: Piece = { kind: "op", op: "+" };
const word = (text: string, style?: "cut" | "small"): Piece => ({ kind: "word", text, ...(style ? { style } : {}) });

let n = 0;
const make = (
  category: CategoryId,
  difficulty: Difficulty,
  trick: Trick,
  ages: AgeRange,
  pieces: Piece[],
  answer: string,
  explanation: string,
  accepts: string[] = [],
): Puzzle => ({ id: `sample-${++n}`, category, difficulty, trick, ages, pieces, answer, accepts, explanation, source: "official" });

export const SAMPLE_PUZZLES: readonly Puzzle[] = [
  make("countries", 2, "sound-alike", [10, 12], [icon("germ"), plus, icon("money")], "Germany", "germ + money, said fast, sounds like Germany."),
  make("countries", 1, "compound", [7, 9], [icon("turkey")], "Turkey", "A turkey bird: the bird and the country share a name."),
  make("countries", 1, "sound-alike", [7, 9], [icon("whales")], "Wales", "Whales sounds just like Wales."),
  make("countries", 2, "add-remove", [10, 12], [word("S"), plus, icon("pain")], "Spain", "S + pain = Spain."),
  make("countries", 1, "sound-alike", [7, 9], [icon("chili")], "Chile", "A chili pepper sounds like Chile."),
  make("food", 2, "style", [10, 12], [word("CAKE", "cut")], "Slice of cake", "A slice is missing from the word CAKE.", ["piece of cake"]),
  make("food", 1, "compound", [7, 9], [icon("honey"), plus, icon("moon")], "Honeymoon", "honey + moon = honeymoon."),
  make("food", 1, "compound", [7, 9], [icon("hot"), plus, icon("dog")], "Hot dog", "hot + dog = hot dog."),
  make("food", 1, "compound", [7, 9], [icon("peanut"), plus, icon("butter")], "Peanut butter", "peanut + butter = peanut butter."),
  make("food", 1, "compound", [7, 9], [icon("apple"), plus, icon("pie")], "Apple pie", "apple + pie = apple pie."),
  make("sayings", 3, "position", [10, 12], [{ kind: "stack", top: "MAN", bottom: "BOARD" }], "Man overboard", "MAN is over BOARD."),
  make("sayings", 3, "position", [10, 12], [{ kind: "stack", top: "STAND", bottom: "I" }], "I understand", "I is under STAND.", ["understand"]),
  make("sayings", 2, "compound", [10, 12], [icon("rain"), icon("cats"), { kind: "op", op: "&" }, icon("dogs")], "Raining cats and dogs", "Rain, cats and dogs, all together."),
  make("sayings", 3, "compound", [13, 18], [icon("blue"), icon("moon")], "Once in a blue moon", "blue + moon: something that hardly ever happens.", ["blue moon"]),
  make("sayings", 3, "size", [13, 18], [icon("fish", "big"), word("pond", "small")], "Big fish in a small pond", "A big fish and a tiny pond.", ["big fish small pond"]),
];

/** Every icon id the sample puzzles use, for the Studio's missing-icon check. */
export const SAMPLE_ICON_IDS: ReadonlySet<string> = new Set(
  SAMPLE_PUZZLES.flatMap((p) => p.pieces.flatMap((piece) => (piece.kind === "icon" ? [piece.id] : []))),
);
