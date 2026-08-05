/**
 * Mounts the real Count On board.
 *
 * The bug this exists for: a released object used to be sent to the *end* of the
 * tray queue. Counting on is ordinal — only the front object may be dragged — so
 * a tap, or a drop on the wrong number, dropped the object on top of a sibling
 * and left a locked one at the front. To a child the apple simply stopped
 * responding, which no geometry test can catch.
 */

import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../../types";
import { CountOnCanvas } from "./CountOnCanvas";

vi.mock("../Assets", () => ({
  CountingAsset: ({ size }: { size: number }) => <span data-testid="asset" style={{ width: size }} />,
}));

vi.mock("../../sound", () => ({
  sounds: {
    playPop: vi.fn(), playWin: vi.fn(), playFailure: vi.fn(), playSparkle: vi.fn(),
    playSuccess: vi.fn(), playLevelUp: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
    playTick: vi.fn(), playSlide: vi.fn(), setEnabled: vi.fn(), isEnabled: () => true,
  },
}));

const STAGE = { width: 900, height: 500 };
let originalRect: typeof Element.prototype.getBoundingClientRect;

beforeEach(() => {
  // jsdom lays nothing out, so the canvas would measure a zero-size stage.
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  originalRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    return { ...STAGE, top: 0, left: 0, right: STAGE.width, bottom: STAGE.height, x: 0, y: 0, toJSON: () => {} } as DOMRect;
  };
  Element.prototype.setPointerCapture = function () {};
  Element.prototype.releasePointerCapture = function () {};
  Element.prototype.hasPointerCapture = function () { return true; };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  vi.clearAllMocks();
});

const question = (base = 8, extra = 4): CountingQuestion => ({
  id: "q-counton",
  technique: CountingTechnique.COUNT_ON,
  title: "Count On",
  instruction: `Count on ${extra} from ${base}`,
  objectId: "apple",
  targetCount: base + extra,
  config: { requireAnswerInput: false, baseCount: base, extraCount: extra },
});

const objects = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="button"]')]
    .filter(node => (node.getAttribute("aria-label") || "").toLowerCase().includes("apple"));

/** Objects are placed with the `translate` property — see `objectMotion.ts`. */
const position = (node: HTMLElement) => node.style.translate;

/** A press and release that never moves — what a child does when they tap. */
const tap = (node: HTMLElement, stage: HTMLElement) => {
  fireEvent.pointerDown(node, { button: 0, clientX: 100, clientY: 400, pointerId: 1 });
  fireEvent.pointerUp(stage, { clientX: 100, clientY: 400, pointerId: 1 });
};

describe("Count On canvas", () => {
  test("a tap leaves every object exactly where it was", () => {
    const { container } = render(
      <CountOnCanvas question={question()} isPlayMode showGrid={false} />
    );
    const stage = container.querySelector<HTMLElement>(".overscroll-none")!;

    const before = objects(container).map(position);
    expect(before).toHaveLength(4);

    tap(objects(container)[0], stage);

    expect(objects(container).map(position)).toEqual(before);
  });

  test("the tray never stacks two objects on the same spot", () => {
    const { container } = render(
      <CountOnCanvas question={question()} isPlayMode showGrid={false} />
    );
    const stage = container.querySelector<HTMLElement>(".overscroll-none")!;

    // Tap the front object repeatedly: it used to be flung to the tail each time,
    // landing on whichever object was already sitting there.
    tap(objects(container)[0], stage);
    tap(objects(container)[0], stage);

    const spots = objects(container).map(position);
    expect(new Set(spots).size).toBe(spots.length);
  });

  test("a drop on the wrong number keeps the object draggable", () => {
    const { container } = render(
      <CountOnCanvas question={question()} isPlayMode showGrid={false} />
    );
    const stage = container.querySelector<HTMLElement>(".overscroll-none")!;
    const before = objects(container).map(position);

    // Drag the front object onto a slot that is not its own, and let go.
    fireEvent.pointerDown(objects(container)[0], { button: 0, clientX: 100, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 700, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 700, clientY: 120, pointerId: 1 });

    const after = objects(container);
    // Nothing was counted on, and the queue is exactly as it was — the rejected
    // object back at the front, still the one the child is allowed to move.
    expect(after.filter(node => (node.getAttribute("aria-label") || "").includes("Counted as"))).toHaveLength(0);
    expect(after.map(position)).toEqual(before);
    expect(after[0].className).toContain("cursor-grab");
  });
});
