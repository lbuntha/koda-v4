import { describe, expect, it } from "vitest";

import { wrapText } from "./shareCard";

const measure = (s: string) => s.length * 10;

describe("wrapText", () => {
  it("breaks English on spaces to fit the width", () => {
    const lines = wrapText(measure, "My child studied 4 days this week", 170);
    expect(lines.every((l) => measure(l) <= 170)).toBe(true);
    expect(lines.join(" ")).toBe("My child studied 4 days this week");
  });

  it("breaks Khmer, which has no spaces, into more than one line", () => {
    const text = "កូនខ្ញុំបានរៀនបួនថ្ងៃក្នុងសប្ដាហ៍នេះ";
    const lines = wrapText(measure, text, 120);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(text);
  });
});
