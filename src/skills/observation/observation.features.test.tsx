import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/ObjectHunt";
import manifest from "./manifest.json";

const hunt = skill.activities["object-hunt"];
const params = { seed: "feature-switches", objectCount: 6, targetCount: 2, questionsPerRound: 1 };

/** Taps the scene button holding a given object id. */
const tapObject = (h: ReturnType<typeof renderActivity>, id: string) => {
  const index = buildQuestion(params, 1).objects.findIndex((object) => object.id === id);
  fireEvent.click(h.screen.getByRole("button", { name: `Search item ${index + 1}` }));
};

describe("every Observation feature changes behaviour", () => {
  it("declares each switch the activity reads", () => {
    const ids = manifest.features.map((feature) => feature.id);
    expect(ids).toEqual(expect.arrayContaining([
      "audio_speech", "sound_chimes", "haptic_feedback",
      "target_preview", "search_region_hints", "accessible_list_view",
    ]));
  });

  it("audio_speech silences the object-name replay", () => {
    const on = renderActivity(hunt, { params });
    expect(on.buttons().some((name) => /read .*aloud/i.test(name))).toBe(true);
    on.unmount();

    const off = renderActivity(hunt, { params, features: { audio_speech: false } });
    expect(off.buttons().some((name) => /read .*aloud/i.test(name))).toBe(false);
    expect(off.koda.count("speech.say")).toBe(0);
    off.unmount();
  });

  it("audio_speech gates the already-found reminder", () => {
    const target = buildQuestion(params, 1).targets[0];
    const retap = (h: ReturnType<typeof renderActivity>) => { tapObject(h, target); tapObject(h, target); };

    const on = renderActivity(hunt, { params });
    retap(on);
    expect(on.text()).toMatch(/already found/i);
    expect(on.koda.only("speech.say").map((call) => call.args[0])).toContain("You already found that one.");
    // A re-tap is not an answer: no extra chime, no submission.
    expect(on.koda.only("sound.play").map((call) => call.args[0])).toEqual(["pop"]);
    expect(on.koda.count("learning.answered")).toBe(0);
    on.unmount();

    const off = renderActivity(hunt, { params, features: { audio_speech: false } });
    retap(off);
    expect(off.text()).toMatch(/already found/i);
    expect(off.koda.count("speech.say")).toBe(0);
    off.unmount();
  });

  it("haptic_feedback gates the SDK vibration", () => {
    const target = buildQuestion(params, 1).targets[0];

    const on = renderActivity(hunt, { params });
    tapObject(on, target);
    expect(on.koda.count("haptics.tap")).toBeGreaterThan(0);
    on.unmount();

    const off = renderActivity(hunt, { params, features: { haptic_feedback: false } });
    tapObject(off, target);
    expect(off.koda.count("haptics.tap")).toBe(0);
    off.unmount();
  });

  it("target_preview swaps the tray art for a neutral placeholder", () => {
    const on = renderActivity(hunt, { params });
    const shown = on.screen.getByLabelText("Objects to find").querySelectorAll("svg").length;
    expect(shown).toBeGreaterThan(0);
    on.unmount();

    const off = renderActivity(hunt, { params, features: { target_preview: false } });
    const tray = off.screen.getByLabelText("Objects to find");
    expect(tray.querySelectorAll("svg")).toHaveLength(0);
    expect(tray.textContent).toContain("?");
    off.unmount();
  });

  it("search_region_hints removes the hint ladder", () => {
    const on = renderActivity(hunt, { params });
    expect(on.buttons().some((name) => /hint/i.test(name))).toBe(true);
    on.unmount();

    const off = renderActivity(hunt, { params, features: { search_region_hints: false } });
    expect(off.buttons().some((name) => /hint/i.test(name))).toBe(false);
    off.unmount();
  });

  it("accessible_list_view removes the labelled alternative to the scene", () => {
    const on = renderActivity(hunt, { params });
    expect(on.buttons()).toContain("List");
    fireEvent.click(on.screen.getByRole("button", { name: "List" }));
    expect(on.screen.queryByLabelText("Labelled search candidates")).not.toBeNull();
    on.unmount();

    const off = renderActivity(hunt, { params, features: { accessible_list_view: false } });
    expect(off.buttons()).not.toContain("List");
    expect(off.screen.queryByLabelText("Labelled search candidates")).toBeNull();
    expect(off.screen.queryByLabelText(/hidden object game/)).not.toBeNull();
    off.unmount();
  });
});
