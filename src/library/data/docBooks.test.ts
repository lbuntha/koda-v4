import { readdirSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { readingLexiconFor } from "./readingLexicon";
import type { Passage } from "./passage";
import { verifyPassage } from "./verifyPassage";

/**
 * Every book drafted in docs/library-books must pass the Studio's own checks,
 * reading list included — the server's copy skips rule 4, so it is not enough.
 * The one thing a script cannot do is confirm a picture shows its word: that is
 * a person's job in the Studio, so those lines are the only failures allowed.
 */
const DIR = "docs/library-books";
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

describe("drafted books", () => {
  it.each(files)("%s passes every check but picture confirmation", (file) => {
    const book = JSON.parse(readFileSync(`${DIR}/${file}`, "utf8")) as Passage;
    const lexicon = readingLexiconFor(book.band, book.language);
    if (book.language === "en") expect(lexicon, "reading list missing, so rule 4 would be skipped").toBeDefined();
    const verdict = verifyPassage(book, { lexicon, confirmedSplit: true });
    const failing = verdict.checks.filter((c) => c.status === "fail" && !/^confirm the picture/.test(c.message));
    expect(failing.map((c) => `rule ${c.rule} ${c.question}: ${c.message}`)).toEqual([]);
  });
});
