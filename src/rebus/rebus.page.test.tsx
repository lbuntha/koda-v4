import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_PUZZLES } from "./fixtures/samplePuzzles";
import { DEFAULT_SETTINGS } from "./settings";
import { RebusEntry } from "./ui/RebusEntry";

/** Two food puzzles, so the round is short and the puzzle on screen is known. */
const emptyBank = vi.hoisted(() => ({ on: false, loaded: false }));
vi.mock("./bankStore", () => ({ refreshBank: vi.fn(async () => undefined) }));
vi.mock("./bank", () => {
  const puzzles = SAMPLE_PUZZLES.filter((p) => p.answer === "Hot dog" || p.answer === "Honeymoon");
  const bank = { puzzles, counts: { countries: 0, food: puzzles.length, sayings: 0, animals: 0, sports: 0, school: 0, science: 0 }, loaded: true };
  return {
    useRebusBank: () => (emptyBank.on ? { puzzles: [], counts: { ...bank.counts, food: 0 }, loaded: emptyBank.loaded } : bank),
    bankForAge: (b: typeof bank) => b,
  };
});
const played = vi.hoisted(() => vi.fn());
vi.mock("../utils/audio", () => ({ playSound: played }));

import { RebusPage } from "./RebusPage";

let nowMs = 1_000;
const advance = (seconds: number) =>
  act(() => {
    nowMs += seconds * 1000;
    vi.advanceTimersByTime(seconds * 1000);
  });

beforeEach(() => {
  emptyBank.on = false;
  played.mockClear();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
  vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

const startFood = () => {
  fireEvent.click(screen.getByRole("button", { name: /Food/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
};
const typeAnswer = (text: string) => {
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
};
/** The answer of whichever puzzle is on screen, read from the pictures' own names. */
const currentAnswer = (): string => {
  const names = [...screen.getByRole("group", { name: "Puzzle" }).querySelectorAll("[role=img]")].map((n) => n.getAttribute("aria-label"));
  return names.join("") === "honeymoon" ? "Honeymoon" : "Hot dog";
};

describe("Rebus Rush", () => {
  it("opens on a topic choice, with the topics that have no puzzles yet marked as soon", () => {
    render(<RebusPage />);
    expect(screen.getByRole("heading", { name: "Rebus Rush" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Food/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: /Sports/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("Soon").length).toBeGreaterThan(0);
  });

  it("plays a round: a wrong answer, a right one, the reveal, the next puzzle, and the summary", () => {
    render(<RebusPage />);
    startFood();

    expect(screen.getByText("Puzzle 1 of 2")).toBeTruthy();
    typeAnswer("nonsense");
    expect(screen.getByText("Not quite")).toBeTruthy();

    typeAnswer(currentAnswer());
    expect(screen.getByText("You got it!")).toBeTruthy();
    expect(screen.getByText("+3 points")).toBeTruthy();
    expect(screen.getByText("Why?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next puzzle" }));
    expect(screen.getByText("Puzzle 2 of 2")).toBeTruthy();

    typeAnswer(currentAnswer());
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(screen.getByText("You beat the Machine!")).toBeTruthy();
    expect(screen.getByText("2/2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play again" })).toBeTruthy();
  });

  it("unlocks a hint after the owner's delay, then shows it", () => {
    render(<RebusPage />);
    startFood();
    const hint = () => screen.getByRole("button", { name: /Hint/ }) as HTMLButtonElement;

    expect(hint().textContent).toContain("Hint in 15s");
    expect(hint().disabled).toBe(true);

    advance(15);
    expect(hint().textContent).toContain("Hint 1 of 3");
    expect(hint().disabled).toBe(false);

    fireEvent.click(hint());
    expect(screen.getByText("Category: food")).toBeTruthy();
    expect(hint().disabled).toBe(true);
  });

  it("follows a shorter hint delay set by the owner", () => {
    render(<RebusPage settings={{ ...DEFAULT_SETTINGS, hintDelaySec: 5 }} />);
    startFood();
    advance(5);
    expect((screen.getByRole("button", { name: /Hint/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("gives the point to the Machine, or to nobody, when the child does not answer in time", () => {
    render(<RebusPage settings={{ ...DEFAULT_SETTINGS, puzzleLimitSec: 30, machineLock: 0 }} />);
    startFood();
    advance(120);
    const out = screen.queryByText("Time is up") ?? screen.queryByText("Machine got it first");
    expect(out).toBeTruthy();
    expect(screen.getByText("Why?")).toBeTruthy();
  });

  it("lets a child skip a puzzle and moves on without a score", () => {
    render(<RebusPage />);
    startFood();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Skipped")).toBeTruthy();
    expect(screen.getByText("Nobody scores this one.")).toBeTruthy();
  });

  it("shows the Machine's level as a fact, not a choice, when the owner has fixed it", () => {
    render(<RebusPage settings={{ ...DEFAULT_SETTINGS, machineLock: 2 }} />);
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    expect(screen.queryByRole("tab", { name: "Adaptive" })).toBeNull();
    expect(screen.getByText("Hard")).toBeTruthy();
  });

  it("offers letter tiles instead of a keyboard when the owner turns them on", () => {
    render(<RebusPage settings={{ ...DEFAULT_SETTINGS, letterTiles: true }} />);
    startFood();
    expect(screen.queryByRole("textbox")).toBeNull();
    const answer = currentAnswer().toLowerCase().replace(/\s/g, "");
    for (const letter of answer) {
      const tile = screen.getAllByRole("button").find((b) => b.textContent === letter && !(b as HTMLButtonElement).disabled);
      expect(tile, `tile ${letter}`).toBeTruthy();
      fireEvent.click(tile!);
    }
    expect(screen.getByText("You got it!")).toBeTruthy();
  });

  it("tells Learn when a round is being played, so it can step aside", () => {
    const deep = vi.fn();
    render(<RebusPage onDeepChange={deep} />);
    expect(deep).toHaveBeenLastCalledWith(false);
    startFood();
    expect(deep).toHaveBeenLastCalledWith(true);
  });

  it("goes back to the shelf from setup", () => {
    const exit = vi.fn();
    render(<RebusPage onExit={exit} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(exit).toHaveBeenCalled();
  });
});

describe("sound", () => {
  const sounds = () => played.mock.calls.map((c) => c[0]);

  it("pops when the round starts, and again for each choice made on the way", () => {
    render(<RebusPage />);
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    expect(sounds()).toEqual(["pop"]);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(sounds()).toEqual(["pop", "pop"]);
  });

  it("sounds an error for a wrong answer and a success for the right one, once each", () => {
    render(<RebusPage />);
    startFood();
    played.mockClear();
    typeAnswer("nonsense");
    expect(sounds()).toEqual(["error"]);
    played.mockClear();
    typeAnswer(currentAnswer());
    expect(sounds()).toEqual(["success"]);
  });

  it("chimes when a hint unlocks and again when it is taken", () => {
    render(<RebusPage />);
    startFood();
    played.mockClear();
    advance(15);
    expect(sounds()).toContain("pop");
    played.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Hint 1 of 3/ }));
    expect(sounds()).toEqual(["hint"]);
  });

  it("is a soft clink, not an error, when the Machine or the clock wins", () => {
    render(<RebusPage settings={{ ...DEFAULT_SETTINGS, machineLock: 2, puzzleLimitSec: 30 }} />);
    startFood();
    played.mockClear();
    advance(120);
    expect(sounds()).toContain("clink");
    expect(sounds()).not.toContain("error");
  });

  it("plays a fanfare for a round won and a clink for one lost", () => {
    render(<RebusPage />);
    startFood();
    typeAnswer(currentAnswer());
    fireEvent.click(screen.getByRole("button", { name: "Next puzzle" }));
    typeAnswer(currentAnswer());
    played.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(sounds()).toEqual(["levelup"]);
  });

  it("makes no sound at all of its own when the family has turned sound off: that switch lives in playSound", () => {
    render(<RebusPage />);
    expect(played).not.toHaveBeenCalled();
  });
});

describe("with nothing to play", () => {
  it("asks a device that has never downloaded the puzzles to connect once, and can try again", async () => {
    const { refreshBank } = await import("./bankStore");
    emptyBank.on = true;
    emptyBank.loaded = false;
    render(<RebusPage />);
    expect(screen.getByText("Getting the puzzles ready")).toBeTruthy();
    expect(screen.getByText(/connect to the internet, then try again/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refreshBank).toHaveBeenCalledWith({ force: true });
    await act(async () => undefined);
  });

  it("says plainly when the server has nothing published", () => {
    emptyBank.on = true;
    emptyBank.loaded = true;
    render(<RebusPage />);
    expect(screen.getByText("No puzzles yet")).toBeTruthy();
    expect(screen.queryByText("Getting the puzzles ready")).toBeNull();
  });

  it("can go back to the shelf from the empty screen", () => {
    const exit = vi.fn();
    emptyBank.on = true;
    render(<RebusPage onExit={exit} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(exit).toHaveBeenCalled();
  });
});

describe("the entry card", () => {
  it("opens Rebus Rush from the Think shelf", () => {
    const open = vi.fn();
    render(<RebusEntry onOpen={open} />);
    fireEvent.click(screen.getByRole("button", { name: /Rebus Rush/ }));
    expect(open).toHaveBeenCalled();
  });
});

describe("setup on a phone: a topic, then the options", () => {
  it("goes to the options when a topic is tapped, and back to the topics from there", () => {
    render(<RebusPage settings={DEFAULT_SETTINGS} />);
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "All 2" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Choose another topic" }));
    expect(screen.getByRole("button", { name: /Food/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("filters by what the child has already done, and says how many match", () => {
    localStorage.setItem("koda.rebus.results.v1", JSON.stringify({ [SAMPLE_PUZZLES.find((p) => p.answer === "Hot dog")!.id]: { plays: 2, last: "clean" } }));
    render(<RebusPage settings={DEFAULT_SETTINGS} />);
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    fireEvent.click(screen.getByRole("button", { name: "Filter puzzles" }));
    fireEvent.click(screen.getByRole("tab", { name: "New to me" }));
    expect(screen.getByText("1 puzzles match")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "To retry" }));
    expect(screen.getByText("No puzzles match this filter.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Start" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("playing all of a set", () => {
  it("plays every puzzle once, says it is finished, and offers to replay them all", () => {
    render(<RebusPage settings={DEFAULT_SETTINGS} />);
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    fireEvent.click(screen.getByRole("tab", { name: "All 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    typeAnswer(currentAnswer());
    fireEvent.click(screen.getByRole("button", { name: "Next puzzle" }));
    typeAnswer(currentAnswer());
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(screen.getByText("You played all 2 puzzles!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replay all" }));
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("koda.rebus.results.v1") ?? "{}")).toMatchObject({});
  });
});

describe("answering and moving on", () => {
  it("puts the cursor in the answer box when a puzzle appears", () => {
    render(<RebusPage settings={DEFAULT_SETTINGS} />);
    startFood();
    expect(document.activeElement).toBe(screen.getByLabelText("Your answer"));
  });

  it("waits for Next by default, and moves on by itself when the player chose that", () => {
    const { unmount } = render(<RebusPage settings={DEFAULT_SETTINGS} />);
    startFood();
    typeAnswer(currentAnswer());
    advance(30);
    expect(screen.getByRole("button", { name: "Next puzzle" })).toBeTruthy();
    unmount();

    render(<RebusPage settings={DEFAULT_SETTINGS} />);
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Move on by itself" }));
    expect(localStorage.getItem("koda.rebus.autoNext")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    typeAnswer(currentAnswer());
    expect(screen.getByText(/Moving on in 3 seconds/)).toBeTruthy();
    advance(3);
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
  });
});

describe("who is winning", () => {
  it("says so in words as the score changes, and at the end of the last puzzle", () => {
    render(<RebusPage settings={DEFAULT_SETTINGS} />);
    startFood();
    expect(screen.getByText("All tied up")).toBeTruthy();
    typeAnswer(currentAnswer());
    expect(screen.getByText(/You are ahead by 3|The Machine is ahead by 3/)).toBeTruthy();
  });
});

describe("the finish", () => {
  it("shows who won and who lost, not just the numbers", () => {
    render(<RebusPage settings={DEFAULT_SETTINGS} />);
    startFood();
    typeAnswer(currentAnswer());
    fireEvent.click(screen.getByRole("button", { name: "Next puzzle" }));
    typeAnswer(currentAnswer());
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(screen.getByText(/beat the Machine|Machine wins this time|perfect tie/)).toBeTruthy();
    expect(screen.getAllByText(/Winner|Tied/).length).toBeGreaterThan(0);
  });
});
