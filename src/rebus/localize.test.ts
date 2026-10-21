import { describe, expect, it } from "vitest";
import { matchAnswer } from "./answer";
import { answerInputMode, isNumberAnswer, localizePuzzle, optionAsAuthored, optionAsShown, playableIn, toKhmerDigits } from "./localize";
import { validatePuzzle } from "./puzzle";
import type { Puzzle } from "./types";

const quiz: Puzzle = {
  id: "quiz-pens",
  category: "math",
  ages: [7, 8],
  difficulty: 1,
  trick: "compound",
  kind: "quiz",
  pieces: [{ kind: "word", text: "A pack has 6 pens. How many pens in 7 packs?" }],
  km: { pieces: [{ kind: "word", text: "កញ្ចប់មួយមានប៊ិច 6។ កញ្ចប់ 7 មានប៊ិចប៉ុន្មាន?" }], explanation: "6 × 7 = 42។" },
  answer: "42",
  accepts: [],
  explanation: "6 × 7 = 42.",
  source: "official",
};

describe("localizePuzzle", () => {
  it("leaves English, and a puzzle with nothing to translate, untouched", () => {
    expect(localizePuzzle(quiz, "en")).toBe(quiz);
    const picture: Puzzle = { ...quiz, kind: "picture", km: undefined };
    expect(localizePuzzle(picture, "km")).toBe(picture);
  });

  it("shows the Khmer words and Khmer numerals", () => {
    const view = localizePuzzle(quiz, "km");
    expect(view.pieces[0]).toEqual({ kind: "word", text: "កញ្ចប់មួយមានប៊ិច ៦។ កញ្ចប់ ៧ មានប៊ិចប៉ុន្មាន?" });
    expect(view.answer).toBe("៤២");
    expect(view.explanation).toBe("៦ × ៧ = ៤២។");
  });

  it("writes the numbers of a plain sum in Khmer numerals", () => {
    const sum: Puzzle = { ...quiz, kind: "math", km: undefined, pieces: [{ kind: "word", text: "7 × 8 = ?" }], answer: "56" };
    expect(localizePuzzle(sum, "km").pieces[0]).toEqual({ kind: "word", text: "៧ × ៨ = ?" });
  });

  it("changes Khmer numerals back to digits", () => {
    expect(toKhmerDigits("12")).toBe("១២");
    expect(matchAnswer(quiz, "៤២").ok).toBe(true);
    expect(matchAnswer(quiz, "42").ok).toBe(true);
    expect(matchAnswer(quiz, "៤៣").ok).toBe(false);
  });
});

describe("a worked question", () => {
  it("passes the checks without a picture to spell, and needs an answer", () => {
    expect(validatePuzzle(quiz)).toEqual([]);
    expect(validatePuzzle({ ...quiz, answer: "" }).map((i) => i.code)).toContain("answer-short");
  });

  it("picks the keypad from its answer", () => {
    expect(answerInputMode(quiz)).toBe("numeric");
    expect(answerInputMode({ kind: "quiz", answer: "2.5" })).toBe("decimal");
    expect(answerInputMode({ kind: "quiz", answer: "-3" })).toBeUndefined();
    expect(isNumberAnswer({ kind: "quiz", answer: "3/4" })).toBe(true);
    expect(isNumberAnswer({ kind: "picture", answer: "42" })).toBe(false);
  });
});

describe("numbers keep the marks that change them", () => {
  it("tells -3 from 3, 3/4 from 34 and 1.2 from 12, in either numerals", () => {
    const p = (answer: string) => ({ answer, accepts: [] as string[], kind: "quiz" });
    expect(matchAnswer(p("-3"), "−3").ok).toBe(true);
    expect(matchAnswer(p("-3"), "3").ok).toBe(false);
    expect(matchAnswer(p("3/4"), "៣/៤").ok).toBe(true);
    expect(matchAnswer(p("3/4"), "34").ok).toBe(false);
    expect(matchAnswer(p("1.2"), "1,2").ok).toBe(true);
    expect(matchAnswer(p("1.2"), "12").ok).toBe(false);
    expect(matchAnswer(p("1000"), "1,000").ok).toBe(true);
  });
});

describe("a multiple-choice question with its answers in Khmer", () => {
  const puzzle: Puzzle = {
    id: "choice-test",
    category: "animals",
    ages: [5, 9],
    difficulty: 1,
    trick: "compound",
    kind: "choice",
    choice: { options: ["Cow", "Duck", "Spider 8"], correct: 0 },
    pieces: [{ kind: "word", text: "Which animal says moo?" }],
    answer: "Cow",
    accepts: [],
    explanation: "A cow says moo.",
    km: { pieces: [{ kind: "word", text: "សត្វអ្វីស្រែកម៉ូ?" }], options: ["គោ", "ទា", "ពីងពាង 8"], explanation: "គោស្រែកម៉ូ។" },
    source: "official",
  };

  it("shows the Khmer answers and the Khmer right answer in Khmer, and the English ones in English", () => {
    const view = localizePuzzle(puzzle, "km");
    expect(view.choice?.options).toEqual(["គោ", "ទា", "ពីងពាង ៨"]);
    expect(view.answer).toBe("គោ");
    expect(localizePuzzle(puzzle, "en")).toBe(puzzle);
  });

  it("turns a tapped Khmer answer back into the English one, and back again", () => {
    expect(optionAsAuthored(puzzle, "km", "ទា")).toBe("Duck");
    expect(optionAsAuthored(puzzle, "km", "ពីងពាង ៨")).toBe("Spider 8");
    expect(optionAsShown(puzzle, "km", "Duck")).toBe("ទា");
    expect(optionAsAuthored(puzzle, "en", "Duck")).toBe("Duck");
  });

  it("ignores Khmer answers that do not line up with the English ones", () => {
    const view = localizePuzzle({ ...puzzle, km: { ...puzzle.km, options: ["គោ"] } }, "km");
    expect(view.choice?.options).toEqual(["Cow", "Duck", "Spider ៨"]);
  });
});

describe("what a child reading Khmer can play", () => {
  const picture = (km?: Puzzle["km"]): Puzzle => ({ id: "p", category: "animals", ages: [6, 9], difficulty: 1, trick: "compound", pieces: [{ kind: "word", text: "monk" }], answer: "Monkey", accepts: [], explanation: "monk + key", ...(km ? { km } : {}), source: "official" });

  it("leaves out English wordplay, even one with a Khmer explanation", () => {
    expect(playableIn(picture(), "km")).toBe(false);
    expect(playableIn(picture({ explanation: "ពន្យល់" }), "km")).toBe(false);
    expect(playableIn(picture(), "en")).toBe(true);
  });

  it("keeps sums, questions with Khmer words or answers, and puzzles with a Khmer answer", () => {
    expect(playableIn({ ...picture(), kind: "math" }, "km")).toBe(true);
    expect(playableIn(picture({ pieces: [{ kind: "word", text: "ស្វា" }] }), "km")).toBe(true);
    expect(playableIn(picture({ answer: "ស្វា" }), "km")).toBe(true);
    expect(playableIn(picture({ options: ["ក", "ខ"] }), "km")).toBe(true);
  });

  it("keeps what is written in Khmer away from a child reading English", () => {
    const written = { ...picture(), onlyIn: "km" as const };
    expect(playableIn(written, "km")).toBe(true);
    expect(playableIn(written, "en")).toBe(false);
  });
});
