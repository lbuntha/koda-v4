import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryPage } from "./LibraryPage";
import { LibraryProgress } from "./progress";
import { STARTER_PASSAGES } from "./data/starterPassages";
import { spellingUnits, unitLabel } from "./data/khmer";
import { unitCue, unitName } from "./data/khmerCoach";
import { UnitVoices } from "./unitVoices";
import { say } from "./voice";
import type { ComprehensionQuestion, SpellQuestion, VocabQuestion } from "./data/passage";

/**
 * The Khmer book, played to its spelling words: tiles are classroom units
 * (ផ · ◌្អ · ◌ែ · ម), a trace in the drawn order is told the rule, and the hint
 * names the next piece. Khmer is built from code points, never typed as glyphs.
 */

vi.mock("./voice", () => ({ canSpeak: () => false, voiceStatus: () => "no-voice", bookSpeaks: () => false, sentenceSpeaks: () => false, say: vi.fn(async () => {}), stop: vi.fn() }));
vi.mock("./clips", () => ({ prefetchBook: vi.fn(async () => ({ ready: 0, total: 0 })), uploadClip: vi.fn(), pcmToWav: vi.fn() }));
vi.mock("./api", () => ({ reportBook: vi.fn(), fetchPublished: vi.fn(async () => { throw new Error("offline"); }) }));
vi.mock("../assets/svg", () => ({ SvgAsset: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback}</>, SvgMarkup: () => null }));

const KM = STARTER_PASSAGES.find((p) => p.language === "km")!;
const k = (...cps: number[]) => String.fromCodePoint(...cps);
const KHMER_BUTTON = k(0x1797, 0x17b6, 0x179f, 0x17b6, 0x1781, 0x17d2, 0x1798, 0x17c2, 0x179a); // ភាសាខ្មែរ

beforeEach(() => {
  localStorage.clear();
  LibraryProgress.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

const advance = async (ms = 1100) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const tile = (unit: string, nth = 0) =>
  [...document.querySelectorAll<SVGGElement>("[data-wheel-tile]")].filter((g) => g.getAttribute("aria-label")?.split(",")[0] === unitLabel(unit))[nth];
const centre = (g: SVGGElement) => {
  const m = g.getAttribute("transform")!.match(/translate\(([\d.-]+) ([\d.-]+)\)/)!;
  return { clientX: Number(m[1]), clientY: Number(m[2]) };
};
function trace(units: string[]) {
  const svg = document.querySelector("[data-letter-wheel] svg")!;
  const used: Record<string, number> = {};
  const pts = units.map((u) => centre(tile(u, (used[u] = (used[u] ?? -1) + 1))));
  fireEvent.pointerDown(svg, { ...pts[0], pointerId: 1, button: 0, pointerType: "touch" });
  for (const p of pts.slice(1)) fireEvent.pointerMove(svg, { ...p, pointerId: 1, pointerType: "touch" });
  fireEvent.pointerUp(svg, { ...pts[pts.length - 1], pointerId: 1, pointerType: "touch" });
}

/** Choose tiles one at a time, as a tap or a key press does: no path crossing other tiles. */
function tap(units: string[]) {
  const used: Record<string, number> = {};
  for (const u of units) fireEvent.keyDown(tile(u, (used[u] = (used[u] ?? -1) + 1)), { key: "Enter" });
}

async function toSpelling() {
  render(<LibraryPage />);
  fireEvent.click(screen.getByRole("button", { name: KHMER_BUTTON }));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${KM.title}\\.`) }));
  fireEvent.click(screen.getByRole("button", { name: "Read" }));
  while (screen.queryByRole("button", { name: "Next page" })) fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  fireEvent.click(screen.getByRole("button", { name: "I’m ready" }));
  for (const q of KM.questions.filter((x): x is ComprehensionQuestion => x.kind === "comprehension")) {
    fireEvent.click(screen.getByRole("button", { name: q.options[q.answer] }));
    await advance();
  }
  for (const q of KM.questions.filter((x): x is VocabQuestion => x.kind === "vocab")) {
    fireEvent.click(screen.getByRole("button", { name: q.options[q.answer] }));
    await advance();
  }
}

const spells = KM.questions.filter((x): x is SpellQuestion => x.kind === "spell");

describe("spelling a Khmer word", () => {
  it("offers classroom units on the ring, and tells a drawn-order trace the rule", async () => {
    await toSpelling();
    // The first two words, spelled right.
    for (const q of spells.slice(0, 2)) {
      const units = spellingUnits(q.word);
      for (const u of units) expect(tile(u)).toBeTruthy();
      trace(units);
      await advance();
    }
    // ផ្អែម: ផ · ◌្អ · ◌ែ · ម. Traced as it is drawn — ◌ែ before its foot.
    const units = spellingUnits(spells[2].word);
    expect(units).toHaveLength(4);
    tap([units[0], units[2], units[1], units[3]]);
    expect(screen.queryByText(/✓/)).toBeNull(); // not accepted, though it draws the same
    expect(screen.getByText(new RegExp(`comes before`)).textContent).toContain(unitCue(units[1]));
    expect(screen.getByText(/written on the left/)).toBeTruthy();
    await advance();
    trace(units);
    await advance();
    expect(screen.getByRole("heading", { name: new RegExp(KM.title) })).toBeTruthy();
  });

  it("shows the word forming, and says when a piece is written on the left", async () => {
    await toSpelling();
    for (const q of spells.slice(0, 2)) {
      trace(spellingUnits(q.word));
      await advance();
    }
    const units = spellingUnits(spells[2].word); // ផ · ◌្អ · ◌ែ · ម
    tap(units.slice(0, 2));
    const forming = () => document.querySelector("[data-word-forming]")!;
    expect(forming().textContent).toContain(units.slice(0, 2).join(""));
    expect(document.querySelector("[data-gap]")!.textContent).toBe(units.slice(0, 2).join(""));
    expect(forming().textContent).not.toMatch(/written on the left/);
    tap([units[2]]);
    expect(forming().textContent).toContain(units.slice(0, 3).join(""));
    expect(forming().textContent).toMatch(/written on the left/);
  });

  it("says each piece's name as it is chosen — a person's recording where there is one", async () => {
    await toSpelling();
    for (const q of spells.slice(0, 2)) {
      trace(spellingUnits(q.word));
      await advance();
    }
    const units = spellingUnits(spells[2].word);
    const clip = "a".repeat(64);
    UnitVoices.reset({ [units[1]]: clip });
    vi.mocked(say).mockClear();
    tap([units[0]]);
    expect(say).toHaveBeenLastCalledWith(unitName(units[0]), "km", undefined);
    tap([units[1]]);
    expect(say).toHaveBeenLastCalledWith(unitName(units[1]), "km", clip);
    UnitVoices.reset();
  });

  it("names the next piece in the hint, following the trace", async () => {
    await toSpelling();
    for (const q of spells.slice(0, 2)) {
      trace(spellingUnits(q.word));
      await advance();
    }
    const units = spellingUnits(spells[2].word);
    fireEvent.click(screen.getByRole("button", { name: "Hint (1 of 3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Hint (2 of 3)" }));
    expect(screen.getByText(new RegExp(`^Next: `)).textContent).toContain(units[0]);
    // The suggested tile is the first unit.
    expect(tile(units[0]).getAttribute("aria-label")).toMatch(/suggested/);
    fireEvent.click(screen.getByRole("button", { name: "Hint (3 of 3)" }));
    expect(screen.getByText(/^The word is/).textContent).toContain(unitCue(units[1]));
  });
});
