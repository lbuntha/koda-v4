import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_PUZZLES } from "../fixtures/samplePuzzles";
import { GroupAPI } from "./groupApi";
import { GroupFinal } from "./GroupFinal";
import { GroupPlay } from "./GroupPlay";
import { DEFAULT_SETTINGS } from "../settings";
import { useGroupLearning } from "./useGroupLearning";
import type { RoomPlayer, RoomView } from "./types";

vi.mock("./groupApi", () => ({ GroupAPI: { solve: vi.fn() } }));
vi.mock("../../utils/audio", () => ({ isVoiceEnabled: () => false, playSound: () => {} }));
const api = vi.mocked(GroupAPI);

const puzzle = SAMPLE_PUZZLES.find((p) => p.answer === "Hot dog")!;
const NOW = 1_700_000_000_000;

const player = (pid: string, name: string, over: Partial<RoomPlayer> = {}): RoomPlayer => ({ pid, name, avatar: "tiger", score: 0, solved: 0, isHost: pid === "me", isKodaUser: false, connected: true, ...over });

const room = (over: Partial<RoomView> = {}): RoomView => ({
  code: "ABC234",
  status: "playing",
  locked: true,
  settings: { category: "food", count: 3, difficulty: null, maxPlayers: 4, hintDelaySec: 15, puzzleLimitSec: 60, hintRungs: 3, pointsPerPuzzle: 3, hintCost: 1 },
  players: [player("me", "Brave Tiger"), player("fox", "Clever Fox")],
  me: { pid: "me", isHost: true, isKodaUser: false },
  nowMs: NOW,
  total: 3,
  index: 0,
  puzzle,
  startMs: NOW,
  limitMs: 60_000,
  endedMs: null,
  ...over,
});

const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(20)));
const apply = vi.fn();
const mount = (r: RoomView) => render(<GroupPlay room={r} token="tok" skewMs={0} apply={apply} />);
const type = (text: string) => {
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(NOW + 1_000);
  api.solve.mockReset();
  apply.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("a puzzle in a group race", () => {
  it("counts down before the puzzle, on the server's clock", () => {
    vi.setSystemTime(NOW - 2_500);
    mount(room());
    expect(screen.getByText("Get ready!")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.queryByLabelText("Your answer")).toBeNull();
    act(() => void vi.advanceTimersByTime(3_000));
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
  });

  it("puts the cursor in the answer box and does not send a wrong answer", () => {
    mount(room());
    expect(document.activeElement).toBe(screen.getByLabelText("Your answer"));
    type("nonsense");
    expect(api.solve).not.toHaveBeenCalled();
    expect(screen.getByText("Not quite")).toBeTruthy();
  });

  it("claims the puzzle with the right answer and says so when it was first", async () => {
    api.solve.mockResolvedValue({ won: true, points: 3, room: room({ endedMs: NOW + 5_000, revealUntilMs: NOW + 10_000, result: { index: 0, winnerPid: "me", points: 3, hints: 0, atMs: 5_000 } }) });
    mount(room());
    type("hot dog");
    await flush();
    expect(api.solve).toHaveBeenCalledWith("ABC234", "tok", 0, 0);
    expect(apply).toHaveBeenCalled();
  });

  it("tells the player who was first when they were too late", async () => {
    api.solve.mockResolvedValue({ won: false, points: 0, room: room({ endedMs: NOW + 900, revealUntilMs: NOW + 6_000, result: { index: 0, winnerPid: "fox", points: 3, hints: 0, atMs: 900 } }) });
    mount(room());
    type("Hot dog");
    await flush();
    expect(screen.getByText("So close! Someone else answered first.")).toBeTruthy();
  });

  it("shows who won the puzzle, the answer and why, with the next puzzle coming", () => {
    mount(room({ endedMs: NOW + 700, revealUntilMs: NOW + 5_700, result: { index: 0, winnerPid: "fox", points: 2, hints: 1, atMs: 700 } }));
    expect(screen.getByText("Clever Fox got it first!")).toBeTruthy();
    expect(screen.getByText("+2 points")).toBeTruthy();
    expect(screen.getByText("Hot dog")).toBeTruthy();
    expect(screen.getByText(/Next puzzle in/)).toBeTruthy();
    expect(screen.queryByLabelText("Your answer")).toBeNull();
  });

  it("says nobody got it when the time ran out", () => {
    mount(room({ endedMs: NOW + 60_000, revealUntilMs: NOW + 65_000, result: { index: 0, winnerPid: null, points: 0, hints: 0, atMs: 60_000 } }));
    expect(screen.getByText("Nobody got it this time.")).toBeTruthy();
  });

  it("unlocks a hint after the owner's delay, and sends how many were taken with the claim", async () => {
    api.solve.mockResolvedValue({ won: true, points: 2, room: room() });
    mount(room());
    expect((screen.getByRole("button", { name: /Hint in/ }) as HTMLButtonElement).disabled).toBe(true);
    act(() => void vi.advanceTimersByTime(15_000));
    fireEvent.click(screen.getByRole("button", { name: /Hint 1 of 3/ }));
    expect(screen.getByText(/Category: food/)).toBeTruthy();
    type("Hot dog");
    await flush();
    expect(api.solve).toHaveBeenCalledWith("ABC234", "tok", 0, 1);
  });

  it("lets the player answer again if the claim did not get through", async () => {
    api.solve.mockRejectedValueOnce(new Error("offline"));
    mount(room());
    type("Hot dog");
    await flush();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("Your answer") as HTMLInputElement).disabled).toBe(false);
  });

  it("shows everyone's score, with the leader marked", () => {
    mount(room({ players: [player("me", "Brave Tiger", { score: 2 }), player("fox", "Clever Fox", { score: 5 })] }));
    const list = screen.getByRole("list", { name: "Scores" });
    expect(list.textContent).toContain("5");
    expect(list.textContent).toContain("2");
  });
});

describe("the end of a race", () => {
  const done = (me: string): RoomView =>
    room({
      status: "finished",
      puzzle: undefined,
      me: { pid: me, isHost: me === "me", isKodaUser: false },
      players: [player("me", "Brave Tiger", { score: 4 }), player("fox", "Clever Fox", { score: 7 })],
      standings: [
        { pid: "fox", place: 1, score: 7 },
        { pid: "me", place: 2, score: 4 },
      ],
    });

  it("names the winner, lists the places, and lets only the host run it again", () => {
    const again = vi.fn();
    const { unmount } = render(<GroupFinal room={done("me")} onAgain={again} onLeave={() => {}} />);
    expect(screen.getByText("Clever Fox wins!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(again).toHaveBeenCalled();
    unmount();
    render(<GroupFinal room={done("fox")} onAgain={again} onLeave={() => {}} />);
    expect(screen.getByText("You won!")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play again" })).toBeNull();
    expect(screen.getByText("Waiting for the host to play again…")).toBeTruthy();
  });
});

describe("the podium and what follows", () => {
  const three = (over: Partial<RoomView> = {}): RoomView =>
    room({
      status: "finished",
      puzzle: undefined,
      players: [player("me", "Brave Tiger", { score: 4 }), player("fox", "Clever Fox", { score: 7 }), player("owl", "Quiet Owl", { score: 4 }), player("bear", "Mighty Bear", { score: 1 }), player("deer", "Gentle Deer", { score: 0 })],
      standings: [
        { pid: "fox", place: 1, score: 7 },
        { pid: "me", place: 2, score: 4 },
        { pid: "owl", place: 2, score: 4 },
        { pid: "bear", place: 4, score: 1 },
        { pid: "deer", place: 5, score: 0 },
      ],
      ...over,
    });

  it("stands the top three on steps, a tie on the same step, and lists the rest below", () => {
    render(<GroupFinal room={three()} onAgain={() => {}} onLeave={() => {}} />);
    const podium = screen.getByRole("list", { name: "The podium" });
    expect(podium.textContent).toContain("Clever Fox");
    expect(podium.querySelectorAll("[aria-label='Place 2']")).toHaveLength(1);
    expect(podium.textContent).toContain("Quiet Owl");
    expect(podium.textContent).not.toContain("Mighty Bear");
    expect(screen.getByRole("list", { name: "Final results" }).textContent).toContain("Mighty Bear");
  });

  it("offers a guest a note to show a grown-up, and a signed-in player nothing to ask", () => {
    const { unmount } = render(<GroupFinal room={three()} onAgain={() => {}} onLeave={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask a grown-up" }));
    expect(screen.getByText(/I played Rebus Rush on Koda/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    unmount();
    render(<GroupFinal room={three({ me: { pid: "me", isHost: true, isKodaUser: true } })} onAgain={() => {}} onLeave={() => {}} />);
    expect(screen.queryByRole("button", { name: "Ask a grown-up" })).toBeNull();
  });

  describe("the learning log and XP", () => {
    beforeEach(() => localStorage.clear());
    const playing = (index: number, p = puzzle) => room({ me: { pid: "me", isHost: true, isKodaUser: true }, index, puzzle: p });
    const finished = (): RoomView =>
      room({
        status: "finished",
        puzzle: undefined,
        me: { pid: "me", isHost: true, isKodaUser: true },
        results: [{ index: 0, winnerPid: "me", points: 3, hints: 0, atMs: 9000 }],
        standings: [{ pid: "me", place: 1, score: 3 }],
      });

    it("pays a signed-in player once for a new game, and nothing for a game of puzzles already played", () => {
      const award = vi.fn();
      const { rerender, result } = renderHook(({ r }) => useGroupLearning(r, { settings: DEFAULT_SETTINGS, onAwardXp: award }), { initialProps: { r: playing(0) } });
      rerender({ r: finished() });
      rerender({ r: finished() });
      expect(award).toHaveBeenCalledTimes(1);
      expect(award.mock.calls[0][0]).toBeGreaterThan(0);
      expect(result.current?.replay).toBe(false);

      // The same puzzle again, in a new game: practice, so no XP.
      rerender({ r: { ...playing(0), status: "lobby", puzzle: undefined } });
      rerender({ r: playing(0) });
      rerender({ r: finished() });
      expect(award).toHaveBeenCalledTimes(1);
      expect(result.current?.replay).toBe(true);
      expect(result.current?.xp).toBe(0);
    });

    it("records nothing for a guest", () => {
      const award = vi.fn();
      const guest = (r: RoomView): RoomView => ({ ...r, me: { ...r.me, isKodaUser: false } });
      const { rerender, result } = renderHook(({ r }) => useGroupLearning(r, { settings: DEFAULT_SETTINGS, onAwardXp: award }), { initialProps: { r: guest(playing(0)) } });
      rerender({ r: guest(finished()) });
      expect(award).not.toHaveBeenCalled();
      expect(result.current).toBeNull();
    });
  });
});
