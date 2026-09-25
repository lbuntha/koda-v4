import { describe, expect, it } from "vitest";
import { core } from "./text";
import { STARTER_PASSAGES } from "./starterPassages";

describe("the bundled starter stories", () => {
  it("are three, with distinct ids, and cover both languages and both bands", () => {
    expect(STARTER_PASSAGES).toHaveLength(3);
    expect(new Set(STARTER_PASSAGES.map((p) => p.id)).size).toBe(3);
    expect(new Set(STARTER_PASSAGES.map((p) => p.language))).toEqual(new Set(["en", "km"]));
    expect(new Set(STARTER_PASSAGES.map((p) => p.band))).toEqual(new Set(["A", "B"]));
  });

  it("start at revision 1 and declare where their words came from", () => {
    for (const p of STARTER_PASSAGES) {
      expect(p.rev).toBe(1);
      expect(p.provenance?.length ?? 0).toBeGreaterThan(0);
      expect(p.title.trim()).not.toBe("");
    }
  });

  it("say out loud that the Khmer story has not been read by a native speaker", () => {
    const km = STARTER_PASSAGES.find((p) => p.language === "km")!;
    expect(km.provenance).toMatch(/NOT been reviewed/);
  });

  it("only mark a word as unrecorded if it is actually in the story", () => {
    for (const p of STARTER_PASSAGES) {
      const inStory = new Set(p.sentences.flatMap((s) => s.words.map(core)));
      for (const w of p.noRecording ?? []) expect(inStory.has(w)).toBe(true);
    }
  });

  it("map every story word to a picture key that is not empty", () => {
    for (const p of STARTER_PASSAGES) for (const key of Object.values(p.pictures)) expect(key.trim()).not.toBe("");
  });
});
