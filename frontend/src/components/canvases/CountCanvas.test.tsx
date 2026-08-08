/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The merged Count board, driven through both stagings.
 *
 * The point of these is the *contract*, not the two games: the same engine has
 * to produce a drag-between-bins activity and a tap-in-place activity without
 * knowing which it is. Anything asserted here that only holds for one staging is
 * a leak of that staging into the engine.
 */

import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../../types";
import { CountCanvas } from "./CountCanvas";

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

import { sounds } from "../../sound";

const STAGE = { width: 900, height: 500 };
const SRC_LABEL = "Waiting";
const DST_LABEL = "Counted";

let originalRect: typeof Element.prototype.getBoundingClientRect;

const rect = (left: number, width: number): DOMRect =>
  ({
    left, width, top: 0, height: STAGE.height,
    right: left + width, bottom: STAGE.height, x: left, y: 0, toJSON: () => {},
  } as DOMRect);

beforeEach(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  originalRect = Element.prototype.getBoundingClientRect;
  /*
    jsdom lays nothing out, so the zones need real boxes — the whole drop path is
    "is this object's centre inside that rect". A gap is left between them so
    "released over no zone at all" stays a reachable state.
  */
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.classList.contains("overscroll-none")) return rect(0, STAGE.width);
    const text = this.textContent || "";
    if (text.includes(DST_LABEL)) return rect(470, 430);
    if (text.includes(SRC_LABEL)) return rect(0, 430);
    return rect(0, STAGE.width);
  };
  Element.prototype.setPointerCapture = function () {};
  Element.prototype.releasePointerCapture = function () {};
  Element.prototype.hasPointerCapture = function () { return true; };
  // The drag clamps against these, and jsdom reports 0 for both.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true, get: () => STAGE.width,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true, get: () => STAGE.height,
  });
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  delete (HTMLElement.prototype as any).clientWidth;
  delete (HTMLElement.prototype as any).clientHeight;
  vi.clearAllMocks();
});

type Staging = "move" | "tap" | "lineup" | "container";

const question = (
  staging: Staging,
  targetCount = 5,
  extra: Record<string, unknown> = {}
): CountingQuestion => ({
  id: `q-${staging}`,
  technique: CountingTechnique.MOVE_AND_COUNT,
  title: "Count",
  instruction: `Count ${targetCount} apples`,
  objectId: "apple",
  targetCount,
  config: {
    staging,
    requireAnswerInput: false,
    sourceBinLabel: SRC_LABEL,
    destinationBinLabel: DST_LABEL,
    ...extra,
  },
});

const mount = (staging: Staging, targetCount = 5, extra = {}) => {
  const view = render(
    <CountCanvas question={question(staging, targetCount, extra)} isPlayMode showGrid={false} />
  );
  const stage = view.container.querySelector<HTMLElement>(".overscroll-none")!;
  return { ...view, stage };
};

const objects = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="button"]')]
    .filter(node => (node.getAttribute("aria-label") || "").toLowerCase().includes("apple"));

const position = (node: HTMLElement) => node.style.translate;

const coords = (node: HTMLElement) => {
  const [x, y] = position(node).split(" ").map(parseFloat);
  return { x, y };
};

const isCounted = (node: HTMLElement) =>
  (node.getAttribute("aria-label") || "").startsWith("Counted");

const badge = (node: HTMLElement) => {
  const chip = node.querySelector("div.rounded-full");
  return chip ? chip.textContent : null;
};

const IN_TARGET = { x: 600, y: 200 };
const IN_HOME = { x: 120, y: 200 };

const drag = (node: HTMLElement, stage: HTMLElement, to: { x: number; y: number }) => {
  const from = coords(node);
  fireEvent.pointerDown(node, { button: 0, clientX: from.x, clientY: from.y, pointerId: 1 });
  fireEvent.pointerMove(stage, { clientX: to.x, clientY: to.y, pointerId: 1 });
  fireEvent.pointerUp(stage, { clientX: to.x, clientY: to.y, pointerId: 1 });
};

const tap = (node: HTMLElement, stage: HTMLElement) => {
  const from = coords(node);
  fireEvent.pointerDown(node, { button: 0, clientX: from.x, clientY: from.y, pointerId: 1 });
  fireEvent.pointerUp(stage, { clientX: from.x, clientY: from.y, pointerId: 1 });
};

describe("Count engine — move staging", () => {
  test("renders both zones and every object", () => {
    const { container } = mount("move");
    expect(objects(container)).toHaveLength(5);
    expect(container.textContent).toContain(SRC_LABEL);
    expect(container.textContent).toContain(DST_LABEL);
  });

  test("dragging into the target counts the object", () => {
    const { container, stage } = mount("move");
    drag(objects(container)[0], stage, IN_TARGET);

    const counted = objects(container).filter(isCounted);
    expect(counted).toHaveLength(1);
    expect(badge(counted[0])).toBe("1");
    expect(sounds.playTick).toHaveBeenCalledWith(1);
  });

  test("badges renumber 1..n when an object is pulled back out", () => {
    const { container, stage } = mount("move");

    drag(objects(container)[0], stage, IN_TARGET);
    drag(objects(container)[1], stage, IN_TARGET);
    drag(objects(container)[2], stage, IN_TARGET);
    expect(objects(container).filter(isCounted)).toHaveLength(3);

    drag(objects(container).filter(isCounted)[1], stage, IN_HOME);
    expect(objects(container).filter(isCounted).map(badge).sort()).toEqual(["1", "2"]);

    drag(objects(container).filter(n => !isCounted(n))[0], stage, IN_TARGET);
    const badges = objects(container).filter(isCounted).map(badge);
    expect([...badges].sort()).toEqual(["1", "2", "3"]);
    expect(new Set(badges).size).toBe(badges.length);
  });

  test("no two objects share a position", () => {
    const { container, stage } = mount("move");
    drag(objects(container)[0], stage, IN_TARGET);
    drag(objects(container)[1], stage, IN_TARGET);
    drag(objects(container).filter(isCounted)[0], stage, IN_HOME);

    const spots = objects(container).map(position);
    expect(new Set(spots).size).toBe(spots.length);
  });

  test("a release over no zone leaves the board untouched", () => {
    const { container, stage } = mount("move");
    const before = objects(container).map(position);
    const size = parseFloat(objects(container)[0].style.width);

    drag(objects(container)[0], stage, { x: 450 - size / 2, y: 200 });

    expect(objects(container).filter(isCounted)).toHaveLength(0);
    expect(objects(container).map(position)).toEqual(before);
  });
});

describe("Count engine — tap staging", () => {
  test("renders no zones: the objects sit on the open stage", () => {
    const { container } = mount("tap");
    expect(objects(container)).toHaveLength(5);
    expect(container.textContent).not.toContain(SRC_LABEL);
    expect(container.textContent).not.toContain(DST_LABEL);
  });

  test("a tap counts the object without moving it", () => {
    const { container, stage } = mount("tap");
    const before = objects(container).map(position);

    tap(objects(container)[0], stage);

    // Counting in place is the whole skill here — the engine must not re-slot.
    expect(objects(container).map(position)).toEqual(before);
    expect(objects(container).filter(isCounted)).toHaveLength(1);
    expect(sounds.playTick).toHaveBeenCalledWith(1);
  });

  test("tapping the same object twice counts it once", () => {
    const { container, stage } = mount("tap");

    tap(objects(container)[0], stage);
    tap(objects(container)[0], stage);

    expect(objects(container).filter(isCounted)).toHaveLength(1);
  });

  test("tapping every object completes the activity", () => {
    const onSuccess = vi.fn();
    const { container } = render(
      <CountCanvas question={question("tap", 3)} isPlayMode showGrid={false} onSuccess={onSuccess} />
    );
    const stage = container.querySelector<HTMLElement>(".overscroll-none")!;

    for (let i = 0; i < 3; i++) tap(objects(container)[i], stage);

    expect(objects(container).filter(isCounted)).toHaveLength(3);
    expect(objects(container).filter(isCounted).map(badge)).toEqual(["1", "2", "3"]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("a drag does not count, because only a tap counts here", () => {
    const { container, stage } = mount("tap");
    drag(objects(container)[0], stage, IN_TARGET);
    expect(objects(container).filter(isCounted)).toHaveLength(0);
  });
});

describe("Count engine — lineup staging", () => {
  test("a slot is the number: dropping into slot 3 badges it 3", () => {
    const { container, stage } = mount("lineup");
    // Slot markers are laid out across the line zone; aim at the third.
    const marker = [...stage.querySelectorAll<HTMLElement>("div.border-dashed")].find(
      node => node.textContent === "3"
    )!;
    const size = parseFloat(objects(container)[0].style.width);
    const target = {
      x: parseFloat(marker.style.left) + size / 2,
      y: parseFloat(marker.style.top) + size / 2,
    };

    drag(objects(container)[0], stage, { x: target.x - size / 2, y: target.y - size / 2 });

    const placed = objects(container).filter(isCounted);
    expect(placed).toHaveLength(1);
    // Arrival order would have called this 1 — the child chose 3.
    expect(badge(placed[0])).toBe("3");
  });

  test("a taken slot refuses a second object", () => {
    const { container, stage } = mount("lineup");
    const marker = [...stage.querySelectorAll<HTMLElement>("div.border-dashed")].find(
      node => node.textContent === "2"
    )!;
    const to = { x: parseFloat(marker.style.left), y: parseFloat(marker.style.top) };

    drag(objects(container)[0], stage, to);
    expect(objects(container).filter(isCounted)).toHaveLength(1);

    drag(objects(container)[1], stage, to);
    // Still one: the second object was sent back rather than stacked.
    expect(objects(container).filter(isCounted)).toHaveLength(1);
  });
});

describe("Count engine — container staging", () => {
  test("objects shrink as they go into the vessel", () => {
    const { container, stage } = mount("container");
    const before = parseFloat(objects(container)[0].style.width);

    drag(objects(container)[0], stage, IN_TARGET);

    const collected = objects(container).filter(isCounted)[0];
    expect(collected).toBeTruthy();
    // The shelf keeps the shared counting size; the jar's mouth is smaller.
    expect(parseFloat(collected.style.width)).toBeLessThan(before);
    expect(parseFloat(objects(container).filter(n => !isCounted(n))[0].style.width)).toBe(before);
  });

  test("the vessel is drawn inside the target zone", () => {
    const { stage } = mount("container");
    expect(stage.querySelector("svg")).toBeTruthy();
  });
});

describe("Count engine — shared behaviour", () => {
  test.each(["move", "tap", "lineup", "container"] as const)(
    "%s: no two objects share a position",
    staging => {
      const { container, stage } = mount(staging);
      drag(objects(container)[0], stage, IN_TARGET);
      tap(objects(container)[1], stage);

      const spots = objects(container).map(position);
      expect(new Set(spots).size).toBe(spots.length);
    }
  );

  test.each(["move", "tap"] as const)("%s: the keyboard can count an object", staging => {
    const { container } = mount(staging);
    fireEvent.keyDown(objects(container)[0], { key: "Enter" });
    expect(objects(container).filter(isCounted)).toHaveLength(1);
  });

  test.each(["move", "tap"] as const)("%s: a new question clears progress", staging => {
    const view = render(
      <CountCanvas question={question(staging, 4)} isPlayMode showGrid={false} />
    );
    const stage = view.container.querySelector<HTMLElement>(".overscroll-none")!;
    tap(objects(view.container)[0], stage);
    fireEvent.keyDown(objects(view.container)[1], { key: "Enter" });
    expect(objects(view.container).filter(isCounted).length).toBeGreaterThan(0);

    view.rerender(
      <CountCanvas
        question={{ ...question(staging, 4), id: "q-next" }}
        isPlayMode
        showGrid={false}
      />
    );
    expect(objects(view.container).filter(isCounted)).toHaveLength(0);
  });
});
