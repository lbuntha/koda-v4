import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningLog } from "../lib/learning";
import { LibraryPage } from "./LibraryPage";
import { LibraryProgress } from "./progress";
import { STARTER_PASSAGES } from "./data/starterPassages";

/**
 * A child's whole visit, driven by what is on screen: open the library, pick a
 * book, read it, answer every question — one wrong, one with a hint — spell the
 * words on the ring, and land on results. The learning log is read at the end to
 * check the round was recorded the way a lesson would be.
 *
 * Reduced motion (kit/testing/setup.ts) means the ring is drawn from state and a
 * drag is "press on one tile's centre, move to the next, lift".
 */

vi.mock("./voice", () => ({ canSpeak: () => false, voiceStatus: () => "no-voice", bookSpeaks: () => false, sentenceSpeaks: () => false, say: vi.fn(async () => {}), stop: vi.fn() }));
vi.mock("./clips", () => ({ prefetchBook: vi.fn(async () => ({ ready: 0, total: 0 })), uploadClip: vi.fn(async () => "c".repeat(64)), pcmToWav: vi.fn(() => new Blob()) }));
const reportBook = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./api", () => ({ reportBook, fetchPublished: vi.fn(async () => { throw new Error("offline"); }) }));
vi.mock("../assets/svg", () => ({ SvgAsset: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback}</>, SvgMarkup: () => null }));
const playSound = vi.hoisted(() => vi.fn());
vi.mock("../utils/audio", () => ({ playSound }));

const MARKET = STARTER_PASSAGES[0];

beforeEach(() => {
  localStorage.clear();
  LibraryProgress.clear();
  playSound.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

const tiles = (label: string) => [...document.querySelectorAll<SVGGElement>("[data-wheel-tile]")].filter((g) => g.getAttribute("aria-label")?.split(",")[0] === label);
const centre = (g: SVGGElement) => {
  const m = g.getAttribute("transform")!.match(/translate\(([\d.-]+) ([\d.-]+)\)/)!;
  return { clientX: Number(m[1]), clientY: Number(m[2]) };
};
function traceWord(letters: string[]) {
  const svg = document.querySelector("[data-letter-wheel] svg")!;
  // A repeated letter (SWEET has two Es) takes the next tile with that label.
  const used: Record<string, number> = {};
  const pts = letters.map((l) => centre(tiles(l)[(used[l] = (used[l] ?? -1) + 1)]));
  fireEvent.pointerDown(svg, { ...pts[0], pointerId: 1, button: 0, pointerType: "touch" });
  for (const p of pts.slice(1)) fireEvent.pointerMove(svg, { ...p, pointerId: 1, pointerType: "touch" });
  fireEvent.pointerUp(svg, { ...pts[pts.length - 1], pointerId: 1, pointerType: "touch" });
}
const advance = async (ms = 1100) => { await act(async () => { vi.advanceTimersByTime(ms); }); };

describe("the catalog", () => {
  it("shows the English books by default, grouped on shelves", () => {
    render(<LibraryPage />);
    expect(screen.getByRole("heading", { name: "Library" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^At the Market\. Level A\. New\./ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^A Rainy Day\. Level B\. New\./ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /នៅផ្សារ/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Food" })).toBeTruthy();
  });

  it("switches language, and remembers it", () => {
    const { unmount } = render(<LibraryPage />);
    fireEvent.click(screen.getByRole("button", { name: "ភាសាខ្មែរ" }));
    expect(screen.getByRole("button", { name: /^នៅផ្សារ\./ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^At the Market/ })).toBeNull();
    unmount();
    render(<LibraryPage />);
    expect(screen.getByRole("button", { name: /^នៅផ្សារ\./ })).toBeTruthy();
  });

  it("searches by title and filters by category", () => {
    render(<LibraryPage />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search books" }), { target: { value: "rain" } });
    expect(screen.getByRole("heading", { name: /Results for “rain”/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^At the Market/ })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search books" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Weather & play" }));
    expect(screen.queryByRole("heading", { name: "Food" })).toBeNull();
  });
});

describe("a whole book, as a child plays it", () => {
  it("reads, answers, spells and lands on results — and records it all", async () => {
    const onAwardXp = vi.fn();
    render(<LibraryPage onAwardXp={onAwardXp} />);

    // Catalog → book page
    fireEvent.click(screen.getByRole("button", { name: /^At the Market\./ }));
    expect(screen.getByRole("heading", { name: "At the Market" })).toBeTruthy();
    expect(screen.getByText("Understand — 2 questions")).toBeTruthy();

    // Book → reader, a book opened at its cover. No voice on this device: no Read to me.
    fireEvent.click(screen.getByRole("button", { name: "Read" }));
    expect(screen.queryByRole("button", { name: "Read to me" })).toBeNull();
    expect(screen.getByRole("group", { name: "Cover" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "mango" })); // bold: the quiz asks about it
    expect(screen.getByText("Picture word · tap the speaker to hear it")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Check My Learning" }));

    // Understand 1: one wrong answer first. It stays, locked and marked — and
    // each answer has its own sound, not the page-turn one BookReader just used.
    expect(screen.getByText("Where did they walk after the market?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "To the market" }));
    expect(playSound).toHaveBeenLastCalledWith("error");
    const wrong = screen.getByRole("button", { name: "✕ To the market" }) as HTMLButtonElement;
    expect(wrong.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(playSound).toHaveBeenLastCalledWith("success");
    await advance();

    // Understand 2: take two hints; the second opens the story at the evidence.
    fireEvent.click(screen.getByRole("button", { name: "Hint (1 of 3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Hint (2 of 3)" }));
    const sheet = screen.getByRole("dialog", { name: /Read again/ });
    expect(within(sheet).getByText("◂ Look here").closest("li")!.textContent).toContain("The mango is sweet.");
    fireEvent.click(within(sheet).getByRole("button", { name: /Close/ }));
    fireEvent.click(screen.getByRole("button", { name: "The mango" }));
    expect(playSound).toHaveBeenLastCalledWith("success");
    await advance();

    // Words: pictures, named for a screen reader.
    fireEvent.click(screen.getByRole("button", { name: "banana" }));
    expect(playSound).toHaveBeenLastCalledWith("success");
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "market" }));
    await advance();

    // Spell: the story sentence with a gap, on the ring. One wrong trace first.
    expect(screen.getByText("Finish the sentence")).toBeTruthy();
    traceWord(["M", "A", "R"]);
    expect(playSound).toHaveBeenLastCalledWith("error");
    traceWord(["M", "A", "R", "K", "E", "T"]);
    expect(playSound).toHaveBeenLastCalledWith("success");
    await advance();
    traceWord(["M", "A", "N", "G", "O"]);
    await advance();
    traceWord(["S", "W", "E", "E", "T"]);
    await advance();

    // Results
    expect(screen.getByRole("heading", { name: /You finished “At the Market”/ })).toBeTruthy();
    expect(screen.getByText(/Read “At the Market” \(English\)\. Understood 0\/2, matched 2\/2/)).toBeTruthy();
    expect(onAwardXp).toHaveBeenCalledTimes(1);
    expect(LibraryProgress.get(MARKET.id, MARKET.rev)?.stage).toBe("done");

    fireEvent.click(screen.getByRole("button", { name: "Back to the library" }));
    expect(screen.getByRole("button", { name: /^At the Market\. Level A\. Finished ✓/ })).toBeTruthy();

    // The round is in the learning log exactly as a lesson's would be.
    const events = LearningLog.all({ skillId: "koda-library" });
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("lesson_started");
    expect(types.filter((t) => t === "question_presented")).toHaveLength(7);
    expect(types.at(-1)).toBe("lesson_completed");
    const answers = events.filter((e) => e.type === "answer_submitted") as Array<{ correct: boolean; given?: string; expected?: string }>;
    expect(answers.filter((a) => !a.correct).map((a) => a.given)).toEqual(["To the market", "MAR"]);
    expect(answers.filter((a) => a.correct)).toHaveLength(7);
    expect(events.filter((e) => e.type === "support_used")).toHaveLength(3); // two hints + the story opened at the evidence
    expect(events.every((e) => e.lessonId === "starter-market@1" && e.conceptKey === "read-and-answer")).toBe(true);
  });
});

describe("reporting a book", () => {
  it("sends the book, its revision and the reason, and thanks the reader", async () => {
    render(<LibraryPage />);
    fireEvent.click(screen.getByRole("button", { name: /^At the Market\./ }));
    fireEvent.click(screen.getByRole("button", { name: "Report a problem with this book" }));
    fireEvent.click(screen.getByRole("radio", { name: "Something in the story is wrong" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Anything to add/ }), { target: { value: "Sokha is a boy's name here" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send report" })); });
    expect(reportBook).toHaveBeenCalledWith("starter-market", 1, "wrong_in_story", "Sokha is a boy's name here");
    expect(screen.getByText(/Thank you/)).toBeTruthy();
  });

  it("says so when it cannot be sent, rather than pretending it was", async () => {
    reportBook.mockRejectedValueOnce(new Error("offline"));
    render(<LibraryPage />);
    fireEvent.click(screen.getByRole("button", { name: /^At the Market\./ }));
    fireEvent.click(screen.getByRole("button", { name: "Report a problem with this book" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send report" })); });
    expect(screen.getByRole("alert").textContent).toMatch(/could not be sent/);
  });
});

describe("the reader is a book", () => {
  const openBook = () => {
    render(<LibraryPage />);
    fireEvent.click(screen.getByRole("button", { name: /^At the Market\./ }));
    fireEvent.click(screen.getByRole("button", { name: "Read" }));
  };
  const onPage = () => document.querySelector("[data-book-page]")?.getAttribute("data-book-page");

  it("shows one page at a time, and Quiz only on the last", () => {
    openBook();
    expect(screen.getByRole("heading", { name: "At the Market" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Check My Learning" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(screen.queryByText(/The mango is sweet/)).toBeNull(); // on the next page, not this one
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("The end")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    expect(screen.getByRole("button", { name: "Check My Learning" })).toBeTruthy();
  });

  it("turns with the arrow keys and with a swipe, but not with a small wobble", () => {
    openBook();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onPage()).toBe("1");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onPage()).toBe("0");
    const book = screen.getByRole("region", { name: "At the Market" });
    const swipe = (from: number, to: number) => {
      fireEvent.pointerDown(book, { clientX: from, clientY: 200, pointerId: 1, button: 0 });
      fireEvent.pointerMove(book, { clientX: to, clientY: 204, pointerId: 1 });
      fireEvent.pointerUp(book, { clientX: to, clientY: 204, pointerId: 1 });
    };
    swipe(300, 290);
    expect(onPage()).toBe("0");
    swipe(300, 150);
    expect(onPage()).toBe("1");
    swipe(150, 300);
    expect(onPage()).toBe("0");
  });

  it("lets the reader make the text larger or smaller, and remembers it", () => {
    openBook();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    const size = () => document.querySelector("[data-book-page] p")?.getAttribute("data-text-scale");
    expect(size()).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Larger text" }));
    fireEvent.click(screen.getByRole("button", { name: "Larger text" }));
    expect(size()).toBe("1.3");
    expect(localStorage.getItem("koda_library_text_v1")).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "Smaller text" }));
    expect(size()).toBe("1.15");
  });

  it("sets quiz words in bold and names in italic", () => {
    openBook();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("button", { name: "market" }).className).toMatch(/font-bold/);
    expect(screen.getByText("Sokha").className).toMatch(/italic/);
    expect(screen.queryByText(/words come up in the quiz/)).toBeNull();
  });
});
