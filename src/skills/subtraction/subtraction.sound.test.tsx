import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { CHROME_ONLY, SUBTRACTION_SOUND } from "./internal/data/subtractionSound";

/**
 * Sound is a channel a child reads moves with, and it only works if the same
 * event sounds the same way everywhere.
 *
 * Each of these pins a drift that had already happened. A refused move made no
 * sound in Subtraction while the identical refusal chimed in Addition. Two of
 * the three undo controls were silent while every other move in the same engine
 * popped. The third played the same tone as the jump it was undoing, so a tap
 * that went backwards and a tap that took the backwards tap away were
 * indistinguishable with the screen unwatched.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIVITIES = join(HERE, "activities");
const sourceOf = (name: string) => readFileSync(join(ACTIVITIES, name), "utf8");
const played = (h: ActivityHarness) => h.koda.only("sound.play").map((call) => call.args[0]);

describe("the subtraction sound map", () => {
  it("uses only tones the SDK actually makes", () => {
    const real = ["pop", "clink", "success", "hint", "levelup", "error"];
    for (const tone of Object.values(SUBTRACTION_SOUND)) expect(real).toContain(tone);
  });

  it("keeps undo from sounding like the move it reverses", () => {
    expect(SUBTRACTION_SOUND.undone).not.toBe(SUBTRACTION_SOUND.changed);
  });

  it("plays no tone an activity has no business playing", () => {
    for (const file of readdirSync(ACTIVITIES)) {
      const code = sourceOf(file);
      for (const tone of CHROME_ONLY) {
        expect(code.includes(`sound.play("${tone}")`), `${file} plays ${tone} itself`).toBe(false);
      }
    }
  });

  /*
   * Every engine used to write the same two lines — read `sound_chimes`, then
   * guard the call on it — which is one chance per copy to forget the guard.
   * Nothing reaches the SDK except through `chime`, so the gate is in one place
   * and a call site names the event rather than the tone.
   */
  it("lets nothing reach the SDK except through the one gated helper", () => {
    for (const file of readdirSync(ACTIVITIES)) {
      const code = sourceOf(file);
      expect(code.includes("sound.play("), `${file} calls sound.play directly`).toBe(false);
      expect(code.includes('isEnabled("sound_chimes"'), `${file} re-reads the chimes switch`).toBe(false);
    }
  });

  it("names only events the map knows", () => {
    const known = new Set(Object.keys(SUBTRACTION_SOUND));
    for (const file of readdirSync(ACTIVITIES)) {
      for (const match of sourceOf(file).matchAll(/chime\(koda,\s*"([a-z]+)"/g)) {
        expect(known.has(match[1]), `${file} chimes "${match[1]}", which the map does not name`).toBe(true);
      }
    }
  });
});

describe("an answer is always heard", () => {
  /*
   * Two channels, not one doubled. The chime rides `sound_chimes`; the spoken
   * reaction rides `audio_speech` and only fires for phrases that have been
   * recorded. Drop the chime — as this once did, on a misreading of Addition —
   * and a child with the voice off, or a skill whose clips are not cut yet,
   * gets nothing back for an answer at all.
   */
  const answer = async (given: string) => {
    const h = renderActivity(skill.activities.bonds, {
      params: { mode: "part_unknown", minuendRange: [8, 8], subtrahendRange: [3, 3] }, level: 13,
    });
    await h.press(given);
    await h.press("Check");
    const tones = played(h);
    h.unmount();
    return tones;
  };

  it("chimes a right answer", async () => {
    expect(await answer("5")).toContain(SUBTRACTION_SOUND.right);
  });

  it("chimes a wrong one too, rather than leaving it silent", async () => {
    expect(await answer("4")).toContain(SUBTRACTION_SOUND.wrong);
  });

  it("judges an answer with the same pair the other skills use", () => {
    // Read from Counting and Addition rather than restated here, so this fails
    // if the house convention moves rather than quietly describing an old one.
    const elsewhere = ["addition", "counting"].flatMap((id) => {
      const dir = join(HERE, "..", id, "activities");
      return readdirSync(dir).flatMap((file) =>
        [...readFileSync(join(dir, file), "utf8")
          .matchAll(/(?:playChrome\(koda,|chime\(|sound\.play\()\s*correct \? "([a-z]+)" : "([a-z]+)"/g)]);
    });
    expect(elsewhere.length, "no answer chime found in addition or counting").toBeGreaterThan(0);
    for (const [, right, wrong] of elsewhere) {
      expect(right).toBe(SUBTRACTION_SOUND.right);
      expect(wrong).toBe(SUBTRACTION_SOUND.wrong);
    }
  });
});

describe("a refused move is heard as well as felt", () => {
  it("chimes when the block desk will not accept a Check", async () => {
    const h = renderActivity(skill.activities.base10, {
      params: { mode: "trade_ten", minuendRange: [52, 52], subtrahendRange: [18, 18] }, level: 36,
    });
    await h.press("Check");
    expect(h.koda.count("learning.answered"), "the refusal was scored").toBe(0);
    expect(played(h)).toContain(SUBTRACTION_SOUND.refused);
    h.unmount();
  });

  it("stays silent when the parent has switched the chimes off", async () => {
    const h = renderActivity(skill.activities.base10, {
      params: { mode: "trade_ten", minuendRange: [52, 52], subtrahendRange: [18, 18] }, level: 36,
      features: { sound_chimes: false },
    });
    await h.press("Check");
    expect(h.koda.count("sound.play")).toBe(0);
    h.unmount();
  });
});

describe("taking a move back is audible", () => {
  it("sounds the tray's undo", async () => {
    const h = renderActivity(skill.activities.tray, {
      params: { mode: "remove", minuendRange: [6, 6], subtrahendRange: [3, 3] }, level: 1,
    });
    await h.press(h.buttons().find((name) => /^\w+ 1$/.test(name))!);
    const before = h.koda.count("sound.play");
    await h.press("Undo last move");
    expect(h.koda.count("sound.play"), "undo made no sound").toBe(before + 1);
    expect(played(h).at(-1)).toBe(SUBTRACTION_SOUND.undone);
    h.unmount();
  });

  it("sounds the frame's put-back", async () => {
    const h = renderActivity(skill.activities.frames, {
      params: { mode: "five", minuendRange: [5, 5], subtrahendRange: [2, 2] }, level: 11,
    });
    await h.press("Frame space 1, filled");
    const before = h.koda.count("sound.play");
    await h.press("Put back the last counter");
    expect(h.koda.count("sound.play"), "putting a counter back made no sound").toBe(before + 1);
    expect(played(h).at(-1)).toBe(SUBTRACTION_SOUND.undone);
    h.unmount();
  });

  it("gives the line's undo a different tone from the jump it undoes", async () => {
    const h = renderActivity(skill.activities.numberline, {
      params: { mode: "path_back", minuendRange: [9, 9], subtrahendRange: [4, 4] }, level: 14,
    });
    await h.press(h.buttons().find((name) => /^Jump back/.test(name))!);
    const jump = played(h).at(-1);
    await h.press("Undo last jump");
    expect(played(h).at(-1), "undo sounds exactly like the jump it reverses").not.toBe(jump);
    expect(played(h).at(-1)).toBe(SUBTRACTION_SOUND.undone);
    h.unmount();
  });
});
