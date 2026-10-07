import { describe, expect, it } from "vitest";
import { collectionTags, itemUnits } from "./tags";

describe("trace tags", () => {
  it("files a letter under the letter it writes, and a numeral under its number", () => {
    expect([...itemUnits({ title: "ក", kind: "letter", script: "khmer" })]).toEqual(["letter:km:ក"]);
    expect([...itemUnits({ title: "B", kind: "letter", script: "latin" })]).toEqual(["letter:en:b"]);
    expect([...itemUnits({ title: "៧", kind: "numeral", script: "khmer" })]).toEqual(["number:7"]);
  });

  it("gives a drawing no letters, whatever it is called", () => {
    expect(itemUnits({ title: "Cat", kind: "drawing" }).size).toBe(0);
  });

  it("adds what a collection's items imply to the topics its author picked", () => {
    const t = collectionTags({
      topics: ["animals"],
      items: [{ item: { title: "ក", kind: "letter", script: "khmer" } }, { item: { title: "3", kind: "numeral", script: "latin" } }],
    });
    expect([...t.topics]).toEqual(["numbers", "letters", "writing", "animals"]);
    expect([...t.units]).toEqual(["letter:km:ក", "number:3"]);
  });
});
