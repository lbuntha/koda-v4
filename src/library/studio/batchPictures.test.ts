import { describe, expect, it } from "vitest";
import { pickSlots, slotKind, slotPrompt, type SlotInfo } from "./batchPictures";

const slots: SlotInfo[] = [
  { slot: 0, text: "Rain", how: "chosen", at: null },
  { slot: 1, text: "It rains.", how: "auto", at: "top" },
  { slot: 2, text: "We play.", how: "chosen", at: "left" },
  { slot: 3, text: "The end.", how: "none", at: "top" },
];

describe("batch pictures", () => {
  it("picks every slot, none, or only the pages still on Automatic", () => {
    expect(pickSlots(slots, "all", "cat")).toEqual([0, 1, 2, 3]);
    expect(pickSlots(slots, "none", "cat")).toEqual([]);
    expect(pickSlots(slots, "missing", "cat")).toEqual([1]);
    expect(pickSlots(slots, "missing", "")).toEqual([0, 1]);
  });

  it("makes side pictures tall and the rest wide", () => {
    expect(slotKind({ at: "left" })).toBe("portrait");
    expect(slotKind({ at: "right" })).toBe("portrait");
    expect(slotKind({ at: "top" })).toBe("banner");
    expect(slotKind({ at: null })).toBe("banner");
  });

  it("tells the model what to draw for a page and for the cover", () => {
    expect(slotPrompt("It rains.", "Rain", false)).toBe("Illustrate this line from the story: “It rains.”");
    expect(slotPrompt("", " Rain ", true)).toBe("A cover illustration for the story titled “Rain”");
    expect(slotPrompt("", "", true)).toBe("A cover illustration for a children’s story");
  });
});
