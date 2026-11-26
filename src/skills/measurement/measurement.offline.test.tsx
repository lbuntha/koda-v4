import { afterEach, describe, expect, it, vi } from "vitest";
import { renderActivity } from "../kit/testing";
import { markHowToPlaySeen } from "../kit";
import { skill } from ".";

/*
 * Offline is a requirement (unstable internet): every lesson must make its
 * questions, draw its instruments and take an answer with no network at all.
 * Any fetch or XHR here fails the test.
 */
describe("Measure It offline", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(skill.lessons.map((l) => [l.id, l] as const))("%s plays with the network gone", async (_, lesson) => {
    const network = vi.fn(() => {
      throw new Error("network used");
    });
    vi.stubGlobal("fetch", network);
    vi.stubGlobal("XMLHttpRequest", network);
    for (const id of ["compare", "order", "balance", "pour", "jug", "units", "ruler-read", "ruler-place", "ruler-draw", "estimate", "scale", "thermo", "story"]) markHowToPlaySeen(`measurement/${id}`);

    const engine = skill.activities[lesson.activity.split("/")[1] as keyof typeof skill.activities];
    const h = renderActivity(engine, { skillId: "measurement", settings: { praiseMs: 0 }, params: lesson.params as Record<string, unknown> });
    expect(h.text().length).toBeGreaterThan(0);
    // Tap every enabled move once: weigh, pour, pick. Nothing may reach the network.
    for (const name of h.buttons().filter((b) => !/hint|read|exit|close|how to play/i.test(b)).slice(0, 6)) {
      if (h.buttons().includes(name)) await h.press(name);
    }
    await h.settle();
    expect(network).not.toHaveBeenCalled();
    h.unmount();
  });
});
