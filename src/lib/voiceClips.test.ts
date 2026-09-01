import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rule that matters here is the fallback.
 *
 * `playClip` is the fast path in front of live TTS, so it has one job beyond
 * playing: be honest about a miss, synchronously. Return true when there is no
 * clip and the phrase is silently dropped; answer asynchronously and the caller
 * cannot fall through without an await, which reintroduces the delay the
 * recordings exist to remove.
 */

/** As the recorder writes it: phrase -> path relative to `audio/`. */
const MANIFEST = {
  three: "numbers/three.wav",
  "Look fast! How many did you see?": "phrases/look-fast-how-many-did-you-see.wav",
  "never recorded": "phrases/missing.wav",
  "Nice work!": "correct/nice-work.wav",
  "Perfect!": "correct/perfect.wav",
  "Not quite. Let's try again!": "incorrect/not-quite-lets-try-again.wav",
};

/** As Vite's `?url` glob hands it back: source path -> emitted asset URL. */
const FILES = {
  "./audio/numbers/three.wav": "/assets/three-9f8e.wav",
  "./audio/phrases/look-fast-how-many-did-you-see.wav": "/assets/look-fast-1a2b.wav",
  "./audio/correct/nice-work.wav": "/assets/nice-work-33cc.wav",
  "./audio/correct/perfect.wav": "/assets/perfect-44dd.wav",
  "./audio/incorrect/not-quite-lets-try-again.wav": "/assets/not-quite-55ee.wav",
};

const GROUPS = {
  correct: { phrases: ["Nice work!", "Perfect!", "Never recorded praise"] },
  incorrect: { phrases: ["Not quite. Let's try again!"] },
  empty: { phrases: ["nothing here"] },
};

/** Instances `new Audio()` handed out, so a test can inspect what was played. */
let played: { src: string; playbackRate: number; pause: ReturnType<typeof vi.fn> }[] = [];

beforeEach(() => {
  vi.resetModules();
  // The registry lives on globalThis so it survives Vite's HMR module
  // duplication; that also means it survives `resetModules`, so a test that
  // wants a clean slate has to say so.
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("koda.voiceClips")];
  played = [];
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      playbackRate = 1;
      play = vi.fn(async () => undefined);
      pause = vi.fn();
      addEventListener = vi.fn();
      constructor(src: string) {
        this.src = src;
        played.push(this as never);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fresh module with one skill's clips registered. */
const withClips = async (
  manifest: Record<string, string> = MANIFEST,
  files: Record<string, string> = FILES,
  groups: Record<string, { phrases?: string[] }> = GROUPS,
) => {
  const mod = await import("./voiceClips");
  mod.registerSkillVoice(manifest, files, groups);
  return mod;
};

describe("voiceClips", () => {
  it("registers only the clips whose file was emitted", async () => {
    const { clipCount } = await withClips();
    expect(clipCount()).toBe(5);
  });

  it("plays a recorded phrase from its emitted URL, matched on folder and file", async () => {
    const { playClip } = await withClips();
    expect(playClip("three")).toBe(true);
    expect(played[0].src).toBe("/assets/three-9f8e.wav");
  });

  it("reports a miss synchronously, so the caller can fall through", async () => {
    const { playClip } = await withClips();
    expect(playClip("a phrase nobody recorded")).toBe(false);
    expect(played).toHaveLength(0);
  });

  it("skips a manifest entry whose file is absent, rather than a broken URL", async () => {
    const { playClip } = await withClips();
    expect(playClip("never recorded")).toBe(false);
  });

  it("matches a phrase reflowed across lines in JSON", async () => {
    const { playClip } = await withClips();
    expect(playClip("  Look fast!   How many did you see?  ")).toBe(true);
  });

  it("does not match on case, which should sound different", async () => {
    const { playClip } = await withClips();
    expect(playClip("THREE")).toBe(false);
  });

  it("applies rate as playbackRate, clamped", async () => {
    const { playClip } = await withClips();
    playClip("three", 1.5);
    expect(played[0].playbackRate).toBe(1.5);
    playClip("three", 99);
    expect(played[1].playbackRate).toBe(2);
  });

  it("stops the previous line before starting the next", async () => {
    const { playClip } = await withClips();
    playClip("three");
    playClip("Look fast! How many did you see?");
    expect(played[0].pause).toHaveBeenCalled();
  });

  it("counts only the reaction variants that recorded", async () => {
    const { groupSize } = await withClips();
    // "Never recorded praise" is declared but has no clip.
    expect(groupSize("correct")).toBe(2);
    expect(groupSize("incorrect")).toBe(1);
    expect(groupSize("empty")).toBe(0);
  });

  it("plays a reaction from its group", async () => {
    const { playReaction } = await withClips();
    expect(playReaction("correct")).toBe(true);
    expect(played[0].src).toMatch(/nice-work|perfect/);
  });

  it("stays silent, not slow, when a reaction has no recordings", async () => {
    const { playReaction } = await withClips();
    expect(playReaction("empty")).toBe(false);
    expect(playReaction("no-such-group")).toBe(false);
    expect(played).toHaveLength(0);
  });

  it("never repeats a reaction variant back to back", async () => {
    const { playReaction } = await withClips();
    for (let i = 0; i < 20; i++) playReaction("correct");
    for (let i = 1; i < played.length; i++) {
      expect(played[i].src).not.toBe(played[i - 1].src);
    }
  });

  it("repeats a single-variant reaction rather than going silent", async () => {
    const { playReaction } = await withClips();
    expect(playReaction("incorrect")).toBe(true);
    expect(playReaction("incorrect")).toBe(true);
    expect(played).toHaveLength(2);
  });

  it("does not stack duplicates when a skill registers twice", async () => {
    const mod = await withClips();
    mod.registerSkillVoice(MANIFEST, FILES, GROUPS);
    mod.registerSkillVoice(MANIFEST, FILES, GROUPS);
    // Two recorded praise variants, however many times registration ran.
    expect(mod.groupSize("correct")).toBe(2);
    expect(mod.clipCount()).toBe(5);
  });

  it("an empty manifest is a normal state, not an error", async () => {
    const { playClip, clipCount } = await withClips({}, {}, {});
    expect(clipCount()).toBe(0);
    expect(playClip("three")).toBe(false);
  });
});

/**
 * A reaction is written for one subject and does not travel.
 *
 * Clips are deliberately shared — "seven" is "seven", and a second skill saying
 * it should not pay to record it again. Reactions are not: unscoped, counting's
 * eight praise clips answered addition's rounds, so a child who added 7 and 3
 * was told "Brilliant counting!" — and recording addition would have put "You
 * put them together!" into counting's rounds in return.
 */
describe("reactions belong to the skill that recorded them", () => {
  type VoiceModule = typeof import("./voiceClips");

  const registerCounting = (mod: VoiceModule) =>
    mod.registerSkillVoice(
      { "Brilliant counting!": "correct/brilliant.wav" },
      { "./audio/correct/brilliant.wav": "/a/brilliant.wav" },
      { correct: { phrases: ["Brilliant counting!"] } },
      "counting",
    );

  const registerAddition = (mod: VoiceModule) =>
    mod.registerSkillVoice(
      { "You put them together!": "correct/together.wav" },
      { "./audio/correct/together.wav": "/a/together.wav" },
      { correct: { phrases: ["You put them together!"] } },
      "addition",
    );

  it("plays each skill's own praise and never the other's", async () => {
    const mod = await import("./voiceClips");
    registerCounting(mod);
    registerAddition(mod);

    expect(mod.playReaction("correct", 1, "counting")).toBe(true);
    expect(played.at(-1)!.src).toBe("/a/brilliant.wav");

    expect(mod.playReaction("correct", 1, "addition")).toBe(true);
    expect(played.at(-1)!.src).toBe("/a/together.wav");
  });

  it("stays silent rather than borrowing words from a skill that did record", async () => {
    const mod = await import("./voiceClips");
    registerCounting(mod);
    // Addition declares the same group and has recorded none of it — which is
    // the normal state before anyone runs the recorder.
    mod.registerSkillVoice({}, {}, { correct: { phrases: ["You put them together!"] } }, "addition");

    expect(mod.playReaction("correct", 1, "addition")).toBe(false);
    expect(played).toHaveLength(0);
    // The skill that did record is unaffected.
    expect(mod.playReaction("correct", 1, "counting")).toBe(true);
  });

  it("still answers a caller that registered without a skill", async () => {
    // The unscoped pool: back-compat for a registration that names no skill.
    const { registerSkillVoice, playReaction } = await withClips();
    expect(playReaction("correct")).toBe(true);
    expect(registerSkillVoice).toBeTypeOf("function");
  });

  it("counts a skill's own variants, not the whole pool", async () => {
    const mod = await import("./voiceClips");
    registerCounting(mod);
    registerAddition(mod);
    expect(mod.groupSize("correct", "counting")).toBe(1);
    expect(mod.groupSize("correct", "addition")).toBe(1);
  });
});
