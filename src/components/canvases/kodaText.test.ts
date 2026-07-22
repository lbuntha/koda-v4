import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, sentenceShape } from "./kodaText";

const chips = (s: string) => tokenize(s).filter(t => t.strong).map(t => t.text);
/** Visible text, reassembled exactly as the DOM renders it. */
const rendered = (s: string) => tokenize(s).map(t => t.text).join("");

test("an emphasised span stays a single chip", () => {
  // Regression: this used to split into "+", "Ten", "Rod" — three chips for
  // one button, breaking the visual link to the control being named.
  assert.deepEqual(chips("First, tap **+ Ten Rod** to begin."), ["+ Ten Rod"]);
});

test("multiple emphasised spans are kept separate", () => {
  assert.deepEqual(chips("Add **18** and **7**."), ["18", "7"]);
});

test("punctuation hugs the chip it follows", () => {
  // "**18**!" must render "18!", never "18 !".
  const tokens = tokenize("Let's build **18**! First, tap.");
  const bang = tokens[tokens.findIndex(t => t.strong) + 1];
  assert.equal(bang.text, "!");
  assert.equal(bang.isSpace, false);
});

test("round-trips the visible text exactly, markers removed", () => {
  const src = "Tap **+ One Unit** to reach **8** ones. We have **3**.";
  assert.equal(rendered(src), src.replace(/\*\*/g, ""));
});

test("preserves the space before a chip", () => {
  // A dropped leading space would glue the chip to the previous word.
  const tokens = tokenize("Now tap **+ Ten Rod** please");
  const chipAt = tokens.findIndex(t => t.strong);
  assert.equal(tokens[chipAt - 1].isSpace, true);
});

test("handles text with no emphasis, and empty text", () => {
  assert.deepEqual(chips("Just plain words."), []);
  assert.deepEqual(tokenize(""), []);
});

test("whitespace tokens are flagged so the reveal rhythm skips them", () => {
  const words = tokenize("two words").filter(t => !t.isSpace);
  assert.deepEqual(words.map(t => t.text), ["two", "words"]);
});

test("sentenceShape masks digits so counting prompts share one identity", () => {
  // The whole point: these are the same instruction, so Koda must not re-read.
  assert.equal(
    sentenceShape("Tap **+ One Unit** to reach **8** ones. We have **3**."),
    sentenceShape("Tap **+ One Unit** to reach **8** ones. We have **4**.")
  );
});

test("sentenceShape still separates genuinely different instructions", () => {
  assert.notEqual(
    sentenceShape("Tap **+ Ten Rod** to add **2** rods."),
    sentenceShape("Tap **+ One Unit** to add **2** ones.")
  );
});

test("multi-digit counts collapse to the same shape as single digits", () => {
  assert.equal(sentenceShape("We have 9."), sentenceShape("We have 10."));
});
