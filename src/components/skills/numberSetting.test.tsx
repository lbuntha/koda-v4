import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { NumberSetting } from "./SkillManagerPage";
import type { SettingField } from "../../skills/types";

/**
 * Typing a number into a settings row.
 *
 * The control was a slider and a read-only readout, which is right for a value
 * that is felt — speech rate — and wrong for one that is known. "Ten free
 * lessons" is a number an operator already has in mind, and a hundred-step
 * slider made them hunt for it.
 *
 * What is tested is the typing, because that is the part with edges: a field
 * being cleared before it is retyped, a number outside the range a skill
 * declared, and a keystroke that is not yet a number.
 */

const field = (over: Partial<Extract<SettingField, { type: "number" }>> = {}) =>
  ({
    key: "freeLessons",
    label: "Free lessons",
    type: "number",
    min: 0,
    max: 100,
    step: 1,
    ...over,
  }) as Extract<SettingField, { type: "number" }>;

/** The row as the page mounts it: the value lives above and comes back down. */
const Harness: React.FC<{
  field: Extract<SettingField, { type: "number" }>;
  initial: number;
  onValue?: (n: number) => void;
}> = ({ field: f, initial, onValue }) => {
  const [value, setValue] = useState<number>(initial);
  return (
    <NumberSetting
      field={f}
      value={value}
      disabled={false}
      onChange={(n) => {
        setValue(n);
        onValue?.(n);
      }}
    />
  );
};

const box = () => screen.getByLabelText("Free lessons") as HTMLInputElement;
const slider = () => screen.getByLabelText("Free lessons slider") as HTMLInputElement;

/** Clear the field and type, the way somebody replacing a number does. */
const retype = (next: string) => {
  fireEvent.focus(box());
  fireEvent.change(box(), { target: { value: "" } });
  fireEvent.change(box(), { target: { value: next } });
};

describe("typing a number into a skill setting", () => {
  it("takes the number that was typed", () => {
    render(<Harness field={field()} initial={10} />);
    expect(box().value).toBe("10");

    retype("5");
    expect(box().value).toBe("5");
    fireEvent.blur(box());
    expect(box().value).toBe("5");
    // The slider follows, so the two halves of the control never disagree.
    expect(slider().value).toBe("5");
  });

  it("survives being cleared on the way to a new number", () => {
    /* The case a plain controlled input gets wrong: an empty box is not a
       number, and writing it through snaps the value back under the cursor —
       so "10" can never be retyped as "5" without deleting one digit at a
       time. The draft is the field's own until it loses focus. */
    render(<Harness field={field()} initial={10} />);

    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value: "" } });
    expect(box().value).toBe("");

    fireEvent.change(box(), { target: { value: "5" } });
    expect(box().value).toBe("5");
  });

  it("keeps a value inside the range the skill declared", () => {
    const seen: number[] = [];
    render(<Harness field={field()} initial={10} onValue={(n) => seen.push(n)} />);

    retype("400");
    fireEvent.blur(box());
    expect(box().value).toBe("100");
    expect(seen.at(-1)).toBe(100);

    retype("-3");
    fireEvent.blur(box());
    expect(box().value).toBe("0");
    expect(seen.at(-1)).toBe(0);
  });

  it("puts an abandoned edit back rather than writing nonsense", () => {
    const seen: number[] = [];
    render(<Harness field={field()} initial={10} onValue={(n) => seen.push(n)} />);

    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value: "" } });
    fireEvent.blur(box());

    expect(box().value).toBe("10");
    expect(seen, "an empty box was written through as a value").toEqual([]);
  });

  it("lands on a declared step, so a slider value is never off the notches", () => {
    /* Speech rate: 0.5 to 2.0 in twentieths. Typing 1.07 is not one of them. */
    const seen: number[] = [];
    render(
      <Harness
        field={field({ key: "speechRate", label: "Free lessons", min: 0.5, max: 2, step: 0.05 })}
        initial={1}
        onValue={(n) => seen.push(n)}
      />,
    );

    retype("1.07");
    fireEvent.blur(box());
    expect(box().value).toBe("1.05");
    // And not 1.0500000000000003, which is what the arithmetic gives back.
    expect(seen.at(-1)).toBe(1.05);
  });
});
