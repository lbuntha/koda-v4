/**
 * Mounts the real One-to-One board.
 *
 * `oneToOneLayout.test.tsx` proves the geometry without rendering anything, so it cannot
 * catch the wiring: objects that never get the measured size, a tap that does not count,
 * or a board that reports success before the last object is tapped.
 */

import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../../types";
import { OneToOneCanvas } from "./OneToOneCanvas";

// The artwork pulls in the account's SVG library; this board is about layout and taps.
vi.mock("../Assets", () => ({
  CountingAsset: ({ size }: { size: number }) => <span data-testid="asset" style={{ width: size }} />,
}));

vi.mock("../../sound", () => ({
  sounds: {
    playPop: vi.fn(), playWin: vi.fn(), playFailure: vi.fn(), playSparkle: vi.fn(),
    playSuccess: vi.fn(), playLevelUp: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
    playTick: vi.fn(), setEnabled: vi.fn(), isEnabled: () => true,
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
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  vi.clearAllMocks();
});

const question = (overrides: Partial<CountingQuestion["config"]> = {}, count = 5): CountingQuestion => ({
  id: "q-1to1",
  technique: CountingTechnique.ONE_TO_ONE,
  title: "One-to-One",
  instruction: "Tap each apple once",
  objectId: "apple",
  targetCount: count,
  config: { requireAnswerInput: false, ...overrides },
});

const objects = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].filter(button => button.id.startsWith("item-1to1-"));

describe("One-to-One canvas", () => {
  test("sizes objects from the stage it was given, not from a breakpoint", () => {
    const { container } = render(
      <OneToOneCanvas question={question()} isPlayMode showGrid={false} />
    );

    const rendered = objects(container);
    expect(rendered).toHaveLength(5);

    const size = parseFloat(rendered[0].style.width);
    // The old canvas capped every object at 78px however big the screen was.
    expect(size).toBeGreaterThan(78);
    expect(rendered.every(button => button.style.width === rendered[0].style.width)).toBe(true);
  });

  test("more objects on the same stage means smaller objects", () => {
    const five = render(<OneToOneCanvas question={question()} isPlayMode showGrid={false} />);
    const many = render(<OneToOneCanvas question={question({}, 16)} isPlayMode showGrid={false} />);

    expect(parseFloat(objects(many.container)[0].style.width))
      .toBeLessThan(parseFloat(objects(five.container)[0].style.width));
  });

  test("counts one per tap and reports success on the last one", () => {
    const onSuccess = vi.fn();
    vi.useFakeTimers();
    const { container } = render(
      <OneToOneCanvas question={question()} isPlayMode showGrid={false} onSuccess={onSuccess} />
    );

    const rendered = objects(container);
    rendered.forEach((button, index) => {
      fireEvent.pointerDown(button);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      if (index < rendered.length - 1) expect(onSuccess).not.toHaveBeenCalled();
    });

    vi.runAllTimers();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test("tapping the same object twice does not count it twice", () => {
    const onSuccess = vi.fn();
    vi.useFakeTimers();
    const { container } = render(
      <OneToOneCanvas question={question()} isPlayMode showGrid={false} onSuccess={onSuccess} />
    );

    const first = objects(container)[0];
    fireEvent.pointerDown(first);
    fireEvent.pointerDown(first);
    fireEvent.pointerDown(first);

    vi.runAllTimers();
    expect(onSuccess).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
