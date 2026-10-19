import { describe, expect, it } from "vitest";
import { SAMPLE_ICON_IDS, SAMPLE_PUZZLES } from "./fixtures/samplePuzzles";
import { answerKey, isDuplicate, meaningfulPieces, pieceName, validatePuzzle } from "./puzzle";
import type { Piece, Puzzle } from "./types";

const codes = (p: Puzzle, iconIds?: ReadonlySet<string>) => validatePuzzle(p, { iconIds }).map((i) => i.code);
const good = SAMPLE_PUZZLES[6]; // honey + moon

describe("validatePuzzle", () => {
  it("passes every sample puzzle", () => {
    for (const p of SAMPLE_PUZZLES) expect(codes(p, SAMPLE_ICON_IDS), p.answer).toEqual([]);
  });

  it("wants a picture or word, not just operators", () => {
    expect(codes({ ...good, pieces: [{ kind: "op", op: "+" }] })).toContain("no-picture");
  });

  it("refuses an operator at either end, or two in a row", () => {
    const moon = good.pieces[2];
    const plus: Piece = { kind: "op", op: "+" };
    expect(codes({ ...good, pieces: [plus, moon] })).toContain("bad-operators");
    expect(codes({ ...good, pieces: [moon, plus] })).toContain("bad-operators");
    expect(codes({ ...good, pieces: [moon, plus, plus, moon] })).toContain("bad-operators");
  });

  it("refuses an answer written out in the puzzle", () => {
    const spelled: Puzzle = { ...good, answer: "Honeymoon", pieces: [{ kind: "word", text: "honey moon" }] };
    expect(codes(spelled)).toContain("answer-in-puzzle");
    const alt: Puzzle = { ...good, accepts: ["sweet"], pieces: [{ kind: "word", text: "SWEET" }] };
    expect(codes(alt)).toContain("answer-in-puzzle");
  });

  it("does not mistake a stack that only contains part of the answer for giving it away", () => {
    expect(codes(SAMPLE_PUZZLES[11])).toEqual([]); // STAND over I → "I understand"
  });

  it("wants a real answer and a reason", () => {
    expect(codes({ ...good, answer: "ab" })).toContain("answer-short");
    expect(codes({ ...good, explanation: "  nope " })).toContain("no-explanation");
  });

  it("checks age range, difficulty and category", () => {
    expect(codes({ ...good, ages: [3, 9] })).toContain("bad-ages");
    expect(codes({ ...good, ages: [12, 9] })).toContain("bad-ages");
    expect(codes({ ...good, difficulty: 4 as never })).toContain("bad-difficulty");
    expect(codes({ ...good, category: "Cars!" })).toContain("bad-category");
    // Known by the Studio's list: a well-formed id that is not a category is still refused.
    expect(validatePuzzle({ ...good, category: "cars" }, { categoryIds: new Set(["food"]) }).map((i) => i.code)).toContain("bad-category");
    expect(validatePuzzle({ ...good, category: "food" }, { categoryIds: new Set(["food"]) }).map((i) => i.code)).not.toContain("bad-category");
  });

  it("limits how many pieces a child must hold in their head", () => {
    const many: Piece[] = Array.from({ length: 8 }, () => good.pieces[0]);
    expect(codes({ ...good, pieces: many })).toContain("too-many-pieces");
  });

  it("names icons the library does not have, only when given a library", () => {
    const missing: Puzzle = { ...good, pieces: [{ kind: "icon", id: "rebus-yeti", name: "yeti" }, ...good.pieces.slice(1)] };
    expect(codes(missing)).not.toContain("unknown-icon");
    const issue = validatePuzzle(missing, { iconIds: SAMPLE_ICON_IDS }).find((i) => i.code === "unknown-icon");
    expect(issue?.message).toContain("yeti");
  });
});

describe("pieces", () => {
  it("says what each piece reads aloud, and nothing for an operator", () => {
    expect(SAMPLE_PUZZLES[10].pieces.map(pieceName)).toEqual(["MAN over BOARD"]);
    expect(good.pieces.map(pieceName)).toEqual(["honey", "", "moon"]);
    expect(meaningfulPieces(good.pieces)).toHaveLength(2);
  });
});

describe("duplicates", () => {
  it("keys a puzzle by its answer however it was typed", () => {
    expect(answerKey({ answer: "Hot  Dog" })).toBe(answerKey({ answer: "hotdog" }));
  });

  it("finds an answer that is already in the bank", () => {
    const bank = new Set(SAMPLE_PUZZLES.map(answerKey));
    expect(isDuplicate({ answer: "HONEY MOON" }, bank)).toBe(true);
    expect(isDuplicate({ answer: "Pineapple" }, bank)).toBe(false);
  });
});
