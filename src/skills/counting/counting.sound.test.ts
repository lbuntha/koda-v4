import { describe, expect, it, vi } from "vitest";

import { playChrome } from "../kit";
import { createFakeKoda } from "../kit/testing";
import { renderActivity } from "../kit/testing";
import { skill } from ".";

/**
 * Sound has two switches, and the narrow one has to actually work.
 *
 * `soundEnabled` in Settings is the family-wide master — one control a parent
 * can reach on a bus. `sound_chimes` is this skill's own, so counting can be
 * silenced without silencing everything else.
 *
 * The second is easy to add to a manifest and forget to read. An activity that
 * ignores it looks fine in every manual test — the master switch still works —
 * and the per-skill control is quietly decorative. That is exactly what the
 * round chrome was doing: three of its own buttons popped unconditionally.
 */

const { orbit, subitize, tenframe, numberline, base10 } = skill.activities;
const ACTIVITIES = [
  ["orbit", orbit],
  ["subitize", subitize],
  ["tenframe", tenframe],
  ["numberline", numberline],
  ["base10", base10],
] as const;

/**
 * Controls that belong to the round's frame rather than to the activity.
 *
 * Skipped when driving an activity because they open panels and leave the round
 * — pressing them indiscriminately left modals and timers running that bled into
 * whatever test file ran next. The chrome's own sound is covered directly below.
 */
const CHROME = /ask koda|leave this round|more options|read question aloud|hint|fullscreen|activity log/i;

describe("each activity honours the skill's own chimes switch", () => {
  it.each(ACTIVITIES)("%s stays silent when the feature is off", async (_name, activity) => {
    const h = renderActivity(activity, { features: { sound_chimes: false } });

    for (const label of h.buttons().filter((b) => !CHROME.test(b))) {
      try {
        await h.press(label);
        await h.settle();
      } catch {
        /* a control that vanished mid-round is not a sound bug */
      }
    }

    expect(h.koda.count("sound.play"), "silenced skill played a chime").toBe(0);
    h.unmount();
  });
});

describe("the round chrome honours it too", () => {
  it("pops when the skill wants chimes", () => {
    const koda = createFakeKoda({ features: { sound_chimes: true } }).sdk;
    const play = vi.spyOn(koda.sound, "play");
    playChrome(koda, "pop");
    expect(play).toHaveBeenCalledWith("pop");
  });

  it("stays silent when the skill does not", () => {
    const koda = createFakeKoda({ features: { sound_chimes: false } }).sdk;
    const play = vi.spyOn(koda.sound, "play");
    playChrome(koda, "pop");
    expect(play, "chrome popped in a silenced skill").not.toHaveBeenCalled();
  });

  it("defaults to on, so a skill that never declares the feature is unchanged", () => {
    const koda = createFakeKoda().sdk;
    const play = vi.spyOn(koda.sound, "play");
    playChrome(koda, "pop");
    expect(play).toHaveBeenCalledWith("pop");
  });
});
