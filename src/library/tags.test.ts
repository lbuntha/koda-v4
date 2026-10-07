import { describe, expect, it } from "vitest";
import { STARTER_PASSAGES } from "./data/starterPassages";
import { bookTags, bookTopics } from "./tags";

describe("book tags", () => {
  it("always files a book under reading, plus its shelf and its author's topics", () => {
    expect(bookTopics({ category: "Animals", topics: ["family"] })).toEqual(["reading", "animals", "family"]);
    expect(bookTopics({ category: "Everyday" })).toEqual(["reading"]);
  });

  it("finds the Khmer letters a Khmer book's words use", () => {
    const km = STARTER_PASSAGES.find((p) => p.language === "km");
    expect(km).toBeTruthy();
    const units = [...bookTags(km!).units];
    expect(units.some((u) => u.startsWith("letter:km:"))).toBe(true);
  });
});
