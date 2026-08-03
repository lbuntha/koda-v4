/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The zoom lock has to be exactly as wide as the activity and no wider.
 *
 * It started life as a `window` listener, which held the whole app still — including the
 * parent dashboard, admin console and studio, where an adult on a laptop needs ⌘/Ctrl-scroll
 * zoom and where taking it away is a WCAG 1.4.4 failure. These tests pin both halves: the
 * canvas does not zoom, everything outside it still does.
 */

import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, test } from "vitest";

import { useZoomLock } from "./useZoomLock";

const Activity: React.FC<{ enabled?: boolean }> = ({ enabled = true }) => {
  const ref = useZoomLock<HTMLDivElement>(enabled);
  return <div ref={ref} data-testid="activity">canvas</div>;
};

/** Returns whether the surface swallowed the gesture. */
const pinchWheelOn = (target: EventTarget): boolean => {
  const event = new WheelEvent("wheel", { ctrlKey: true, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("holding zoom still inside an activity", () => {
  test("a trackpad pinch over the canvas is suppressed", () => {
    const { getByTestId } = render(<Activity />);
    expect(pinchWheelOn(getByTestId("activity"))).toBe(true);
  });

  test("the rest of the app keeps browser zoom", () => {
    render(<Activity />);
    // A dashboard, a table, anything outside the mounted activity surface.
    const elsewhere = document.createElement("div");
    document.body.appendChild(elsewhere);
    expect(pinchWheelOn(elsewhere)).toBe(false);
  });

  test("an ordinary scroll inside the canvas still passes through", () => {
    const { getByTestId } = render(<Activity />);
    const event = new WheelEvent("wheel", { ctrlKey: false, bubbles: true, cancelable: true });
    getByTestId("activity").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  test("unmounting releases the surface", () => {
    const { getByTestId, unmount } = render(<Activity />);
    const node = getByTestId("activity");
    unmount();
    expect(pinchWheelOn(node)).toBe(false);
  });

  test("disabled does nothing at all", () => {
    const { getByTestId } = render(<Activity enabled={false} />);
    expect(pinchWheelOn(getByTestId("activity"))).toBe(false);
  });
});
