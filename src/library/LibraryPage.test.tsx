import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningLog } from "../lib/learning";
import { LibraryPage } from "./LibraryPage";
import { LibraryProgress } from "./progress";
import { STARTER_PASSAGES } from "./data/starterPassages";
import { BookStore } from "./bookStore";

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
    fireEvent.click(screen.getByRole("button", { name: /^Book language/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "ភាសាខ្មែរ" }));
    expect(screen.getByRole("button", { name: /^នៅផ្សារ\./ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^At the Market/ })).toBeNull();
    unmount();
    render(<LibraryPage />);
    expect(screen.getByRole("button", { name: /^នៅផ្សារ\./ })).toBeTruthy();
  });

  it("puts a book to start in the banner, and opens it", () => {
    render(<LibraryPage />);
    const banner = screen.getByRole("region", { name: "A new story for you" });
    fireEvent.click(within(banner).getByRole("button", { name: "Start reading" }));
    expect(screen.getByRole("button", { name: "Read" })).toBeTruthy();
  });

  it("says when a language has no stories, and offers the one that does", () => {
    BookStore.reset([STARTER_PASSAGES[2]]); // the Khmer book only
    try {
      render(<LibraryPage />);
      expect(screen.getByRole("heading", { name: "No English stories yet" })).toBeTruthy();
      expect(screen.queryByRole("searchbox")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Read in ភាសាខ្មែរ · 1 story/ }));
      expect(screen.getByRole("button", { name: /^នៅផ្សារ\./ })).toBeTruthy();
    } finally {
      BookStore.reset([]);
    }
  });

  it("says a search found nothing, and clears it", () => {
    render(<LibraryPage />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search books" }), { target: { value: "zebra" } });
    expect(screen.getByRole("heading", { name: "No books match “zebra”" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
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

    // The next unread story in the same language is one tap away.
    expect(screen.getByRole("button", { name: "Next story: A Rainy Day" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to the library" }));
    expect(screen.getByRole("button", { name: /^At the Market\. Level A\. Finished ✓/ })).toBeTruthy();

    // The reading is traced page by page, ahead of the quiz, in the same log.
    const all = LearningLog.all({ skillId: "koda-library" });
    const reading = all.filter((e) => e.activityId === "reading");
    expect(reading.map((e) => e.type)).toEqual(["reading_started", "page_read", "page_read", "reading_finished"]);
    const pages = reading.filter((e) => e.type === "page_read") as Array<{ page: number; wordsTapped: string[]; readId: string }>;
    expect(pages.map((p) => p.page)).toEqual([1, 2]);
    expect(pages[0].wordsTapped).toEqual(["mango"]);
    expect(new Set(reading.map((e) => (e as { readId?: string }).readId)).size).toBe(1);
    expect(all.findIndex((e) => e.type === "reading_finished")).toBeLessThan(all.findIndex((e) => e.type === "lesson_started"));

    // The round is in the learning log exactly as a lesson's would be.
    const events = all.filter((e) => e.activityId === "passage");
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

describe("the matching question's answer order", () => {
  it("is the same every time for one question, and never the order the answers were written in", async () => {
    const { matchOrder } = await import("./LibraryPage");
    for (const id of ["m1", "m2", "m3", "q-longer-id"]) {
      for (const n of [3, 4, 5]) {
        const order = matchOrder(id, n);
        expect(matchOrder(id, n)).toEqual(order);
        expect([...order].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
        expect(order).not.toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });
});

describe("a matching set in the quiz", () => {
  it("joins a question to its answer, marks a wrong pairing, and moves on when all are joined", async () => {
    const set = {
      id: "m1",
      kind: "match" as const,
      prompt: "Match each question to its answer.",
      pairs: [
        { left: "Where does Sokha go?", right: "the market" },
        { left: "What is sweet?", right: "the mango" },
        { left: "How do they get home?", right: "walk" },
      ],
    };
    MARKET.questions.push(set);
    try {
      render(<LibraryPage />);
      fireEvent.click(screen.getByRole("button", { name: /^At the Market\./ }));
      expect(screen.getByText("Match — 1 set of questions and answers")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Read" }));
      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      fireEvent.click(screen.getByRole("button", { name: "Check My Learning" }));
      fireEvent.click(screen.getByRole("button", { name: "Home" }));
      await advance();
      fireEvent.click(screen.getByRole("button", { name: "The mango" }));
      await advance();

      // The matching set comes after Understand.
      expect(screen.getByText("Match each question to its answer.")).toBeTruthy();
      // A wrong pairing: marked, then let go — nothing is joined.
      fireEvent.click(screen.getByRole("button", { name: "Where does Sokha go?" }));
      fireEvent.click(screen.getByRole("button", { name: "walk" }));
      expect(playSound).toHaveBeenLastCalledWith("error");
      await advance(700);
      // Right pairings, starting from either side.
      fireEvent.click(screen.getByRole("button", { name: "Where does Sokha go?" }));
      fireEvent.click(screen.getByRole("button", { name: "the market" }));
      expect((screen.getByRole("button", { name: /Where does Sokha go\?/ }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "the mango" }));
      fireEvent.click(screen.getByRole("button", { name: "What is sweet?" }));
      fireEvent.click(screen.getByRole("button", { name: "How do they get home?" }));
      fireEvent.click(screen.getByRole("button", { name: "walk" }));
      expect(playSound).toHaveBeenLastCalledWith("success");
      await advance();

      // On to Words.
      expect(screen.getByRole("button", { name: "banana" })).toBeTruthy();
    } finally {
      MARKET.questions.pop();
    }
  });
});
