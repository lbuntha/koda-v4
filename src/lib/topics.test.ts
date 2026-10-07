import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TOPICS, cleanTopics, overlap, tags, topicForShelf, unitsOfText } from "./topics";

describe("topics", () => {
  it("is the same list the server refuses everything else against", () => {
    const python = readFileSync(resolve(process.cwd(), "server/app/topics.py"), "utf8");
    const block = python.slice(python.indexOf("TOPICS"), python.indexOf(")", python.indexOf("TOPICS")));
    expect([...block.matchAll(/"([a-z]+)"/g)].map((m) => m[1])).toEqual([...TOPICS]);
  });

  it("keeps known topics once each, in the list's order", () => {
    expect(cleanTopics(["animals", "numbers", "animals", "dragons"])).toEqual(["numbers", "animals"]);
  });

  it("reads a topic from a shelf's name", () => {
    expect(topicForShelf("Animals")).toBe("animals");
    expect(topicForShelf("animal")).toBe("animals");
    expect(topicForShelf("Everyday")).toBeNull();
    expect(topicForShelf(undefined)).toBeNull();
  });
});

describe("units of text", () => {
  it("finds the Khmer letters a text uses", () => {
    expect([...unitsOfText("កខ")]).toEqual(["letter:km:ក", "letter:km:ខ"]);
  });

  it("leaves English letters out unless asked, since a story uses most of them", () => {
    expect(unitsOfText("cat").size).toBe(0);
    expect([...unitsOfText("A", { latinLetters: true })]).toEqual(["letter:en:a"]);
  });

  it("finds numbers in either set of digits, up to 100", () => {
    expect([...unitsOfText("3 apples and ១២ mangoes, 2026")]).toEqual(["number:3", "number:12"]);
  });
});

describe("overlap", () => {
  it("counts a shared unit above a shared topic, and nothing for nothing shared", () => {
    const counting = tags(["numbers", "counting"], ["number:3"]);
    expect(overlap(counting, tags(["numbers"], ["number:3"]))).toBe(3);
    expect(overlap(counting, tags(["animals"]))).toBe(0);
  });
});
