import { beforeEach, describe, expect, it } from "vitest";
import { XpToday } from "./xpToday";

describe("XP earned today", () => {
  beforeEach(() => localStorage.clear());

  it("adds up the day's awards per learner and starts again the next day", () => {
    XpToday.add("kid", 10, "2026-11-22");
    XpToday.add("kid", 5, "2026-11-22");
    XpToday.add("sister", 7, "2026-11-22");
    expect(XpToday.get("kid", "2026-11-22")).toBe(15);
    expect(XpToday.get("sister", "2026-11-22")).toBe(7);
    expect(XpToday.get("kid", "2026-11-23")).toBe(0);
    XpToday.add("kid", 4, "2026-11-23");
    expect(XpToday.get("kid", "2026-11-23")).toBe(4);
    expect(XpToday.get("kid", "2026-11-22")).toBe(0);
  });

  it("ignores zero or negative awards and tells listeners about real ones", () => {
    let heard = 0;
    const off = XpToday.subscribe(() => (heard += 1));
    XpToday.add("kid", 0, "2026-11-22");
    XpToday.add("kid", 3, "2026-11-22");
    off();
    XpToday.add("kid", 3, "2026-11-22");
    expect(heard).toBe(1);
    expect(XpToday.get("kid", "2026-11-22")).toBe(6);
  });
});
