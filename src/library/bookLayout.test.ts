import { describe, expect, it } from "vitest";
import { STARTER_PASSAGES } from "./data/starterPassages";
import { hasOwnPages, headingLength, pageText, joinPageToPrevious, keyWordsOf, layoutBook, pagePicture, paginate, setSentence, withAutomaticPages, withPageBreak, withPageChoice, withPagePicture } from "./bookLayout";
import type { Passage, Sentence } from "./data/passage";

const [MARKET, RAINY, MARKET_KM] = STARTER_PASSAGES;
const s = (id: string, text: string): Sentence => ({ id, text, words: text.split(" ") });

describe("paginate", () => {
  it("keeps every sentence, in order, and never splits one", () => {
    for (const p of STARTER_PASSAGES) expect(paginate(p).flat().map((x) => x.id)).toEqual(p.sentences.map((x) => x.id));
  });

  it("puts two short sentences on a page for band A and three for band B", () => {
    expect(paginate(MARKET).map((pg) => pg.length)).toEqual([2, 2]);
    expect(paginate(RAINY).map((pg) => pg.length).every((n) => n <= 3)).toBe(true);
  });

  it("gives a long sentence a page to itself", () => {
    const long = s("s2", "word ".repeat(40).trim());
    const pages = paginate({ band: "A", sentences: [s("s1", "A cat."), long, s("s3", "The end.")] });
    expect(pages.map((pg) => pg.map((x) => x.id))).toEqual([["s1"], ["s2"], ["s3"]]);
  });
});

describe("page breaks an author places", () => {
  const book = { band: "A" as const, sentences: [s("s1", "A cat."), s("s2", "A dog."), s("s3", "A hen."), s("s4", "The end.")] };
  const ids = (b: Pick<Passage, "band" | "sentences">) => paginate(b).map((pg) => pg.map((x) => x.id));

  it("start a new page where the author says", () => {
    expect(ids(book)).toEqual([["s1", "s2"], ["s3", "s4"]]);
    expect(ids(withPageBreak(book, "s2", true))).toEqual([["s1"], ["s2", "s3"], ["s4"]]);
  });

  it("keep a sentence on the page before, past the band's count", () => {
    expect(ids(withPageBreak(book, "s3", false))).toEqual([["s1", "s2", "s3"], ["s4"]]);
  });

  it("never mark the first sentence, and go back to automatic", () => {
    expect(withPageBreak(book, "s1", true).sentences[0]).not.toHaveProperty("pageBreak");
    const split = withPageBreak(book, "s2", true);
    expect(hasOwnPages(split)).toBe(true);
    expect(withPageBreak(split, "s2", undefined).sentences[1]).not.toHaveProperty("pageBreak");
    expect(ids(withAutomaticPages(split))).toEqual(ids(book));
    expect(hasOwnPages(withAutomaticPages(split))).toBe(false);
  });

  it("join a page to the one before, keeping one picture choice", () => {
    const pictured = { ...book, sentences: book.sentences.map((x) => (x.id === "s3" ? { ...x, picture: "hen", pictureAt: "left" as const } : x)) };
    const joined = joinPageToPrevious(pictured, ["s1", "s2"], ["s3", "s4"]);
    expect(ids(joined)).toEqual([["s1", "s2", "s3", "s4"]]);
    expect(joined.sentences[0]).toMatchObject({ picture: "hen", pictureAt: "left" });
    expect(joined.sentences[2]).not.toHaveProperty("picture");
  });
});

describe("a page's text size and alignment", () => {
  const book = { band: "A" as const, sentences: [s("s1", "A cat."), s("s2", "A dog.")] };

  it("live on the page's first sentence, beside its picture, and default to normal and left", () => {
    const sized = withPageChoice({ ...book, sentences: [book.sentences[0], { ...book.sentences[1], picture: "dog" }] }, ["s1", "s2"], { textSize: "large", textAlign: "center" });
    expect(sized.sentences[0]).toMatchObject({ picture: "dog", textSize: "large", textAlign: "center" });
    expect(sized.sentences[1]).not.toHaveProperty("textSize");
    expect(pageText(sized.sentences.map((sentence) => ({ sentence })))).toEqual({ size: "large", align: "center" });
    expect(pageText(book.sentences.map((sentence) => ({ sentence })))).toEqual({ size: "normal", align: "left" });
  });

  it("are kept when the picture changes, and normal and left are not stored", () => {
    const sized = withPageChoice(book, ["s1", "s2"], { textSize: "huge" });
    expect(withPagePicture(sized, ["s1", "s2"], "cat").sentences[0]).toMatchObject({ picture: "cat", textSize: "huge" });
    const back = withPageChoice(sized, ["s1", "s2"], { textSize: "normal", textAlign: "left" });
    expect(back.sentences[0]).not.toHaveProperty("textSize");
    expect(back.sentences[0]).not.toHaveProperty("textAlign");
  });
});

describe("key words", () => {
  it("are the words the quiz asks about", () => {
    expect([...keyWordsOf(MARKET)].sort()).toEqual(["banana", "mango", "market", "sweet"]);
  });

  it("are bold where they appear, and a name is italic", () => {
    const set = setSentence(MARKET.sentences[0], MARKET, keyWordsOf(MARKET));
    const byWord = Object.fromEntries(set.tokens.map((t) => [t.word, t.emphasis]));
    expect(byWord.market).toBe("key");
    expect(byWord.Sokha).toBe("name"); // first in the sentence, but the book lists it as a name
    expect(byWord.goes).toBeNull();
  });

  it("marks a name inside a sentence", () => {
    const set = setSentence(s("s1", "Shortly after, the Big Bad Wolf comes along."), MARKET, new Set());
    expect(set.tokens.filter((t) => t.emphasis === "name").map((t) => t.word)).toEqual(["Big", "Bad", "Wolf"]);
  });

  it("does not guess a name from a capital at the start of a sentence", () => {
    expect(setSentence(s("s1", "Grandma bakes a cake."), { language: "en" }, new Set()).tokens[0].emphasis).toBeNull();
  });

  it("does not take the start of speech or of a second sentence for a name", () => {
    const set = setSentence(s("s1", 'Refused, he vows: "Then I\'ll blow your house in! " He blows. Then Dara came.'), MARKET, new Set());
    expect(set.tokens.filter((t) => t.emphasis === "name").map((t) => t.word)).toEqual(["Dara"]); // Then, He: sentence starts
    const named = setSentence(s("s1", "At noon, the wolf met Dara."), MARKET, new Set());
    expect(named.tokens.filter((t) => t.emphasis === "name").map((t) => t.word)).toEqual(["Dara"]);
  });

  it("does not call a lone I a name", () => {
    expect(setSentence(s("s1", "Then I ran home."), MARKET, new Set()).tokens.some((t) => t.emphasis === "name")).toBe(false);
  });

  it("works in Khmer, where there are no capitals", () => {
    const set = setSentence(MARKET_KM.sentences[1], MARKET_KM, keyWordsOf(MARKET_KM));
    expect(set.tokens.find((t) => t.word === "ស្វាយ")?.emphasis).toBe("key");
    expect(set.tokens.every((t) => t.emphasis !== "name")).toBe(true);
  });
});

describe("headings", () => {
  it("turns a short capitalised lead with a colon into a heading", () => {
    expect(headingLength(s("s1", "Setting Out: Three young pigs leave home."), "en")).toBe(2);
    expect(headingLength(s("s1", "The Straw House: The first pig builds a house."), "en")).toBe(3);
    const set = setSentence(s("s1", "The Straw House: The first pig builds a house."), MARKET, new Set());
    expect(set.heading).toBe("The Straw House");
    expect(set.tokens[0].text).toBe("The");
  });

  it("leaves an ordinary sentence alone", () => {
    expect(headingLength(s("s1", "Then Dara said: come here."), "en")).toBe(0);
    expect(headingLength(s("s1", "It rained all morning, so Dara stayed inside."), "en")).toBe(0);
    expect(headingLength(s("s1", "Stop:"), "en")).toBe(0); // nothing after it — not a heading
    expect(headingLength(MARKET_KM.sentences[0], "km")).toBe(0);
  });

  it("never loses a word: heading plus body rejoin to the sentence", () => {
    const x = s("s1", "Setting Out: Three young pigs leave home.");
    const set = setSentence(x, MARKET, new Set());
    expect(`${set.heading}: ${set.tokens.map((t) => t.text).join(" ")}`).toBe(x.text);
  });
});

describe("layoutBook", () => {
  it("counts the title page as page one", () => {
    const b = layoutBook(MARKET as Passage);
    expect(b.count).toBe(b.story.length + 1);
  });

  it("illustrates a page with the first pictured word on it", () => {
    const b = layoutBook(MARKET as Passage);
    expect(b.pictures).toHaveLength(b.story.length);
    expect(b.pictures[0]).toBe(MARKET.pictures.market);
    expect(layoutBook({ ...(MARKET as Passage), pictures: {} }).pictures.every((p) => p === null)).toBe(true);
  });
});

describe("page pictures", () => {
  const book = MARKET as Passage;
  const firstPage = () => layoutBook(book).story[0];
  const ids = paginate(book)[0].map((x) => x.id);

  it("are automatic until the author chooses", () => {
    expect(pagePicture(firstPage(), book)).toEqual({ key: book.pictures.market, how: "auto", at: "top" });
  });

  it("show what the author chose, or nothing when they chose none", () => {
    const chosen = withPagePicture(book, ids, "cat");
    expect(pagePicture(layoutBook(chosen).story[0], chosen)).toEqual({ key: "cat", how: "chosen", at: "top" });
    const none = withPagePicture(book, ids, null);
    expect(pagePicture(layoutBook(none).story[0], none)).toEqual({ key: null, how: "none", at: "top" });
    expect(layoutBook(none).pictures[0]).toBeNull();
  });

  it("keep one choice per page, on its first sentence, and go back to automatic", () => {
    const messy = { ...book, sentences: book.sentences.map((x, i) => (i === 1 ? { ...x, picture: "rain" } : x)) };
    const set = withPagePicture(messy, ids, "cat");
    expect(set.sentences.map((x) => x.picture)).toEqual(["cat", undefined, undefined, undefined]);
    const auto = withPagePicture(set, ids, undefined);
    expect(auto.sentences.every((x) => !("picture" in x))).toBe(true);
    expect(auto.sentences.map((x) => x.text)).toEqual(book.sentences.map((x) => x.text));
  });
});

describe("where a page's picture sits", () => {
  const book = MARKET as Passage;
  const ids = paginate(book)[0].map((x) => x.id);

  it("is top unless placed, and a place survives a new picture", () => {
    expect(layoutBook(book).places.every((p) => p === "top")).toBe(true);
    const left = withPageChoice(book, ids, { at: "left" });
    expect(layoutBook(left).places[0]).toBe("left");
    const photo = withPagePicture(left, ids, "photo-" + "a".repeat(64));
    expect(pagePicture(layoutBook(photo).story[0], photo)).toMatchObject({ how: "chosen", at: "left" });
    expect(photo.sentences[0]).toMatchObject({ picture: "photo-" + "a".repeat(64), pictureAt: "left" });
  });

  it("stores nothing for top, the default", () => {
    const back = withPageChoice(withPageChoice(book, ids, { at: "right" }), ids, { at: "top" });
    expect(back.sentences.every((x) => !("pictureAt" in x))).toBe(true);
  });
});
