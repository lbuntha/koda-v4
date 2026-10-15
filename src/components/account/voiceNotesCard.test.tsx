import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceNotesCard } from "./VoiceNotesCard";

vi.mock("../../lib/sync/session", async (orig) => ({ ...(await orig<typeof import("../../lib/sync/session")>()), accessToken: async () => "parent-token" }));

const NOTE = { id: "vn_1", learnerId: "l_1", bookId: "rainy", bookTitle: "The Rainy Day", pages: [1, 3], durationMs: 75_000, createdAt: "2026-10-15T09:00:00Z", heard: false };
let calls: Array<[string, RequestInit | undefined]>;

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push([url, init]);
    if (url.endsWith("/audio")) return new Response("m4a", { status: 200 });
    if (init?.method === "POST" || init?.method === "DELETE") return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ notes: [NOTE], unheard: 1 }), { status: 200 });
  }));
  URL.createObjectURL = vi.fn(() => "blob:note");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a child's voice messages in their report", () => {
  it("lists them, plays one and marks it heard", async () => {
    render(<VoiceNotesCard learnerId="l_1" learnerName="Mia" />);
    expect(await screen.findByText("The Rainy Day")).toBeTruthy();
    expect(screen.getByText("1 new")).toBeTruthy();
    expect(screen.getByText(/1:15 · Pages 1–3/)).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Play The Rainy Day" })); });
    expect(calls.some(([url]) => url.endsWith("/library/voice-notes/vn_1/audio"))).toBe(true);
    await waitFor(() => expect(calls.some(([url, init]) => url.endsWith("/vn_1/heard") && init?.method === "POST")).toBe(true));
    expect(screen.getByRole("button", { name: "Pause The Rainy Day" })).toBeTruthy();
    expect(screen.queryByText("1 new")).toBeNull();
  });

  it("deletes one after asking once", async () => {
    render(<VoiceNotesCard learnerId="l_1" learnerName="Mia" />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete the recording of The Rainy Day" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete" })); });
    expect(calls.some(([url, init]) => url.endsWith("/library/voice-notes/vn_1") && init?.method === "DELETE")).toBe(true);
    expect(screen.queryByText("The Rainy Day")).toBeNull();
  });

  it("shows nothing until there is a message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ notes: [], unheard: 0 }), { status: 200 })));
    const { container } = render(<VoiceNotesCard learnerId="l_1" learnerName="Mia" />);
    await act(async () => {});
    expect(container.innerHTML).toBe("");
  });
});
