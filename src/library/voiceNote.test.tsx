import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookReader } from "./BookReader";
import { STARTER_PASSAGES } from "./data/starterPassages";
import { SessionAPI, type Session } from "../lib/sync";

vi.mock("./voice", () => ({ canSpeak: () => false, bookSpeaks: () => false, stop: vi.fn(), say: vi.fn(async () => true), sentenceSpeaks: () => false, voiceStatus: () => "no-voice" }));
vi.mock("./clips", () => ({ prefetchBook: vi.fn(async () => ({ ready: 0, total: 0 })), prefetchClips: vi.fn(async (ids: readonly string[]) => ({ ready: ids.length, total: ids.length })), recordingAudioSupported: () => true }));
vi.mock("../assets/svg", () => ({ SvgAsset: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback}</>, SvgMarkup: () => null }));
vi.mock("../utils/audio", () => ({ playSound: vi.fn() }));
vi.mock("../lib/sync/session", async (orig) => ({ ...(await orig<typeof import("../lib/sync/session")>()), accessToken: async () => "child-token" }));

const MARKET = STARTER_PASSAGES[0];

class FakeRecorder {
  static isTypeSupported = (type: string) => type.startsWith("audio/webm");
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

const track = { stop: vi.fn() };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.spyOn(SessionAPI, "current").mockReturnValue({ learnerId: "l_" + "a".repeat(20), learnerName: "Mia", role: "child" } as unknown as Session);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) } });
  URL.createObjectURL = vi.fn(() => "blob:take");
  URL.revokeObjectURL = vi.fn();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "vn_1", learnerId: "l_x", bookId: MARKET.id, bookTitle: MARKET.title, pages: [1], durationMs: 1000, createdAt: "", heard: false }), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("reading to my grown-ups", () => {
  it("records across pages, plays it back, and sends it with the pages read", async () => {
    render(<BookReader book={MARKET} onBack={() => {}} onReady={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Record my reading for my grown-ups" })); });
    expect(screen.getByText("Recording")).toBeTruthy();

    // Reading on to the next page while recording, then stopping from the toolbar.
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Stop recording" })[0]); });
    expect(track.stop).toHaveBeenCalled();
    expect(screen.getByLabelText("Your recording").getAttribute("src")).toBe("blob:take");

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send to my grown-ups" })); });
    await waitFor(() => expect(screen.getByText("Sent! Your grown-ups can listen now.")).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/library\/voice-notes$/);
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ mime: "audio/webm", bookId: MARKET.id, bookTitle: MARKET.title, pages: [1, 2] });
    expect(atob(body.data)).toBe("voice");
  });

  it("can be thrown away or recorded again before sending", async () => {
    render(<BookReader book={MARKET} onBack={() => {}} onReady={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    const mic = () => screen.getAllByRole("button", { name: /Record my reading|Stop recording/ })[0];
    await act(async () => { fireEvent.click(mic()); });
    await act(async () => { fireEvent.click(mic()); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Record again" })); });
    expect(screen.getByText("Recording")).toBeTruthy();
    await act(async () => { fireEvent.click(mic()); });
    fireEvent.click(screen.getByRole("button", { name: "Throw this recording away" }));
    expect(screen.queryByRole("region", { name: "Voice message" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when the microphone is blocked", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("denied"));
    render(<BookReader book={MARKET} onBack={() => {}} onReady={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Record my reading for my grown-ups" })); });
    expect(screen.getByText(/The microphone is off/)).toBeTruthy();
  });

  it("is not offered in an author's preview or to a grown-up's own session", () => {
    const { unmount } = render(<BookReader book={MARKET} preview onBack={() => {}} onReady={() => {}} />);
    expect(screen.queryByRole("button", { name: "Record my reading for my grown-ups" })).toBeNull();
    unmount();
    vi.spyOn(SessionAPI, "current").mockReturnValue({ role: "parent" } as unknown as Session);
    render(<BookReader book={MARKET} onBack={() => {}} onReady={() => {}} />);
    expect(screen.queryByRole("button", { name: "Record my reading for my grown-ups" })).toBeNull();
  });
});
