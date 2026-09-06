import { describe, expect, it } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/BottleSort";
import { canPour, isSolvedRack, legalPours, pour } from "./internal/pour";
import { minimumPours } from "./internal/solve";
import type { Rack } from "./internal/types";

/**
 * Phase 7: every switch does something, and a keyboard finishes a rack.
 *
 * A declared feature that changes nothing is a dead control — an adult turns
 * it off, nothing happens, and the setting has lied. So each one is asserted
 * by behaviour rather than by being read. And a rack that can only be sorted
 * with a pointer is a rack half the children who need this skill cannot play.
 */
const sort = skill.activities.sort;
const params = { spec: "sort-three-colours", questionsPerRound: 1, seed: "phase7" };
const bottleAt = (i: number) => document.querySelector(`[data-bottle="${i}"]`) as HTMLElement;
const rackEl = () => bottleAt(0).parentElement as HTMLElement;

describe("the rack from a keyboard", () => {
  it("moves between bottles with the arrows, and wraps at both ends", async () => {
    const h = renderActivity(sort, { params });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    const count = document.querySelectorAll("[data-bottle]").length;

    bottleAt(0).focus();
    fireEvent.keyDown(rackEl(), { key: "ArrowRight" });
    expect(document.activeElement).toBe(bottleAt(1));
    fireEvent.keyDown(rackEl(), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(bottleAt(0));

    // A rack is a ring, not a list with ends.
    fireEvent.keyDown(rackEl(), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(bottleAt(count - 1));
    fireEvent.keyDown(rackEl(), { key: "ArrowRight" });
    expect(document.activeElement).toBe(bottleAt(0));

    fireEvent.keyDown(rackEl(), { key: "End" });
    expect(document.activeElement).toBe(bottleAt(count - 1));
    fireEvent.keyDown(rackEl(), { key: "Home" });
    expect(document.activeElement).toBe(bottleAt(0));
    h.unmount();
  });

  it("puts a picked-up bottle down again with Escape", async () => {
    const question = buildQuestion(params, 1);
    const h = renderActivity(sort, { params });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    const from = legalPours(question.rack)[0].from;

    fireEvent.click(bottleAt(from));
    expect(bottleAt(from).getAttribute("data-picked")).toBe("true");
    // ...and it says so, rather than only looking raised.
    expect(bottleAt(from).getAttribute("aria-pressed")).toBe("true");

    fireEvent.keyDown(rackEl(), { key: "Escape" });
    await waitFor(() => expect(bottleAt(from).getAttribute("data-picked")).toBe("false"));
    expect(bottleAt(from).getAttribute("aria-pressed")).toBe("false");
    h.unmount();
  });

  it("finishes a whole rack without a pointer", async () => {
    // Arrow to the bottle, then activate it. Activation is the button's own —
    // Enter fires a click on a focused button — so this drives the same path a
    // keyboard does, and never touches a bottle by position.
    const question = buildQuestion(params, 1);
    const h = renderActivity(sort, { params });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));

    const arrowTo = (target: number) => {
      const at = () => [...document.querySelectorAll("[data-bottle]")]
        .findIndex((b) => b === document.activeElement);
      let guard = 0;
      while (at() !== target && guard < 40) {
        fireEvent.keyDown(rackEl(), { key: "ArrowRight" });
        guard += 1;
      }
      expect(at(), "arrows never reached the bottle").toBe(target);
      fireEvent.click(document.activeElement as HTMLElement);
    };

    let rack = question.rack as Rack;
    bottleAt(0).focus();
    for (let step = 0; step < 40 && !isSolvedRack(rack); step += 1) {
      const best = legalPours(rack)
        .map((m) => ({ m, after: pour(rack, m.from, m.to) }))
        .filter(({ after }) => minimumPours(after).moves !== null)
        .sort((a, b) => (minimumPours(a.after).moves ?? 99) - (minimumPours(b.after).moves ?? 99))[0];
      if (!best) break;
      arrowTo(best.m.from);
      arrowTo(best.m.to);
      rack = best.after;
    }

    expect(isSolvedRack(rack), "the solver's own line did not finish").toBe(true);
    await waitFor(() => expect(h.koda.count("learning.answered")).toBe(1));
    h.unmount();
  }, 20000);
});

describe("every switch the manifest declares", () => {
  const featureOff = (id: string) => ({ params, features: { [id]: false } });

  it("pour_animation off lands the identical rack", async () => {
    const question = buildQuestion(params, 1);
    const move = legalPours(question.rack)[0];
    const expected = pour(question.rack, move.from, move.to);

    const h = renderActivity(sort, featureOff("pour_animation"));
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    fireEvent.click(bottleAt(move.from));
    fireEvent.click(bottleAt(move.to));
    // No stream is ever drawn, and the rack is the one the rules decided.
    expect(document.querySelector("[data-stream]")).toBeNull();
    await waitFor(() => expect(bottleAt(move.to).getAttribute("aria-label"))
      .toContain(`holds ${expected[move.to].cap}.`));
    h.unmount();
  });

  it("sound_chimes off plays nothing at all", async () => {
    const question = buildQuestion(params, 1);
    const move = legalPours(question.rack)[0];
    const h = renderActivity(sort, featureOff("sound_chimes"));
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    fireEvent.click(bottleAt(move.from));
    fireEvent.click(bottleAt(move.to));
    await waitFor(() => expect(bottleAt(move.from).getAttribute("data-picked")).toBe("false"));
    expect(h.koda.count("sound.play")).toBe(0);
    h.unmount();
  });

  it("haptic_feedback off buzzes nothing", async () => {
    const question = buildQuestion(params, 1);
    const move = legalPours(question.rack)[0];
    const h = renderActivity(sort, featureOff("haptic_feedback"));
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    fireEvent.click(bottleAt(move.from));
    fireEvent.click(bottleAt(move.to));
    await waitFor(() => expect(bottleAt(move.from).getAttribute("data-picked")).toBe("false"));
    expect(h.koda.count("haptics.tap") + h.koda.count("haptics.success") + h.koda.count("haptics.pulse")).toBe(0);
    h.unmount();
  });

  it("move_hints off offers no ladder", async () => {
    const on = renderActivity(sort, { params });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    expect(on.screen.queryByRole("button", { name: /hint/i })).not.toBeNull();
    on.unmount();

    const off = renderActivity(sort, featureOff("move_hints"));
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    expect(off.screen.queryByRole("button", { name: /hint/i })).toBeNull();
    off.unmount();
  });

  it("audio_speech off says nothing when a pour is refused", async () => {
    const question = buildQuestion(params, 1);
    const refused = question.rack
      .flatMap((_, a) => question.rack.map((__, b) => ({ from: a, to: b })))
      .find((m) => m.from !== m.to && question.rack[m.from].seg.length > 0 && !canPour(question.rack, m.from, m.to))!;

    const h = renderActivity(sort, featureOff("audio_speech"));
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    fireEvent.click(bottleAt(refused.from));
    fireEvent.click(bottleAt(refused.to));
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});
