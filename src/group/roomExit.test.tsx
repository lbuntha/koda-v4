import { describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { act, render } from "@testing-library/react";
import { roomGoneKey } from "./roomGone";
import { useLeaveOnClose } from "./useLeaveOnClose";
import type { AnyRoomView } from "./types";

const room = (status: string, isHost = false) => ({ status, me: { pid: "p", isHost, isKodaUser: true } }) as unknown as AnyRoomView;

describe("why a player is out of the room", () => {
  it("tells a friend the host left, and the host that their room closed", () => {
    expect(roomGoneKey(room("pending"), "hostLeft")).toBe("rebus.group.hostLeft");
    expect(roomGoneKey(room("lobby", true), "hostLeft")).toBe("rebus.group.hostLeftYou");
  });

  it("keeps the other reasons", () => {
    expect(roomGoneKey(room("pending"), "closed")).toBe("rebus.group.declined");
    expect(roomGoneKey(room("lobby"), "removed")).toBe("rebus.group.removed");
    expect(roomGoneKey(null, "closed")).toBe("rebus.group.closed");
  });
});

const Seat = ({ leave, inLobby }: { leave(): void; inLobby: boolean }) => {
  useLeaveOnClose(leave, inLobby);
  return null;
};

describe("leaving the room screen", () => {
  it("gives up a lobby seat once when the screen closes, not on StrictMode's rehearsal", async () => {
    vi.useFakeTimers();
    const leave = vi.fn();
    const view = render(<StrictMode><Seat leave={leave} inLobby /></StrictMode>);
    await act(async () => vi.runAllTimers());
    expect(leave).not.toHaveBeenCalled();
    view.unmount();
    await act(async () => vi.runAllTimers());
    expect(leave).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("keeps the seat once the game is playing", async () => {
    vi.useFakeTimers();
    const leave = vi.fn();
    render(<Seat leave={leave} inLobby={false} />).unmount();
    await act(async () => vi.runAllTimers());
    expect(leave).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
