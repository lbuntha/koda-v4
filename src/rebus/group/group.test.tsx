import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/sync";
import { SAMPLE_PUZZLES } from "../fixtures/samplePuzzles";
import { DEFAULT_SETTINGS } from "../settings";
import { GroupAPI } from "./groupApi";
import { GroupHome } from "./GroupHome";
import { cleanCode, roomCodeFromUrl } from "./roomLink";
import { loadSeat } from "./seatStore";
import type { RoomPlayer, RoomView, Seat } from "./types";

vi.mock("./groupApi", () => ({
  GroupAPI: { choices: vi.fn(), open: vi.fn(), join: vi.fn(), poll: vi.fn(), start: vi.fn(), lock: vi.fn(), kick: vi.fn(), accept: vi.fn(), decline: vi.fn(), leave: vi.fn(), rematch: vi.fn(), solve: vi.fn() },
}));
const api = vi.mocked(GroupAPI);

const player = (over: Partial<RoomPlayer> = {}): RoomPlayer => ({ pid: "p1", name: "Brave Tiger", avatar: "tiger", score: 0, solved: 0, isHost: true, isKodaUser: true, connected: true, ...over });

const room = (over: Partial<RoomView> = {}, me: Partial<RoomView["me"]> = {}): RoomView => ({
  code: "ABC234",
  status: "lobby",
  locked: false,
  settings: { category: "food", count: 5, difficulty: null, maxPlayers: 4, hintDelaySec: 15, puzzleLimitSec: 60, hintRungs: 3, pointsPerPuzzle: 3, hintCost: 1 },
  players: [player()],
  me: { pid: "p1", isHost: true, isKodaUser: true, ...me },
  nowMs: Date.now(),
  ...over,
});

const seat = (r: RoomView): Seat => ({ playerToken: "tok", room: r });

beforeEach(() => {
  sessionStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  api.poll.mockImplementation(() => new Promise(() => {}));
  api.leave.mockResolvedValue({ status: "left" });
});
afterEach(() => vi.useRealTimers());

const pickWho = (look = "fox", nick = "Clever Fox") => {
  fireEvent.click(screen.getByRole("button", { name: look }));
  fireEvent.click(screen.getByRole("button", { name: nick }));
};

describe("the invitation code", () => {
  it("is forgiving of how it was typed or pasted", () => {
    expect(cleanCode(" koda-ab3 xyz ")).toBe("AB3XYZ");
    expect(cleanCode("abc-234")).toBe("ABC234");
    expect(cleanCode("abc234zzzz")).toBe("ABC234");
  });

  it("is read from the address, only when it is a real code", () => {
    window.history.replaceState({}, "", "/?room=abc234");
    expect(roomCodeFromUrl()).toBe("ABC234");
    window.history.replaceState({}, "", "/?room=nope");
    expect(roomCodeFromUrl()).toBeNull();
    window.history.replaceState({}, "", "/");
  });
});

describe("joining as a guest", () => {
  it("offers joining, and signing in for someone with an account, but not opening a room", () => {
    const signIn = vi.fn();
    render(<GroupHome userToken={null} settings={DEFAULT_SETTINGS} onExit={() => {}} onSignIn={signIn} />);
    expect(screen.queryByRole("button", { name: /Open a room/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "I have a Koda account. Sign in" }));
    expect(signIn).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Join a room/ })).toBeTruthy();
  });

  const lobbyForFox = () =>
    room({ players: [player(), player({ pid: "p2", name: "Clever Fox", avatar: "fox", isHost: false, isKodaUser: false })] }, { pid: "p2", isHost: false, isKodaUser: false });
  const atTheDoor = () => room({ status: "pending", players: [] }, { pid: "p2", isHost: false, isKodaUser: false });

  it("asks to join with the code and a nickname from the list, never a typed name, and waits for the host", async () => {
    api.join.mockResolvedValue(seat(atTheDoor()));
    render(<GroupHome userToken={null} settings={DEFAULT_SETTINGS} initialCode="abc234" onExit={() => {}} />);
    expect(screen.queryByRole("textbox", { name: /name/i })).toBeNull();
    // Not until the player has picked who to be.
    expect((screen.getByRole("button", { name: "Join" }) as HTMLButtonElement).disabled).toBe(true);
    pickWho();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await screen.findByText("Waiting for the host to let you in…");
    expect(api.join).toHaveBeenCalledWith("ABC234", { name: "Clever Fox", avatar: "fox" }, null);
    expect(loadSeat()).toEqual({ code: "ABC234", token: "tok" });
    expect(screen.queryByText("ABC 234")).toBeNull();
  });

  it("comes into the lobby once the host accepts, and then cannot start or remove anyone", async () => {
    api.join.mockResolvedValue(seat(atTheDoor()));
    api.poll.mockResolvedValue(lobbyForFox());
    render(<GroupHome userToken={null} settings={DEFAULT_SETTINGS} initialCode="abc234" onExit={() => {}} />);
    pickWho();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await screen.findByText("ABC 234", {}, { timeout: 4000 });
    expect(screen.getByText("Waiting for the host to start the game…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start the game" })).toBeNull();
  });

  it("tells a child the host did not let them in when the door is shut on them", async () => {
    api.join.mockResolvedValue(seat(atTheDoor()));
    api.poll.mockRejectedValue(new ApiError(403, "not_in_room", "no"));
    render(<GroupHome userToken={null} settings={DEFAULT_SETTINGS} initialCode="abc234" onExit={() => {}} />);
    pickWho();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await screen.findByText("The host did not let you in.", {}, { timeout: 4000 });
  });

  it("greys out a nickname that someone already took and asks for another", async () => {
    api.join.mockRejectedValue(new ApiError(409, "name_taken", "taken"));
    render(<GroupHome userToken={null} settings={DEFAULT_SETTINGS} initialCode="ABC234" onExit={() => {}} />);
    pickWho();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await screen.findByText("Someone already picked that nickname. Pick another.");
    expect((screen.getByRole("button", { name: "Clever Fox" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says why a room cannot be joined", async () => {
    api.join.mockRejectedValue(new ApiError(404, "room_not_found", "x"));
    render(<GroupHome userToken={null} settings={DEFAULT_SETTINGS} initialCode="ABC234" onExit={() => {}} />);
    pickWho();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await screen.findByText("That code does not match an open room.");
  });
});

describe("the host", () => {
  const hosted = () =>
    api.open.mockResolvedValue(seat(room()));

  it("opens a room as a signed-in user and sees the code, but cannot start alone", async () => {
    hosted();
    render(<GroupHome userToken="user-token" settings={DEFAULT_SETTINGS} onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Open a room/ }));
    pickWho("tiger", "Brave Tiger");
    fireEvent.click(screen.getByRole("button", { name: "Open a room" }));
    await screen.findByText("ABC 234");
    expect(api.open).toHaveBeenCalledWith(expect.objectContaining({ category: "countries", name: "Brave Tiger", avatar: "tiger" }), "user-token");
    expect((screen.getByRole("button", { name: "Start the game" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("You need at least 2 players to start.")).toBeTruthy();
  });

  const twoPlayers = () => room({ players: [player(), player({ pid: "p2", name: "Clever Fox", avatar: "fox", isHost: false, isKodaUser: false })] });
  const openAs = async () => {
    render(<GroupHome userToken="user-token" settings={DEFAULT_SETTINGS} onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Open a room/ }));
    pickWho("tiger", "Brave Tiger");
    fireEvent.click(screen.getByRole("button", { name: "Open a room" }));
    await screen.findByText("ABC 234");
  };

  it("shows who is waiting at the door and lets the host accept or decline", async () => {
    const knocking = room({ requests: [{ pid: "p9", name: "Clever Fox", avatar: "fox", isKodaUser: false }] });
    api.open.mockResolvedValue(seat(knocking));
    api.accept.mockResolvedValue(twoPlayers());
    await openAs();
    expect(screen.getByText("Waiting to join")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Let Clever Fox in" }));
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith("ABC234", "tok", "p9"));
    await waitFor(() => expect(screen.queryByText("Waiting to join")).toBeNull());
  });

  it("starts the game once a friend has joined", async () => {
    api.open.mockResolvedValue(seat(twoPlayers()));
    api.start.mockResolvedValue({ ...twoPlayers(), status: "playing", total: 3, index: 0, puzzle: SAMPLE_PUZZLES[7], startMs: Date.now() + 60_000, limitMs: 60_000, endedMs: null });
    await openAs();
    fireEvent.click(screen.getByRole("button", { name: "Start the game" }));
    await waitFor(() => expect(api.start).toHaveBeenCalledWith("ABC234", "tok"));
    await screen.findByText("Get ready!");
  });

  it("can lock the room and remove a player", async () => {
    api.open.mockResolvedValue(seat(twoPlayers()));
    api.lock.mockResolvedValue({ ...twoPlayers(), locked: true });
    api.kick.mockResolvedValue(room());
    await openAs();
    fireEvent.click(screen.getByRole("button", { name: "Lock the room" }));
    await screen.findByRole("button", { name: "Unlock the room" });
    expect(api.lock).toHaveBeenCalledWith("ABC234", "tok", true);
    fireEvent.click(screen.getByRole("button", { name: "Remove Clever Fox" }));
    await waitFor(() => expect(api.kick).toHaveBeenCalledWith("ABC234", "tok", "p2"));
    await waitFor(() => expect(screen.queryByText("Clever Fox")).toBeNull());
  });

  it("leaves the room and forgets the seat", async () => {
    hosted();
    render(<GroupHome userToken="user-token" settings={DEFAULT_SETTINGS} onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Open a room/ }));
    pickWho("tiger", "Brave Tiger");
    fireEvent.click(screen.getByRole("button", { name: "Open a room" }));
    await screen.findByText("ABC 234");
    fireEvent.click(screen.getByRole("button", { name: "Leave the room" }));
    await waitFor(() => expect(api.leave).toHaveBeenCalledWith("ABC234", "tok"));
    expect(loadSeat()).toBeNull();
    await screen.findByRole("button", { name: /Join a room/ });
  });
});

describe("staying in the room", () => {
  it("shows the lobby as the poll reports it, and tells a player who was removed", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    api.open.mockResolvedValue(seat(room()));
    api.poll.mockResolvedValueOnce(room({ players: [player(), player({ pid: "p2", name: "Silly Monkey", avatar: "monkey", isHost: false, isKodaUser: false })] }));
    api.poll.mockRejectedValueOnce(new ApiError(403, "not_in_room", "x"));
    render(<GroupHome userToken="user-token" settings={DEFAULT_SETTINGS} onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Open a room/ }));
    pickWho("tiger", "Brave Tiger");
    fireEvent.click(screen.getByRole("button", { name: "Open a room" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("ABC 234")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.getByText("Silly Monkey")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.getByText("The host removed you from the room.")).toBeTruthy();
    expect(loadSeat()).toBeNull();
  });
});
