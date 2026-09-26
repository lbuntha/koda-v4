import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookReader, spokenWordAt } from "./BookReader";
import { layoutBook, paginate, withPageChoice } from "./bookLayout";
import { STARTER_PASSAGES } from "./data/starterPassages";

const voice = vi.hoisted(() => ({
  sentenceSpeaks: vi.fn(() => false),
  say: vi.fn(async (_text: string, _language?: string, _clipId?: string, _onTime?: (elapsedMs: number | null, durationMs?: number) => void) => true),
  voiceStatus: vi.fn<() => "ok" | "off" | "no-voice">(() => "no-voice"),
}));
vi.mock("./voice", () => ({ canSpeak: () => false, bookSpeaks: () => false, stop: vi.fn(), ...voice }));
vi.mock("./clips", () => ({ prefetchBook: vi.fn(async () => ({ ready: 0, total: 0 })), ...clips }));
vi.mock("../assets/svg", () => ({ SvgAsset: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback}</>, SvgMarkup: () => null }));
vi.mock("./photos", async (orig) => ({ ...(await orig<typeof import("./photos")>()), photoUrl: vi.fn(async () => "blob:farm"), knownPhotoUrl: () => null }));
const clips = vi.hoisted(() => ({
  prefetchClips: vi.fn(async (ids: readonly string[]) => ({ ready: ids.length, total: ids.length })),
  recordingAudioSupported: vi.fn(() => true),
}));
const playSound = vi.hoisted(() => vi.fn());
vi.mock("../utils/audio", () => ({ playSound }));

const MARKET = STARTER_PASSAGES[0];
const PHOTO = "photo-" + "c".repeat(64);

beforeEach(() => {
  voice.sentenceSpeaks.mockReset();
  voice.sentenceSpeaks.mockReturnValue(false);
  voice.say.mockReset();
  voice.say.mockResolvedValue(true);
  voice.voiceStatus.mockReset();
  voice.voiceStatus.mockReturnValue("no-voice");
  clips.prefetchClips.mockReset();
  clips.prefetchClips.mockImplementation(async (ids: readonly string[]) => ({ ready: ids.length, total: ids.length }));
  clips.recordingAudioSupported.mockReset();
  clips.recordingAudioSupported.mockReturnValue(true);
});

/** A book whose first page is fully recorded, so the reader offers its speaker. */
const recorded = () => {
  const firstPageIds = new Set(layoutBook(MARKET).story[0].map((s) => s.sentence.id));
  return { ...MARKET, sentences: MARKET.sentences.map((s) => firstPageIds.has(s.id) ? { ...s, audio: "a".repeat(64) } : s) };
};

describe("a recording that did not arrive", () => {
  it("lets a reader try the download again, and plays once it arrives", async () => {
    // Offline, or a connection that dropped: nothing downloaded.
    clips.prefetchClips.mockImplementation(async (ids: readonly string[]) => ({ ready: 0, total: ids.length }));
    voice.sentenceSpeaks.mockReturnValue(true);
    render(<BookReader book={recorded()} preview onBack={() => {}} onReady={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    const play = screen.getByRole("button", { name: "Play page recording" });
    // Still offered, and it says what went wrong rather than blaming the device.
    await waitFor(() => expect(play.getAttribute("title")).toBe("Audio did not load — tap to try again"));
    expect(play.hasAttribute("disabled")).toBe(false);

    // Back online: the same button fetches again, and then reads the page.
    clips.prefetchClips.mockImplementation(async (ids: readonly string[]) => ({ ready: ids.length, total: ids.length }));
    await act(async () => { fireEvent.click(play); });
    await waitFor(() => expect(play.getAttribute("title")).toBe("Play page recording"));
    expect(voice.say).not.toHaveBeenCalled();

    fireEvent.click(play);
    await waitFor(() => expect(voice.say).toHaveBeenCalled());
  });

  it("reports a refused recording to the console, and not to the child", async () => {
    // The clip is downloaded and ready; the browser simply will not play it.
    // Whoever is looking into it needs to know which of the three it was; the
    // reader is a child with a story open, and none of it is their problem.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    voice.sentenceSpeaks.mockReturnValue(true);
    voice.say.mockResolvedValue(false);
    render(<BookReader book={recorded()} preview onBack={() => {}} onReady={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    const play = screen.getByRole("button", { name: "Play page recording" });
    await waitFor(() => expect(play.hasAttribute("disabled")).toBe(false));
    await act(async () => { fireEvent.click(play); });

    expect(warn.mock.calls.flat().join(" ")).toContain("would not play a recording it has");
    expect(screen.queryByRole("status")).toBeNull();
    warn.mockRestore();
  });

  it("reads every sentence on the page, even if one reports that it did not play", async () => {
    // A clip pauses before it says it has ended, so a sentence that played can
    // still report false. Whatever one sentence says, the rest of the page is
    // still read: this is what stopped a book after its first sentence.
    const firstPage = layoutBook(MARKET).story[0];
    voice.sentenceSpeaks.mockReturnValue(true);
    voice.say.mockResolvedValue(false);
    render(<BookReader book={recorded()} preview onBack={() => {}} onReady={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    const play = screen.getByRole("button", { name: "Play page recording" });
    await waitFor(() => expect(play.hasAttribute("disabled")).toBe(false));
    await act(async () => { fireEvent.click(play); });

    expect(voice.say).toHaveBeenCalledTimes(firstPage.length);
  });

  it("does not offer a retry a browser that cannot play the format could never win", async () => {
    clips.recordingAudioSupported.mockReturnValue(false);
    voice.sentenceSpeaks.mockReturnValue(true);
    render(<BookReader book={recorded()} preview onBack={() => {}} onReady={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    const play = screen.getByRole("button", { name: "Play page recording" });
    await waitFor(() => expect(play.hasAttribute("disabled")).toBe(true));
    expect(play.getAttribute("title")).toBe("This browser cannot play the recording");
  });
});

describe("a page's picture in the reader", () => {
  it("shows an uploaded photo where the author placed it", async () => {
    const ids = paginate(MARKET)[0].map((s) => s.id);
    const book = withPageChoice(MARKET, ids, { picture: PHOTO, at: "right" });
    render(<BookReader book={book} preview onBack={() => {}} onReady={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next page" })); });
    const page = document.querySelector("[data-picture-at]")!;
    expect(page.getAttribute("data-picture-at")).toBe("right");
    expect(page.className).toMatch(/sm:flex-row-reverse/);
    expect(page.querySelector("img")?.getAttribute("src")).toBe("blob:farm");
  });

  it("keeps an unplaced picture on top", () => {
    render(<BookReader book={MARKET} preview onBack={() => {}} onReady={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(document.querySelector("[data-picture-at]")?.getAttribute("data-picture-at")).toBe("top");
  });
});

describe("turning a page", () => {
  it("plays a page sound each time the page actually changes, and only then", () => {
    playSound.mockClear();
    render(<BookReader book={MARKET} preview onBack={() => {}} onReady={() => {}} />);
    // Mounting on the cover is not a turn.
    expect(playSound).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(playSound).toHaveBeenCalledWith("page");
    expect(playSound).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(playSound).toHaveBeenCalledTimes(2);

    // The first page has nowhere further back to go: not a turn either.
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(playSound).toHaveBeenCalledTimes(2);
  });
});

describe("page recordings", () => {
  it("uses approved word splits for exact and fallback highlighting", () => {
    const words = ["The", "mango", "is", "sweet."];
    expect(spokenWordAt({ words, audioCues: [
      { startMs: 80, endMs: 210 },
      { startMs: 240, endMs: 520 },
      { startMs: 550, endMs: 620 },
      { startMs: 650, endMs: 920 },
    ] }, 300, 1000)).toBe(1);
    expect(spokenWordAt({ words }, 500, 1000)).toBe(1);
  });

  it("highlights only the approved word at the recording's current time", async () => {
    const firstPageIds = new Set(layoutBook(MARKET).story[0].map((s) => s.sentence.id));
    const recordedBook = {
      ...MARKET,
      sentences: MARKET.sentences.map((sentence) => firstPageIds.has(sentence.id) ? {
        ...sentence,
        audio: "a".repeat(64),
        audioCues: sentence.words.map((_, index) => ({ startMs: index * 100, endMs: (index + 1) * 100 })),
      } : sentence),
    };
    let finish!: () => void;
    voice.say.mockImplementation(async (_text, _language, _clip, onTime) => {
      onTime?.(150, 1000);
      await new Promise<void>((resolve) => { finish = resolve; });
      return true;
    });

    render(<BookReader book={recordedBook} preview onBack={() => {}} onReady={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    const play = screen.getByRole("button", { name: "Play page recording" });
    await waitFor(() => expect(play.hasAttribute("disabled")).toBe(false));
    fireEvent.click(play);

    await waitFor(() => expect(document.querySelectorAll('[data-speaking="true"]')).toHaveLength(1));
    expect(document.querySelector('[data-speaking="true"]')?.textContent).toBe(recordedBook.sentences[0].words[1]);
    await act(async () => finish());
  });

  it("plays only the current page from its sentence recordings while Koda's voice is off", async () => {
    voice.voiceStatus.mockReturnValue("off");
    voice.sentenceSpeaks.mockReturnValue(true);
    const firstPage = layoutBook(MARKET).story[0];
    const firstPageIds = new Set(firstPage.map((s) => s.sentence.id));
    const recordedBook = {
      ...MARKET,
      sentences: MARKET.sentences.map((s) => firstPageIds.has(s.id) ? { ...s, audio: "a".repeat(64) } : s),
    };

    render(<BookReader book={recordedBook} preview onBack={() => {}} onReady={() => {}} />);
    expect(screen.queryByRole("button", { name: "Play page recording" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    const play = screen.getByRole("button", { name: "Play page recording" });
    await waitFor(() => expect(play.hasAttribute("disabled")).toBe(false));
    fireEvent.click(play);

    await waitFor(() => expect(voice.say).toHaveBeenCalledTimes(firstPage.length));
    expect(voice.say.mock.calls.map(([text]) => text)).toEqual(firstPage.map((s) => s.sentence.text));
    expect(screen.getByText(`Page 1 of ${layoutBook(MARKET).story.length}`)).toBeTruthy();
  });
});
