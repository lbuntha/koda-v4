import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdaptive, saveAdaptive } from "./prefs";
import { moodOf } from "./ui/RebusPlay";
import type { RoundState } from "./engine";

const mocks = vi.hoisted(() => ({ playReaction: vi.fn(() => true), playSound: vi.fn(), voice: { on: true } }));
vi.mock("../lib/voiceClips", async (original) => ({ ...(await original<typeof import("../lib/voiceClips")>()), playReaction: mocks.playReaction }));
vi.mock("../utils/audio", () => ({ playSound: mocks.playSound, isVoiceEnabled: () => mocks.voice.on }));

const { cue } = await import("./sound");

beforeEach(() => {
  localStorage.clear();
  mocks.playReaction.mockClear();
  mocks.playSound.mockClear();
  mocks.voice.on = true;
});

describe("the Machine's mood", () => {
  const at = (phase: RoundState["phase"], reason?: string) => ({ phase, last: reason ? { reason } : null }) as unknown as RoundState;

  it("thinks while a puzzle runs, slips when locked out, and reacts to who got the puzzle", () => {
    expect(moodOf(at("playing"), false)).toBe("thinking");
    expect(moodOf(at("playing"), true)).toBe("oops");
    expect(moodOf(at("revealed", "machine"), false)).toBe("cheer");
    expect(moodOf(at("revealed", "solved"), false)).toBe("groan");
    expect(moodOf(at("revealed", "time"), false)).toBe("shrug");
    expect(moodOf(at("revealed", "skipped"), false)).toBe("shrug");
  });
});

describe("where adaptive starts", () => {
  it("is medium until a round has been played, then wherever the last one ended", () => {
    expect(loadAdaptive()).toBe(1);
    saveAdaptive(2);
    expect(loadAdaptive()).toBe(2);
    saveAdaptive(0);
    expect(loadAdaptive()).toBe(0);
    localStorage.setItem("koda.rebus.adaptive", "junk");
    expect(loadAdaptive()).toBe(1);
  });
});

describe("what the game says aloud", () => {
  it("says the matching line for a cue, from Rebus Rush's own pack, and only when speech is on", () => {
    cue("solved");
    expect(mocks.playSound).toHaveBeenCalledWith("success");
    expect(mocks.playReaction).toHaveBeenCalledWith("rebus-solved", 1, "rebus");
    mocks.playReaction.mockClear();
    mocks.voice.on = false;
    cue("solved");
    expect(mocks.playSound).toHaveBeenCalledTimes(2);
    expect(mocks.playReaction).not.toHaveBeenCalled();
  });

  it("keeps a friend winning in a group from sounding like the Machine, and says nothing for the small cues", () => {
    cue("friendWon");
    expect(mocks.playReaction).toHaveBeenCalledWith("rebus-friendWon", 1, "rebus");
    mocks.playReaction.mockClear();
    cue("hintReady");
    cue("hintTaken");
    cue("pick");
    expect(mocks.playReaction).not.toHaveBeenCalled();
  });
});
