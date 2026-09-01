import { describe, expect, it } from "vitest";
import { composeHints, hintAt, playCopy, MAX_HINTS } from "./hints";

/**
 * The ladder's rules, which is all this file has.
 *
 * They matter because every activity builds its rungs as expressions that are
 * sometimes nothing — "you have ten ones, bundle them" only exists while the
 * child has ten ones — and a ladder that kept the blanks would open an empty
 * panel over the question a child is stuck on.
 */

describe("composeHints", () => {
  it("keeps the rungs in the order they were written", () => {
    expect(composeHints("Nudge.", "This question.", "Worked step.")).toEqual([
      "Nudge.",
      "This question.",
      "Worked step.",
    ]);
  });

  it("drops rungs that did not apply, without leaving a gap", () => {
    const ladder = composeHints("Nudge.", false && "Never.", undefined, "  ", "Worked step.");
    expect(ladder).toEqual(["Nudge.", "Worked step."]);
  });

  it("drops a rung the lesson already said", () => {
    // A lesson whose `kidTip` says what the activity's own first rung says
    // should cost the child one tap, not two.
    expect(composeHints("Count the empty boxes.", "count the empty boxes")).toEqual([
      "Count the empty boxes.",
    ]);
  });

  it("never grows past three rungs", () => {
    expect(composeHints("a", "b", "c", "d", "e")).toHaveLength(MAX_HINTS);
  });

  it("collapses stray whitespace, since these are read aloud", () => {
    expect(composeHints("Say  one\n  number.")).toEqual(["Say one number."]);
  });
});

describe("hintAt", () => {
  const ladder = ["one", "two"];

  it("is 1-based, matching the rung the log records", () => {
    expect(hintAt(ladder, 1)).toBe("one");
    expect(hintAt(ladder, 2)).toBe("two");
  });

  it("has nothing to show while the hint is closed", () => {
    expect(hintAt(ladder, 0)).toBeUndefined();
    expect(hintAt([], 1)).toBeUndefined();
  });

  it("clamps to the top rung when the ladder shrinks under the child", () => {
    // The rungs are rebuilt from live state on every render, so a ladder can
    // lose its conditional rung while it is open. Showing the last rung beats
    // blanking the panel mid-read.
    expect(hintAt(ladder, 3)).toBe("two");
  });
});

describe("playCopy", () => {
  it("reads the lesson's child-facing copy off the params it was mounted with", () => {
    const copy = playCopy({ play: { kidTip: "Say one number for each one.", audioPrompt: "Go!" } });
    expect(copy.kidTip).toBe("Say one number for each one.");
    expect(copy.audioPrompt).toBe("Go!");
  });

  it("is empty rather than thrown for a mount with no lesson copy", () => {
    expect(playCopy(undefined)).toEqual({});
    expect(playCopy({})).toEqual({});
    expect(playCopy({ play: "not an object" })).toEqual({});
  });
});
