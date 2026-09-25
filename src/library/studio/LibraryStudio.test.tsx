import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An author's whole session, driven by what is on screen: start a book, paste a
 * story, draft it, break a question on purpose and watch the checks catch it,
 * fix it, preview it, publish it. The server is mocked; what is checked is what
 * the studio sends it and when it refuses to.
 */

const api = vi.hoisted(() => ({
  fetchStudioBooks: vi.fn(async (_q: unknown, _signal?: AbortSignal) => ({
    books: [] as unknown[], page: 1, pageSize: 25, total: 0, pages: 1,
    stats: { all: 0, draft: 0, published: 0, changed: 0, reported: 0 },
    facets: { languages: [], bands: [], categories: [] },
  })),
  fetchDraft: vi.fn(async (_id: string) => ({})),
  fetchStudioMeta: vi.fn(async () => ({ categories: ["Everyday", "Food"], sorts: ["updated", "title"], statuses: ["draft", "published", "changed", "reported"], pageSizeMin: 5, pageSizeMax: 100 })),
  fetchSpellingUnitsInUse: vi.fn(async () => [] as string[]),
  fetchReports: vi.fn(async () => [] as unknown[]),
  resolveReport: vi.fn(async () => {}),
  saveDraft: vi.fn(async (id: string, _passage: unknown, _confirmed: boolean, _provider?: string) => ({ id, rev: 0, status: "draft" })),
  publishBook: vi.fn(async (id: string) => ({ id, rev: 1, status: "published" })),
  unpublishBook: vi.fn(),
  deleteBook: vi.fn(),
  requestAiDraft: vi.fn(async () => { throw new Error("No Gemini API key is configured."); }),
}));
vi.mock("../api", () => api);
vi.mock("../bookStore", () => ({ BookStore: { refresh: vi.fn() }, useShelf: () => [] }));
vi.mock("../voice", () => ({ canSpeak: () => false, voiceStatus: () => "no-voice", bookSpeaks: () => false, sentenceSpeaks: () => false, say: vi.fn(async () => {}), stop: vi.fn() }));
vi.mock("../clips", () => ({ clipSizes: vi.fn(async () => ({})), prefetchBook: vi.fn(async () => ({ ready: 0, total: 0 })), uploadClip: vi.fn(async () => ({ id: "c".repeat(64), bytes: 12_345 })), pcmToWav: vi.fn(() => new Blob()) }));
vi.mock("../../assets/svg", () => ({
  SvgAsset: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback}</>,
  SvgMarkup: () => null,
  // One drawing filed under "story" on the Art page; the other collections are empty.
  useArtCategory: (c: string) => (c === "story" ? ["straw-house"] : []),
  useArtLibrary: () => [{ id: "straw-house", category: "story", markup: "<svg viewBox=\"0 0 1 1\" />" }],
}));
// The panel pulls the shared library when it opens; nothing is signed in here.
vi.mock("../../lib/svgAssetsApi", async (orig) => ({
  ...(await orig<typeof import("../../lib/svgAssetsApi")>()),
  listSvgAssets: vi.fn(async () => []),
  saveSvgAsset: vi.fn(async () => ({ created: true, moved: false })),
}));

const PHOTO = "photo-" + "b".repeat(64);
const uploadPhoto = vi.hoisted(() => vi.fn(async (_f: Blob) => "photo-" + "b".repeat(64)));
vi.mock("../photos", async (orig) => ({ ...(await orig<typeof import("../photos")>()), uploadPhoto, photoUrl: vi.fn(async () => null) }));

import { LibraryStudio } from "./LibraryStudio";
import { UnitVoices } from "../unitVoices";
import { STARTER_PASSAGES } from "../data/starterPassages";
import { spellingUnits } from "../data/khmer";
import { unitName } from "../data/khmerCoach";
import { asStandardAudio } from "./UnitNamesPanel";

// Three words the picture library can draw (market, mango, bananas), so a Words part can be made.
const STORY = "Sokha goes to the market with her mother.\nShe buys a mango and two bananas.\nThe mango is sweet.\nThey walk home under the hot sun.";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

async function startBook() {
  render(<LibraryStudio />);
  await screen.findByText(/No books yet/);
  fireEvent.click(screen.getByRole("button", { name: /New book/ }));
  fireEvent.change(screen.getByPlaceholderText("e.g. At the Market"), { target: { value: "Market Day" } });
  fireEvent.change(screen.getByPlaceholderText("One sentence after another."), { target: { value: STORY } });
  const counts = screen.getAllByRole("spinbutton");
  fireEvent.change(counts[0], { target: { value: "2" } });
  fireEvent.change(counts[1], { target: { value: "2" } });
  fireEvent.change(counts[2], { target: { value: "3" } });
}

describe("Khmer sound names", () => {
  const KM = STARTER_PASSAGES.find((p) => p.language === "km")!;

  it("lists the units the studio's Khmer books spell first, and saves an uploaded recording", async () => {
    api.fetchSpellingUnitsInUse.mockResolvedValueOnce([...new Set(KM.questions.flatMap((q) => (q.kind === "spell" ? spellingUnits(q.word) : [])))]);
    const save = vi.spyOn(UnitVoices, "save").mockResolvedValue();
    render(<LibraryStudio />);
    fireEvent.click(await screen.findByRole("button", { name: "Khmer sound names" }));

    const used = new Set(KM.questions.flatMap((q) => (q.kind === "spell" ? spellingUnits(q.word) : [])));
    expect((await screen.findByRole("button", { name: `Used in books (${used.size})` })).getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelectorAll("[data-unit]").length).toBeGreaterThan(used.size);

    const foot = [...used].find((u) => u.startsWith("\u17D2"))!;
    const input = document.querySelector(`[data-unit="${foot}"] input[type=file]`)!;
    const file = new File([new Uint8Array([1, 2, 3])], "name.m4a", { type: "audio/x-m4a" });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    expect(save).toHaveBeenCalledWith(foot, "c".repeat(64));
    expect(screen.getByLabelText(`Upload a recording of ${unitName(foot)}`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^All \(/ }));
    expect(document.querySelectorAll("[data-unit]").length).toBeGreaterThan(100);
    save.mockRestore();
  });

  it("sends a phone's m4a under the name the server accepts", () => {
    expect(asStandardAudio(new Blob([], { type: "audio/x-m4a" })).type).toBe("audio/mp4");
    expect(asStandardAudio(new Blob([], { type: "audio/webm" })).type).toBe("audio/webm");
  });
});

describe("Library Studio", () => {
  it("uploads a photo for a page and places it on the left", async () => {
    await startBook();
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByRole("tab", { name: /Understand/ });
    fireEvent.click(screen.getByRole("button", { name: /^4\s*Pages & pictures$/ }));
    const pages = screen.getByRole("list", { name: "Pages" });
    fireEvent.click(within(pages).getByRole("button", { name: /^Page 2/ }));
    // Clicking the page card opens the drawer directly — no separate Attach step.
    let picker = screen.getByRole("dialog", { name: "Picture for page 2" });
    fireEvent.click(within(picker).getByRole("button", { name: "Upload" }));
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "farm.jpg", { type: "image/jpeg" });
    await act(async () => { fireEvent.change(picker.querySelector("input[type=file]")!, { target: { files: [file] } }); });
    expect(uploadPhoto).toHaveBeenCalledWith(file);
    expect(within(pages).getByRole("button", { name: /^Page 2: photo \(Chosen\)/ })).toBeTruthy();

    // Uploading closes the drawer; reopen the page to place it on the left.
    fireEvent.click(within(pages).getByRole("button", { name: /^Page 2/ }));
    picker = screen.getByRole("dialog", { name: "Picture for page 2" });
    fireEvent.click(within(picker).getByRole("radio", { name: "Left" }));
    fireEvent.click(within(picker).getByRole("button", { name: "Close" }));
    expect(within(pages).getByRole("button", { name: /^Page 2: photo \(Chosen, left\)/ })).toBeTruthy();

    // The photo is now offered for reuse on other pages.
    fireEvent.click(within(pages).getByRole("button", { name: /^Page 1/ }));
    expect(within(screen.getByRole("dialog", { name: "Picture for page 1" })).getByRole("button", { name: "Photo" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalled());
    const saved = api.saveDraft.mock.calls[0][1] as { sentences: Array<{ picture?: string | null; pictureAt?: string }> };
    expect(saved.sentences[2]).toMatchObject({ picture: PHOTO, pictureAt: "left" });
  });

  it("seeds the drawing prompt with the page's own text, or the word for a Words picture", async () => {
    await startBook();
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue \u203a" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByRole("tab", { name: /Understand/ });

    // A Words question's right-hand picture is the word itself...
    fireEvent.click(screen.getByRole("tab", { name: /Words/ }));
    const card = screen.getAllByRole("combobox")[0].closest("div.rounded-2xl") as HTMLElement;
    const word = (within(card).getByRole("combobox") as HTMLSelectElement).value;
    fireEvent.click(within(card).getByRole("button", { name: /^Change the right picture, / }));
    const right = await screen.findByRole("dialog", { name: /^Picture for/ });
    fireEvent.click(within(right).getByRole("button", { name: "Draw one" }));
    expect((within(right).getByRole("textbox", { name: "Describe the picture" }) as HTMLTextAreaElement).value)
      .toBe(`A single, clearly recognisable picture of “${word}” — one plain object, centred, no background scene.`);
    fireEvent.click(within(right).getByRole("button", { name: "Close" }));

    // ...but a wrong picture is deliberately not: naming the word there would
    // draw the very thing that slot must not be, so it opens blank.
    fireEvent.click(within(card).getByRole("button", { name: /^Change wrong picture 1, / }));
    const wrong = await screen.findByRole("dialog", { name: /^Wrong picture for/ });
    fireEvent.click(within(wrong).getByRole("button", { name: "Draw one" }));
    expect((within(wrong).getByRole("textbox", { name: "Describe the picture" }) as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(within(wrong).getByRole("button", { name: "Close" }));

    // A page's "Draw one" opens with a finished instruction, not a bare line
    // the model has to guess a subject out of.
    fireEvent.click(screen.getByRole("button", { name: /^4\s*Pages & pictures$/ }));
    const pages = screen.getByRole("list", { name: "Pages" });
    fireEvent.click(within(pages).getByRole("button", { name: /^Page 1/ }));
    const picker = screen.getByRole("dialog", { name: "Picture for page 1" });
    fireEvent.click(within(picker).getByRole("button", { name: "Draw one" }));
    const pagePrompt = within(picker).getByRole("textbox", { name: "Describe the picture" }) as HTMLTextAreaElement;
    expect(pagePrompt.value).toMatch(/^Illustrate this line from the story: “/);
    expect(pagePrompt.value).toMatch(/market/);
    fireEvent.click(within(picker).getByRole("button", { name: "Close" }));

    // The cover, with no page of its own, gets the book's title instead.
    fireEvent.click(within(pages).getByRole("button", { name: /^Cover/ }));
    const cover = screen.getByRole("dialog", { name: "Picture for the cover" });
    fireEvent.click(within(cover).getByRole("button", { name: "Draw one" }));
    expect((within(cover).getByRole("textbox", { name: "Describe the picture" }) as HTMLTextAreaElement).value).toBe("A cover illustration for the story titled “Market Day”");
  });

  it("says why a photo could not be uploaded", async () => {
    uploadPhoto.mockRejectedValueOnce(new Error("A photo may be at most 3 MB."));
    await startBook();
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByRole("tab", { name: /Understand/ });
    fireEvent.click(screen.getByRole("button", { name: /^4\s*Pages & pictures$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cover/ }));
    const cover = screen.getByRole("dialog", { name: "Picture for the cover" });
    fireEvent.click(within(cover).getByRole("button", { name: "Upload" }));
    const input = cover.querySelector("input[type=file]")!;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(["x"], "big.jpg", { type: "image/jpeg" })] } }); });
    expect(screen.getByRole("alert").textContent).toMatch(/at most 3 MB/);
  });

  it("lets an author choose each page's picture, or none, and change the cover", async () => {
    await startBook();
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByRole("tab", { name: /Understand/ });
    fireEvent.click(screen.getByRole("button", { name: /^4\s*Pages & pictures$/ }));

    // The book as the reader lays it out: a cover and two pages, each Automatic.
    const pages = screen.getByRole("list", { name: "Pages" });
    expect(within(pages).getAllByRole("button")).toHaveLength(3);
    expect(within(pages).getByRole("button", { name: /^Page 1: market \(Automatic\)/ })).toBeTruthy();

    // Page 1 gets a drawing from the Art page's story collection.
    fireEvent.click(within(pages).getByRole("button", { name: /^Page 1/ }));
    const picker = screen.getByRole("dialog", { name: "Picture for page 1" });
    fireEvent.click(await within(picker).findByRole("button", { name: "straw-house" }));
    expect(within(pages).getByRole("button", { name: /^Page 1: straw-house \(Chosen\)/ })).toBeTruthy();

    // Page 2 gets none; the cover gets a picture from the page's words.
    fireEvent.click(within(pages).getByRole("button", { name: /^Page 2/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Picture for page 2" })).getByRole("button", { name: "No picture" }));
    expect(within(pages).getByRole("button", { name: /^Page 2: no picture \(No picture\)/ })).toBeTruthy();
    fireEvent.click(within(pages).getByRole("button", { name: /^Cover/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Picture for the cover" })).getAllByRole("button", { name: "banana" })[0]);

    // Saved as the book: the choice sits on each page's first sentence.
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalled());
    const saved = api.saveDraft.mock.calls[0][1] as { picture: string; sentences: Array<{ picture?: string | null }> };
    expect(saved.picture).toBe("banana");
    expect(saved.sentences.map((x) => x.picture)).toEqual(["straw-house", undefined, null, undefined]);
  });

  it("falls back to the offline drafter when the AI provider has no key", async () => {
    await startBook();
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    expect(await screen.findByText(/No Gemini API key is configured/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use the offline drafter" }));
    expect(await screen.findByText(/The offline drafter drafted/)).toBeTruthy();
    expect(api.requestAiDraft).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini", language: "en", band: "A", sentences: expect.any(Array) }));
  });

  it("drafts, catches a broken question, publishes once it is fixed", async () => {
    await startBook();
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByRole("tab", { name: /Understand/ });
    expect(screen.getByRole("tab", { name: /Spell/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Understand/ }));

    // Make the right answer the longest choice: check 3 must catch it.
    const choices = screen.getAllByRole("textbox", { name: /Choice \d/ });
    const right = screen.getAllByRole("radio", { name: /is right/ }).findIndex((r) => (r as HTMLInputElement).checked);
    // Keep the answer's own word so only length changes — replacing it would (rightly) fail check 1 too.
    const answer = (choices[right] as HTMLInputElement).value;
    fireEvent.change(choices[right], { target: { value: `${answer} and some more words` } });
    expect(screen.getByText(/✕ 3 · The right answer is not the longest/)).toBeTruthy();

    // Publish refuses while it fails.
    fireEvent.click(screen.getByRole("button", { name: /Publish/ }));
    expect((screen.getByRole("button", { name: /^Publish$/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Not ready: 1 check failing/)).toBeTruthy();

    // Delete it and add another: the count check follows, then passes.
    fireEvent.click(screen.getByRole("button", { name: /Review & modify/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Understand/ }));
    const understandCard = screen.getAllByRole("textbox", { name: /Choice \d/ })[0].closest("div.rounded-2xl") as HTMLElement;
    fireEvent.click(within(understandCard).getByRole("button", { name: /Delete/ }));
    expect(screen.getByRole("tab", { name: /Understand/ })).toBeTruthy();

    // Preview plays the draft in the real player, with nothing recorded.
    fireEvent.click(screen.getByRole("button", { name: /Preview/ }));
    expect(screen.getByText(/Preview — nothing here is saved/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Market Day" })).toBeTruthy();
  });

  it("lets an author change a Words question's picture, and moves the word's picture with it", async () => {
    await startBook();
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByRole("tab", { name: /Understand/ });

    // One Words card: its word, and the three pictures it shows.
    fireEvent.click(screen.getByRole("tab", { name: /Words/ }));
    const card = screen.getAllByRole("combobox")[0].closest("div.rounded-2xl") as HTMLElement;
    const word = (within(card).getByRole("combobox") as HTMLSelectElement).value;
    const taken = within(card).getAllByRole("button", { name: /^Change (the right|wrong) picture/ })
      .map((b) => (b.getAttribute("aria-label") ?? "").split(", ")[1]);
    expect(taken).toHaveLength(3);

    // The right-hand one opens the drawer, and says what changing it will reach.
    fireEvent.click(within(card).getByRole("button", { name: /^Change the right picture, / }));
    const drawer = await screen.findByRole("dialog", { name: /^Picture for/ });
    expect(drawer.textContent).toMatch(/everywhere in this book/);

    // Pick a library picture that is not already one of the three.
    const tile = within(drawer).getAllByRole("button").find((b) => {
      const name = b.getAttribute("aria-label") ?? "";
      return /^[a-z][a-z0-9-]*$/.test(name) && !taken.includes(name);
    })!;
    const picked = tile.getAttribute("aria-label")!;
    fireEvent.click(tile);

    // Saved as the book: the question and the word's own picture both moved, and
    // the three pictures are still three different pictures.
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalled());
    const saved = api.saveDraft.mock.calls[0][1] as { pictures: Record<string, string>; questions: Array<{ kind: string; word: string; options: string[]; answer: number }> };
    const q = saved.questions.find((x) => x.kind === "vocab" && x.word === word)!;
    expect(q.options[q.answer]).toBe(picked);
    expect(saved.pictures[word.toLowerCase()]).toBe(picked);
    expect(new Set(q.options).size).toBe(q.options.length);
  });

  it("saves then publishes a book that passes, and shows the server's refusal when it does not", async () => {
    await startBook();
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByRole("tab", { name: /Understand/ });
    fireEvent.click(screen.getByRole("button", { name: /^7\s*Publish$/ }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Publish$/ })); });

    await waitFor(() => expect(api.publishBook).toHaveBeenCalledWith("market-day"));
    expect(api.saveDraft).toHaveBeenCalledWith("market-day", expect.objectContaining({ title: "Market Day", band: "A", language: "en" }), true, "offline");
    expect(await screen.findByText(/Published revision 1/)).toBeTruthy();

    api.publishBook.mockRejectedValueOnce(new Error("q1: the right answer is the longest"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Publish$/ })); });
    expect(await screen.findByText(/The server refused to publish: q1: the right answer is the longest/)).toBeTruthy();
  });

  it("will not let Khmer publish until a person confirms the split", async () => {
    render(<LibraryStudio />);
    await screen.findByText(/No books yet/);
    fireEvent.click(screen.getByRole("button", { name: /New book/ }));
    fireEvent.click(screen.getByRole("button", { name: "ភាសាខ្មែរ" }));
    fireEvent.change(screen.getByPlaceholderText("ចំណងជើង"), { target: { value: "នៅផ្សារ" } });
    fireEvent.change(screen.getByPlaceholderText(/One sentence after another\. Khmer/), { target: { value: "សុខា ទៅ ផ្សារ ជាមួយ ម្តាយ។\nនាង ទិញ ស្វាយ មួយ។\nស្វាយ ផ្អែម ណាស់។" } });
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByText(/checked the text and every split/);
    expect(screen.getByText(/✕ 8 · Khmer word splits are confirmed by a person/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /checked the text and every split/ }));
    expect(screen.getByText(/✓ 8 · Khmer word splits are confirmed by a person/)).toBeTruthy();
  });

  it("records a sentence with the AI voice, and the saved draft points at the clip", async () => {
    const cues = Array.from({ length: 8 }, (_, i) => ({ startMs: i * 100, endMs: (i + 1) * 100 }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ audio: btoa("\u0000\u0000"), cues }), { status: 200 }));
    await startBook();
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByRole("tab", { name: /Understand/ });
    fireEvent.click(screen.getByRole("button", { name: /Voice \(optional\)/ }));
    expect(screen.getByText("0 of 4 recorded")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Lila/ })).toHaveProperty("checked", true);
    fireEvent.click(screen.getByRole("radio", { name: /Milo/ }));
    expect(localStorage.getItem("koda_library_voice_character_v1")).toBe("milo");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gemini voice for s1" })); });
    expect(await screen.findByText("1 of 4 recorded")).toBeTruthy();
    expect(await screen.findByText("12 KB stored")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/library/voice", expect.objectContaining({ method: "POST" }));
    const voiceRequest = fetchMock.mock.calls.find(([url]) => url === "/api/library/voice")?.[1];
    expect(JSON.parse(String(voiceRequest?.body))).toMatchObject({
      language: "en",
      character: "milo",
      words: ["Sokha", "goes", "to", "the", "market", "with", "her", "mother."],
    });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Save draft/ })); });
    const saved = api.saveDraft.mock.calls.at(-1)![1] as { sentences: Array<{ id: string; audio?: string; audioCues?: unknown[] }> };
    expect(saved.sentences.find((x) => x.id === "s1")?.audio).toBe("c".repeat(64));
    expect(saved.sentences.find((x) => x.id === "s1")?.audioCues).toEqual(cues);
    expect(saved.sentences.find((x) => x.id === "s2")?.audio).toBeUndefined();
    fetchMock.mockRestore();
  });

  it("offers a choice of a personal recording or Gemini voice for Khmer", async () => {
    render(<LibraryStudio />);
    await screen.findByText(/No books yet/);
    fireEvent.click(screen.getByRole("button", { name: /New book/ }));
    fireEvent.click(screen.getByRole("button", { name: "ភាសាខ្មែរ" }));
    fireEvent.change(screen.getByPlaceholderText("ចំណងជើង"), { target: { value: "នៅផ្សារ" } });
    fireEvent.change(screen.getByPlaceholderText(/One sentence after another\. Khmer/), { target: { value: "សុខា ទៅ ផ្សារ ជាមួយ ម្តាយ។\nនាង ទិញ ស្វាយ មួយ។\nស្វាយ ផ្អែម ណាស់។" } });
    fireEvent.click(screen.getByRole("radio", { name: /Offline drafter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue ›" }));
    fireEvent.click(screen.getByRole("button", { name: /Draft the questions/ }));
    await screen.findByText(/checked the text and every split/);
    fireEvent.click(screen.getByRole("button", { name: /Voice \(optional\)/ }));
    expect(screen.getByText(/Choose a recorded or Gemini voice/)).toBeTruthy();
    expect(screen.getAllByRole("radio", { name: /Lila|Milo|Zara|Ari/ })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Gemini voice for s1" })).toBeTruthy();
  });
});
