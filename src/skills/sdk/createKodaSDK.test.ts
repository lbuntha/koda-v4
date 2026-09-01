import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createKodaSDK, type KodaHost } from "./createKodaSDK";
import { PreferencesAPI } from "../../lib/preferences";
import { holdVoiceFloor } from "../../lib/voiceClips";

/**
 * Every word any skill speaks goes through `speech.say`.
 *
 * That makes it the one place the voice-coach rule can be enforced, and the one
 * place worth testing it: counting, addition and every skill after them inherit
 * the behaviour without opting in, so a per-skill test would prove nothing a new
 * skill could not quietly miss.
 *
 * The rule is that a skill yields the speaker while the coach is live. Not
 * politeness — the coach holds an open microphone, so a lesson counting "four,
 * five, six" over the top is fed back into the conversation as though the child
 * had said it.
 */

const host: KodaHost = {
  awardXp: () => {},
  completeSkill: () => {},
  getSnapshot: () => ({
    xp: 0,
    level: 1,
    streakDays: 0,
    problemsSolved: 0,
    dailyGoal: 5,
    dailySolved: 0,
  }),
  theme: "light",
  exit: () => {},
};

let spoken: string[] = [];
let fetched: string[] = [];

beforeEach(() => {
  // The registry lives on globalThis so it survives Vite's module duplication;
  // that also means it survives between tests, so a clean slate is asked for.
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("koda.voiceClips")];
  spoken = [];
  fetched = [];

  PreferencesAPI.update({ voiceEnabled: true });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      fetched.push(path);
      // No key configured is the documented answer here, and it sends the
      // caller on to the browser's own voice.
      return { ok: true, json: async () => ({ audio: null }) };
    }),
  );
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      onend?: () => void;
      onerror?: () => void;
      rate = 1;
      pitch = 1;
      constructor(public text: string) {}
    },
  );
  vi.stubGlobal("speechSynthesis", {
    cancel: vi.fn(),
    speak: (utterance: { text: string; onend?: () => void }) => {
      spoken.push(utterance.text);
      utterance.onend?.();
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a skill's voice yields to the voice coach", () => {
  it("speaks when nothing else has the speaker", async () => {
    const koda = createKodaSDK("addition", host);
    await koda.speech.say("Put them together!");
    expect(spoken).toEqual(["Put them together!"]);
  });

  it("says nothing while Koda holds the floor", async () => {
    const koda = createKodaSDK("addition", host);
    holdVoiceFloor("voice-coach");

    await koda.speech.say("seven");
    expect(spoken, "a skill spoke over the coach").toHaveLength(0);
  });

  it("does not even ask the server for a line nobody will hear", async () => {
    // The gate is before the network, not after it: a suppressed line should
    // cost nothing, and on a per-tap counter it would cost a round trip each.
    const koda = createKodaSDK("counting", host);
    holdVoiceFloor("voice-coach");

    await koda.speech.say("four");
    expect(fetched).toHaveLength(0);
  });

  it("resolves rather than hanging, so a round never stalls behind a sound", async () => {
    // `useSkillRound` awaits the last spoken number before it submits. If a
    // suppressed line rejected or never settled, the answer would never land.
    const koda = createKodaSDK("addition", host);
    holdVoiceFloor("voice-coach");

    await expect(koda.speech.say("ten")).resolves.toBeUndefined();
  });

  it("speaks again once the coach gives the speaker back", async () => {
    const koda = createKodaSDK("addition", host);
    const release = holdVoiceFloor("voice-coach");

    await koda.speech.say("hidden");
    release();
    await koda.speech.say("heard");

    expect(spoken).toEqual(["heard"]);
  });
});

/**
 * The two switches a family actually turns.
 *
 * Both were read somewhere before this, and neither was read everywhere: the
 * count-along honoured the per-skill feature and the Read-aloud button did not,
 * and the learner's own voice preference was consulted by praise alone. So a
 * lesson with its voice switched off still read the question aloud the moment it
 * opened, which is the one line a child hears on every single question.
 */
describe("whether a skill may speak at all", () => {
  const withFeature = (isEnabled: boolean) =>
    createKodaSDK("addition", host, {
      features: [
        {
          id: "audio_speech",
          name: "Spoken voice",
          description: "",
          isEnabled,
        },
      ],
      settings: {},
    });

  it("speaks with both switches on", async () => {
    await withFeature(true).speech.say("Count them all.");
    expect(spoken).toEqual(["Count them all."]);
  });

  it("says nothing when the skill's voice feature is off", async () => {
    // Including the line the round speaks the instant a question opens, which
    // is what a parent turning this off is actually trying to stop.
    await withFeature(false).speech.say("Count them all.");
    expect(spoken).toHaveLength(0);
    expect(fetched, "a silenced line still cost a round trip").toHaveLength(0);
  });

  it("says nothing when the learner has turned Koda's voice off", async () => {
    PreferencesAPI.update({ voiceEnabled: false });
    await withFeature(true).speech.say("Count them all.");
    expect(spoken).toHaveLength(0);
  });

  it("defaults to speaking for a skill that declares no such feature", async () => {
    // A skill that never mentions `audio_speech` has not opted out of talking.
    await createKodaSDK("some-skill", host).speech.say("Hello.");
    expect(spoken).toEqual(["Hello."]);
  });
});

