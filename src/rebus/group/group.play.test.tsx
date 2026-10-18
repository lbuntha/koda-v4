import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_PUZZLES } from "../fixtures/samplePuzzles";
import { GroupAPI } from "./groupApi";
import { GroupFinal } from "./GroupFinal";
import { GroupPlay } from "./GroupPlay";
import type { RoomPlayer, RoomView } from "./types";

vi.mock("./groupApi", () => ({ GroupAPI: { solve: vi.fn() } }));
vi.mock("../../utils/audio", () => ({ playSound: () => {} }));
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
