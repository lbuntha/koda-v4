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

  it("counts a skill's own variants and the common pack's, not another skill's", async () => {
    const mod = await import("./voiceClips");
    registerCounting(mod);
    registerAddition(mod);
    expect(mod.groupSize("correct", "counting")).toBe(1);
    expect(mod.groupSize("correct", "addition")).toBe(1);

    // The common pack is every skill's to draw on, so it counts for both.
    mod.registerCommonVoice(
      { "Perfect!": "correct/perfect.wav" },
      { "./audio/correct/perfect.wav": "/common/perfect.wav" },
      { correct: { phrases: ["Perfect!"] } },
    );
    expect(mod.groupSize("correct", "counting")).toBe(2);
    expect(mod.groupSize("correct", "addition")).toBe(2);
  });
});

/**
 * The common pack — what the app says the same way in every skill.
 *
 * Numbers, and praise that names no subject. It used to live inside counting,
 * so addition's count-along was instant only because counting happened to be
 * installed: a shared asset owned by one skill, whose removal would have taken
 * every other skill's numbers with it.
 *
 * Two rules make sharing safe, and both are here. A skill's own recording of a
 * line wins, so the pack fills gaps rather than overwriting. And its reactions
 * are added to a skill's own rather than replacing them — while still never
 * reaching across from one skill to another, which is the line scoping drew.
 */
describe("the common pack", () => {
  type VoiceModule = typeof import("./voiceClips");

  const registerCommon = (mod: VoiceModule) =>
    mod.registerCommonVoice(
      { seven: "numbers/seven.wav", "Perfect!": "correct/perfect.wav" },
      {
        "./audio/numbers/seven.wav": "/common/seven.wav",
        "./audio/correct/perfect.wav": "/common/perfect.wav",
      },
      { correct: { phrases: ["Perfect!"] } },
    );

  const registerCounting = (mod: VoiceModule) =>
    mod.registerSkillVoice(
      { "Brilliant counting!": "correct/brilliant.wav" },
      { "./audio/correct/brilliant.wav": "/a/brilliant.wav" },
      { correct: { phrases: ["Brilliant counting!"] } },
      "counting",
    );

  it("says a line no skill recorded", async () => {
    const mod = await import("./voiceClips");
    registerCommon(mod);
    expect(mod.clipUrl("seven")).toBe("/common/seven.wav");
  });

  it("never overwrites a skill that recorded the line its own way", async () => {
    const mod = await import("./voiceClips");
    mod.registerSkillVoice(
      { seven: "numbers/seven.wav" },
      { "./audio/numbers/seven.wav": "/counting/seven.wav" },
      {},
      "counting",
    );
    registerCommon(mod);
    expect(mod.clipUrl("seven"), "the pack clobbered a skill's own voice").toBe(
      "/counting/seven.wav",
    );
  });

  it("is overwritten by a skill that records the line afterwards", async () => {
    // Order must not decide it: the pack fills gaps whichever way round the two
    // registrations happen to run.
    const mod = await import("./voiceClips");
    registerCommon(mod);
    mod.registerSkillVoice(
      { seven: "numbers/seven.wav" },
      { "./audio/numbers/seven.wav": "/counting/seven.wav" },
      {},
      "counting",
    );
    expect(mod.clipUrl("seven")).toBe("/counting/seven.wav");
  });

  it("gives a skill with no reactions of its own something to say", async () => {
    const mod = await import("./voiceClips");
    registerCommon(mod);
    // Addition has declared the group and recorded none of it — the state every
    // new skill ships in.
    mod.registerSkillVoice({}, {}, { correct: { phrases: ["Great adding!"] } }, "addition");

    expect(mod.playReaction("correct", 1, "addition")).toBe(true);
    expect(played.at(-1)!.src).toBe("/common/perfect.wav");
  });

  it("is heard alongside a skill's own words, not instead of them", async () => {
    // A skill with one recorded line would otherwise repeat it after every
    // answer for the whole round while the neutral ones sat unused.
    const mod = await import("./voiceClips");
    registerCommon(mod);
    registerCounting(mod);

    const heard = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      mod.playReaction("correct", 1, "counting");
      heard.add(played.at(-1)!.src);
    }
    expect(heard).toEqual(new Set(["/a/brilliant.wav", "/common/perfect.wav"]));
  });

  it("still keeps one skill's words out of another skill's round", async () => {
    const mod = await import("./voiceClips");
    registerCommon(mod);
    registerCounting(mod);
    mod.registerSkillVoice({}, {}, { correct: { phrases: ["Great adding!"] } }, "addition");

    for (let i = 0; i < 12; i += 1) {
      expect(mod.playReaction("correct", 1, "addition")).toBe(true);
      expect(played.at(-1)!.src, "counting's praise reached an addition round").toBe(
        "/common/perfect.wav",
      );
    }
  });
});

/**
 * Who has the speaker.
 *
 * A skill talks at a child; the voice coach talks with them, over an open
 * microphone. Counting "four, five, six" over the top of Koda is not just rude
 * — the mic hears the count and answers it as though the child had spoken.
 */
describe("the voice floor", () => {
  it("silences a skill's praise while Koda has the floor", async () => {
    const { playReaction, holdVoiceFloor } = await withClips();

    expect(playReaction("correct")).toBe(true);
    played = [];

    const release = holdVoiceFloor("voice-coach");
    expect(playReaction("correct"), "a skill spoke over the coach").toBe(false);
    expect(played).toHaveLength(0);

    release();
    expect(playReaction("correct")).toBe(true);
  });

  it("cuts off the line already playing when the floor is taken", async () => {
    // A child taps Koda mid-count, which is exactly when this happens: the
    // number in flight has to stop rather than finish over the greeting.
    const { playClip, holdVoiceFloor } = await withClips();
    expect(playClip("three")).toBe(true);
    const stopped = played.at(-1)!.pause;

    holdVoiceFloor("voice-coach");
    expect(stopped).toHaveBeenCalled();
  });

  it("tells the caller the speaker is taken", async () => {
    const { holdVoiceFloor, voiceFloorHeld } = await withClips();
    expect(voiceFloorHeld()).toBe(false);
    const release = holdVoiceFloor("voice-coach");
    expect(voiceFloorHeld()).toBe(true);
    release();
    expect(voiceFloorHeld()).toBe(false);
  });

  it("a stale release cannot hand the speaker back under a live holder", async () => {
    // A modal that has been replaced still runs its cleanup. If that cleared
    // the floor, the skill would start talking over the conversation that
    // replaced it.
    const { holdVoiceFloor, voiceFloorHeld } = await withClips();
    const releaseFirst = holdVoiceFloor("first");
    holdVoiceFloor("second");
    releaseFirst();
    expect(voiceFloorHeld(), "a stale cleanup released a live floor").toBe(true);
  });
});

