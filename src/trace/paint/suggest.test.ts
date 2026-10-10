import { describe, expect, it } from "vitest";
import type { SuggestPart } from "./suggest";
import { stepsFromSuggestion } from "./suggest";

const parts: SuggestPart[] = [1, 2, 3, 4].map((id) => ({ id, label: id * 10, at: { x: id * 100, y: 500 }, size: 500 }));

describe("AI colour suggestions", () => {
  it("turns the answer into steps, in order, with their words", () => {
    let n = 0;
    const steps = stepsFromSuggestion(
      [
        { color: "brown", parts: [1, 3], instruction: "Colour the hair brown.", name: "hair" },
        { color: "#E8B48A", parts: [2], instruction: "Colour the face." },
      ],
      parts,
      () => `s${n++}`,
    );
    expect(steps.map((s) => [s.color, s.seeds.length, s.instruction])).toEqual([
      ["brown", 2, "Colour the hair brown."],
      ["#e8b48a", 1, "Colour the face."],
    ]);
  });

  it("drops unknown parts, repeated parts, bad colours and empty steps", () => {
    const steps = stepsFromSuggestion(
      [
        { color: "brown", parts: [1, 99] },
        { color: "red", parts: [1] },
        { color: "gold", parts: [2] },
        { color: "blue", parts: [3, "4"] },
        "nonsense",
      ],
      parts,
      () => "s",
    );
    expect(steps.map((s) => [s.color, s.seeds.length])).toEqual([
      ["brown", 1],
      ["blue", 2],
    ]);
    expect(stepsFromSuggestion(null, parts, () => "s")).toEqual([]);
  });
});
