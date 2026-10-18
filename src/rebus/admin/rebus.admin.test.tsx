import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { System } from "../../lib/sync/system";
import { request } from "../../lib/sync";
import { DEFAULT_SETTINGS } from "../settings";
import { parseRebusSettings, REBUS_SETTING } from "../settingsStore";
import { RebusAdminPanel } from "./RebusAdminPanel";

vi.mock("../../lib/sync", async () => {
  const actual = await vi.importActual<typeof import("../../lib/sync")>("../../lib/sync");
  return { ...actual, accessToken: async () => "test-token", request: vi.fn() };
});

beforeEach(() => {
  vi.mocked(request).mockReset();
});

/** The number shown in a stepper, found by the group the owner sees it under. */
const shown = (label: string) => within(screen.getByRole("group", { name: label })).getByText(/^\d+s?$/).textContent;

describe("parseRebusSettings", () => {
  it("reads what the server stores, clamps it, and falls back to the defaults for anything unreadable", () => {
    expect(parseRebusSettings(JSON.stringify({ hintDelaySec: 20, machineLock: 2 }))).toMatchObject({ hintDelaySec: 20, machineLock: 2, hintRungs: 3 });
    expect(parseRebusSettings(JSON.stringify({ hintDelaySec: 500 })).hintDelaySec).toBe(60);
    expect(parseRebusSettings("not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseRebusSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("the owner's panel", () => {
  it("loads the live values, lets the owner change them, saves them, and applies them on this device at once", async () => {
    vi.mocked(request).mockResolvedValueOnce({ [REBUS_SETTING]: JSON.stringify({ ...DEFAULT_SETTINGS, hintDelaySec: 15 }) });
    vi.mocked(request).mockImplementationOnce(async (_path, options) => ({ value: (options?.body as { value: string }).value }));
    render(<RebusAdminPanel />);

    const save = await screen.findByRole("button", { name: "Save changes" });
    await waitFor(() => expect(shown("Hint unlocks after")).toBe("15s"));
    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Hint unlocks after +" }));
    expect(shown("Hint unlocks after")).toBe("16s");
    fireEvent.click(screen.getByRole("tab", { name: "Hard" }));
    fireEvent.click(screen.getByRole("switch", { name: "Letter tiles" }));
    expect((save as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(save);
    await screen.findByText("Saved. Every device uses these on its next sync.");
    expect(request).toHaveBeenLastCalledWith("/system/settings/rebus.settings", expect.objectContaining({ method: "PATCH" }));
    const stored = parseRebusSettings(System.snapshot()[REBUS_SETTING]);
    expect(stored).toMatchObject({ hintDelaySec: 16, machineLock: 2, letterTiles: true });
  });

  it("sets the points a win is worth, the cost of a hint and the Machine's points", async () => {
    vi.mocked(request).mockResolvedValueOnce({ [REBUS_SETTING]: JSON.stringify(DEFAULT_SETTINGS) });
    vi.mocked(request).mockImplementationOnce(async (_path, options) => ({ value: (options?.body as { value: string }).value }));
    render(<RebusAdminPanel />);
    await waitFor(() => expect(shown("Points for a win")).toBe("3"));
    fireEvent.click(screen.getByRole("button", { name: "Points for a win +" }));
    fireEvent.click(screen.getByRole("button", { name: "Cost of a hint −" }));
    fireEvent.click(screen.getByRole("button", { name: "Points for the Machine +" }));
    expect(shown("Points for a win")).toBe("4");
    expect(shown("Cost of a hint")).toBe("0");
    expect(shown("Points for the Machine")).toBe("4");
    expect((screen.getByRole("button", { name: "Cost of a hint −" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Saved. Every device uses these on its next sync.");
    expect(parseRebusSettings(System.snapshot()[REBUS_SETTING])).toMatchObject({ pointsPerPuzzle: 4, hintCost: 0, machinePoints: 4 });
  });

  it("follows the deployment's XP until the owner sets a Rebus amount, and goes back to following it", async () => {
    vi.mocked(request).mockResolvedValueOnce({ [REBUS_SETTING]: JSON.stringify(DEFAULT_SETTINGS) });
    vi.mocked(request).mockImplementation(async (_path, options) => ({ value: (options?.body as { value: string }).value }));
    render(<RebusAdminPanel />);
    const toggle = await screen.findByRole("switch", { name: "Same XP as lessons and books" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/pays 20 XP/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "XP for a perfect round" })).toBeNull();

    fireEvent.click(toggle);
    expect(shown("XP for a perfect round")).toBe("20");
    fireEvent.click(screen.getByRole("button", { name: "XP for a perfect round +" }));
    expect(shown("XP for a perfect round")).toBe("25");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Saved. Every device uses these on its next sync.");
    expect(parseRebusSettings(System.snapshot()[REBUS_SETTING]).xpPerRound).toBe(25);

    fireEvent.click(screen.getByRole("switch", { name: "Same XP as lessons and books" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(parseRebusSettings(System.snapshot()[REBUS_SETTING]).xpPerRound).toBeNull());
  });

  it("will not let a number past its limits, or empty the round lengths", async () => {
    vi.mocked(request).mockResolvedValueOnce({ [REBUS_SETTING]: JSON.stringify({ ...DEFAULT_SETTINGS, hintDelaySec: 3, questionChoices: [5] }) });
    render(<RebusAdminPanel />);
    await waitFor(() => expect(shown("Hint unlocks after")).toBe("3s"));
    expect((screen.getByRole("button", { name: "Hint unlocks after −" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(screen.getByRole("button", { name: "5" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("does not offer to overwrite the settings when they could not be loaded", async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error("offline"));
    render(<RebusAdminPanel />);
    await screen.findByText("Connect to load the current settings before changing them.");
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Back to the defaults" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the server's message when a save is refused", async () => {
    vi.mocked(request).mockResolvedValueOnce({ [REBUS_SETTING]: JSON.stringify(DEFAULT_SETTINGS) });
    const { ApiError } = await vi.importActual<typeof import("../../lib/sync")>("../../lib/sync");
    vi.mocked(request).mockRejectedValueOnce(new ApiError(400, "bad_value", "Use a hint delay of 3 to 60 seconds."));
    render(<RebusAdminPanel />);
    await waitFor(() => expect(shown("Hint unlocks after")).toBe("15s"));
    fireEvent.click(screen.getByRole("button", { name: "Hint unlocks after +" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Use a hint delay of 3 to 60 seconds.");
  });
});

describe("the group play controls and report", () => {
  const report = {
    days: 7,
    rows: [
      { day: "2026-10-17", roomsOpened: 0, requests: 0, seatsKoda: 0, seatsGuest: 0, gamesStarted: 0, playersStarted: 0, gamesFinished: 0, rematches: 0, askedGrownUp: 0 },
      { day: "2026-10-18", roomsOpened: 2, requests: 3, seatsKoda: 2, seatsGuest: 3, gamesStarted: 2, playersStarted: 5, gamesFinished: 1, rematches: 1, askedGrownUp: 2 },
    ],
    totals: { roomsOpened: 2, requests: 3, seatsKoda: 2, seatsGuest: 3, gamesStarted: 2, playersStarted: 5, gamesFinished: 1, rematches: 1, askedGrownUp: 2 },
  };

  it("lets the owner close the door to guests and saves it", async () => {
    vi.mocked(request).mockImplementation(async (path, options) => {
      if (String(path).startsWith("/rebus/rooms/report")) return report;
      if (options?.method === "PATCH") return { value: (options.body as { value: string }).value };
      return { [REBUS_SETTING]: JSON.stringify(DEFAULT_SETTINGS) };
    });
    render(<RebusAdminPanel />);
    const guests = await screen.findByRole("switch", { name: "Let players without an account join" });
    await waitFor(() => expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(guests);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Saved. Every device uses these on its next sync.");
    expect(parseRebusSettings(System.snapshot()[REBUS_SETTING]).guestsAllowed).toBe(false);
  });

  it("shows the owner's totals and the busy days, and says so when the numbers cannot load", async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (String(path).startsWith("/rebus/rooms/report")) return report;
      return { [REBUS_SETTING]: JSON.stringify(DEFAULT_SETTINGS) };
    });
    const { unmount } = render(<RebusAdminPanel />);
    const section = await screen.findByRole("region", { name: "Group play" });
    fireEvent.click(within(section).getByRole("button", { name: "Show the numbers" }));
    await within(section).findByText("Players seated (3 guests)");
    expect(within(section).getByText("Players seated (3 guests)").parentElement?.textContent).toContain("5");
    // Only the day with games is listed.
    expect(within(section).getAllByRole("row")).toHaveLength(2);
    unmount();

    vi.mocked(request).mockImplementation(async (path) => {
      if (String(path).startsWith("/rebus/rooms/report")) throw new Error("offline");
      return { [REBUS_SETTING]: JSON.stringify(DEFAULT_SETTINGS) };
    });
    render(<RebusAdminPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Show the numbers" }));
    await screen.findByText("Could not load the numbers. Check the connection and try again.");
  });
});
