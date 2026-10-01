import { describe, expect, it } from "vitest";
import { itemFor, parseList } from "./batch";

const d = { grid: "4x3-moeys" as const, sensitivity: "balanced" as const };

describe("new items from a list", () => {
  it("expands ranges", () => {
    expect(parseList("A-Z")).toHaveLength(26);
    expect(parseList("0-9").join("")).toBe("0123456789");
    expect(parseList("១-៩").join("")).toBe("១២៣៤៥៦៧៨៩");
  });

  it("ក-អ is the 33 consonants a child learns (old ឝ ឞ left out)", () => {
    const k = parseList("ក-អ");
    expect(k).toHaveLength(33);
    expect(k).not.toContain("ឝ");
    expect(k[0]).toBe("ក");
    expect(k[32]).toBe("អ");
  });

  it("characters written together become one item each; separated words stay whole", () => {
    expect(parseList("ABC")).toEqual(["A", "B", "C"]);
    expect(parseList("cat dog")).toEqual(["cat", "dog"]);
    expect(parseList("ក ខ, គ")).toEqual(["ក", "ខ", "គ"]);
    expect(parseList("A A B")).toEqual(["A", "B"]);
  });

  it("works out each item's kind, script and numerals", () => {
    expect(itemFor("7", "a", d)).toMatchObject({ kind: "numeral", script: "latin", numerals: "latin", grid: "baseline-4-lines" });
    expect(itemFor("៧", "a", d)).toMatchObject({ kind: "numeral", script: "khmer", numerals: "khmer", grid: "4x3-moeys" });
    expect(itemFor("ខ", "a", d)).toMatchObject({ kind: "letter", script: "khmer" });
    expect(itemFor("cat", "a", d)).toMatchObject({ kind: "word" });
  });

  it("a Khmer vowel or foot is a mark written beside ក, in its place", () => {
    expect(itemFor("ា", "a", d)).toMatchObject({ kind: "mark", zone: "right", carrier: { text: "ក" } });
    expect(itemFor("េ", "a", d)).toMatchObject({ kind: "mark", zone: "left" });
    expect(itemFor("ិ", "a", d)).toMatchObject({ kind: "mark", zone: "above" });
    expect(itemFor("្ក", "a", d)).toMatchObject({ kind: "mark", zone: "below" });
    expect(itemFor("ា", "a", d).guide?.glyph?.text).toBe("កា");
  });
});
