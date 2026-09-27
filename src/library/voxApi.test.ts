import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { OPENAI_VOICES, fetchVoxVoices, openaiVoice, orderedFor, voiceLanguage, voxVoice, type VoxVoice } from "./voxApi";

vi.mock("../lib/tutorApi", () => ({ tutorHeaders: async () => ({ Authorization: "Bearer t" }) }));

const v = (name: string): VoxVoice => ({ id: name, name, category: "", description: "" });

afterEach(() => vi.unstubAllGlobals());

describe("Vox voices", () => {
  it("reads a voice's language from its name, when its name says", () => {
    expect(voiceLanguage("Pitou_kh")).toBe("km");
    expect(voiceLanguage("Selana -kh")).toBe("km");
    expect(voiceLanguage("Maya_Narrator_EN")).toBe("en");
    expect(voiceLanguage("Koda")).toBeNull();
    // "kh" inside a word is not a tag.
    expect(voiceLanguage("Khan")).toBeNull();
  });

  it("puts the voices for a book's language first and hides none", () => {
    const all = [v("Koda"), v("Maya_Narrator_EN"), v("Pitou_kh"), v("Selana -kh")];
    expect(orderedFor(all, "km").map((x) => x.name)).toEqual(["Pitou_kh", "Selana -kh", "Koda", "Maya_Narrator_EN"]);
    expect(orderedFor(all, "en").map((x) => x.name)).toEqual(["Maya_Narrator_EN", "Koda", "Pitou_kh", "Selana -kh"]);
  });

  it("asks this app's server, never Vox itself, and never sends a key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ voices: [v("Koda")] })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchVoxVoices();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/library/voices");
    expect(JSON.stringify(init.headers)).not.toMatch(/vox_live|X-API-Key/i);
  });

  it("carries the server's own reason when it cannot help", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Vox took too long. Try a shorter line." } }), { status: 502 })));
    await expect(voxVoice("hello", "abc")).rejects.toThrow("Vox took too long");
  });

  it("says so when the voice returns nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(), { status: 200 })));
    await expect(voxVoice("hello", "abc")).rejects.toThrow("no audio");
  });
});

describe("ChatGPT voices", () => {
  it("sends the line, the voice and the language to this app's server", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetchMock);
    await openaiVoice("ថ្ងៃដំបូង", "marin", "km");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/library/voice/openai");
    expect(JSON.parse(String(init.body))).toEqual({ text: "ថ្ងៃដំបូង", voice: "marin", language: "km" });
  });

  it("carries the reason ChatGPT gave, since a bad key and an empty balance need different fixes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "ChatGPT answered 401. Incorrect API key" } }), { status: 502 })));
    await expect(openaiVoice("hello", "marin", "en")).rejects.toThrow("Incorrect API key");
  });

  it("offers exactly the voices the server will accept", () => {
    // The server refuses a name it does not know, so a voice on this list and not
    // there would be a menu item that always fails.
    const server = readFileSync("server.ts", "utf8");
    const listed = /const OPENAI_LIBRARY_VOICES = \[([^\]]+)\]/.exec(server)?.[1].match(/"([a-z]+)"/g)?.map((q) => q.replaceAll('"', ""));
    expect(listed).toBeTruthy();
    expect([...OPENAI_VOICES.map((v) => v.id)].sort()).toEqual([...listed!].sort());
  });
});
