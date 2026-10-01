import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sound, voice and theme as one synced document.
 *
 * The rules under test: a change is queued for the family exactly once, a
 * document pulled from another device reaches the store the app reads, and a
 * device that had these settings under the old keys keeps them.
 */

const STORAGE_KEY = "koda_preferences_v1";

const recordDoc = vi.fn();
vi.mock("./sync", () => ({ SyncEngine: { recordDoc: (...args: unknown[]) => recordDoc(...args) } }));

beforeEach(() => {
  vi.resetModules();
  recordDoc.mockClear();
  localStorage.clear();
});

const store = async () => (await import("./preferences")).PreferencesAPI;

describe("defaults", () => {
  it("start silent, in light, with Koda's voice on", async () => {
    const PreferencesAPI = await store();
    expect(PreferencesAPI.current()).toEqual({
      theme: "light",
      soundEnabled: false,
      voiceEnabled: true,
      language: null,
    });
  });

  it("does not queue anything just by loading", async () => {
    await store();
    expect(recordDoc).not.toHaveBeenCalled();
  });
});

describe("a change", () => {
  it("saves locally and queues one family document", async () => {
    const PreferencesAPI = await store();

    PreferencesAPI.update({ soundEnabled: true });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).soundEnabled).toBe(true);
    expect(recordDoc).toHaveBeenCalledTimes(1);
    expect(recordDoc).toHaveBeenCalledWith("preferences", "default", {
      theme: "light",
      soundEnabled: true,
      voiceEnabled: true,
      language: null,
    });
  });

  it("tells subscribers", async () => {
    const PreferencesAPI = await store();
    const seen = vi.fn();
    PreferencesAPI.subscribe(seen);

    PreferencesAPI.update({ theme: "dark" });

    expect(seen).toHaveBeenCalled();
    expect(PreferencesAPI.version()).toBeGreaterThan(0);
  });

  it("is not queued when it changes nothing", async () => {
    const PreferencesAPI = await store();

    PreferencesAPI.update({ voiceEnabled: true });

    expect(recordDoc).not.toHaveBeenCalled();
  });
});

describe("a document from another device", () => {
  it("is adopted when it lands in the store", async () => {
    const PreferencesAPI = await store();
    const seen = vi.fn();
    PreferencesAPI.subscribe(seen);

    // What `apply.ts` does with a pulled doc: write the key, then nudge.
    const pulled = { theme: "dark", soundEnabled: true, voiceEnabled: false, language: "km" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pulled));
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(pulled) }),
    );

    expect(PreferencesAPI.current()).toEqual(pulled);
    expect(seen).toHaveBeenCalled();
    // Adopting is not editing — it must not be sent straight back.
    expect(recordDoc).not.toHaveBeenCalled();
  });

  it("survives a body that is missing fields or nonsense", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "aubergine" }));
    const PreferencesAPI = await store();

    expect(PreferencesAPI.current()).toEqual({
      theme: "light",
      soundEnabled: false,
      voiceEnabled: true,
      language: null,
    });
  });
});

describe("language", () => {
  it("keeps any well-formed code, and drops anything else to 'follow the device'", async () => {
    const PreferencesAPI = await store();

    PreferencesAPI.update({ language: "km" });
    expect(PreferencesAPI.current().language).toBe("km");

    // Not a language this build ships — still kept, for the day it does.
    PreferencesAPI.update({ language: "pt-BR" });
    expect(PreferencesAPI.current().language).toBe("pt-BR");

    PreferencesAPI.update({ language: "<script>" });
    expect(PreferencesAPI.current().language).toBeNull();
  });
});

describe("a device that predates the document", () => {
  it("keeps the theme and sound it already had", async () => {
    localStorage.setItem("synthesis_tutor_theme", "dark");
    localStorage.setItem("koda_sound_enabled", "true");

    const PreferencesAPI = await store();

    expect(PreferencesAPI.current()).toEqual({
      theme: "dark",
      soundEnabled: true,
      voiceEnabled: true,
      language: null,
    });
  });
});
