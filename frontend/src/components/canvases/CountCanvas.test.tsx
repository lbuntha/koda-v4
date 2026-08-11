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

import { act, fireEvent, render, screen } from "@testing-library/react";
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

const rect = (left: number, width: number, top = 0, height = STAGE.height): DOMRect =>
  ({
    left, width, top, height,
    right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {},
  } as DOMRect);

/**
 * How the mounted staging flows its zones.
 *
 * `orientation: "column"` stagings — Line Up, Group in Tens, Count On — get one
 * full-width band above another, which is what the flex container actually does
 * for them. Faking them side by side made the box 430px wide while the objects
 * were sized against the whole 900px stage, so a row of eight overflowed its own
 * zone and every drop clamped onto the same slot. The harness has to lay the
 * board out the way the browser will, or the drop tests are fiction.
 */
const COLUMN_STAGINGS = new Set(["lineup", "tens", "counton", "countback", "arrangements"]);
let flow: "row" | "column" = "row";

/**
 * A silent speech synthesiser.
 *
 * Koda arrives on the voice, and jsdom has no voice — the read-aloud button even
 * hides itself when speech is unsupported. Without this the guide is
 * unreachable, which is how four lines wiring Koda into this canvas ended up
 * with only a negative assertion covering them.
 */
let utterances: any[] = [];

const installSpeech = () => {
  utterances = [];
  class FakeUtterance {
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    voice: unknown = null;
    rate = 1; pitch = 1; volume = 1; lang = "en-US";
    constructor(public text: string) {}
  }
  (globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
  (globalThis as any).speechSynthesis = {
    cancel: () => {},
    getVoices: () => [],
    speak: (utterance: any) => utterances.push(utterance),
  };
};

/** Press Listen, and let the synthesiser report that it started. */
const listen = () => {
  fireEvent.click(screen.getByTitle(/Listen to question/i));
  act(() => { utterances.at(-1)?.onstart?.(); });
};

const finishSpeaking = () => {
  act(() => { utterances.at(-1)?.onend?.(); });
};

/** Koda's current role, read off the mascot. `null` when nobody is there. */
const kodaState = (container: HTMLElement) =>
  container.querySelector("[data-koda-state]")?.getAttribute("data-koda-state") ?? null;

beforeEach(() => {
  installSpeech();
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
    /*
      The canvas root, which measures itself to decide whether the header has
      room for a row. Without this it fell through to the text checks below —
      its `textContent` contains both bin labels — and reported 430px, so every
      board in this file ran the phone header on a 900px stage.

      Found by `data-canvas-root`, not by a class. This used to match on
      `min-h-[350px]`, which tied the stage width this file reports to a styling
      decision: the moment that floor became one of two the layout picks
      between, the selector missed and every board here silently went narrow.
    */
    if (this.hasAttribute("data-canvas-root")) return rect(0, STAGE.width);
    const text = this.textContent || "";
    if (flow === "column") {
      if (text.includes(DST_LABEL)) return rect(0, STAGE.width, 260, 240);
      if (text.includes(SRC_LABEL)) return rect(0, STAGE.width, 0, 240);
      return rect(0, STAGE.width);
    }
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
  flow = "row";
  Element.prototype.getBoundingClientRect = originalRect;
  delete (HTMLElement.prototype as any).clientWidth;
  delete (HTMLElement.prototype as any).clientHeight;
  vi.clearAllMocks();
});

type Staging =
  | "move" | "tap" | "lineup" | "container" | "tens" | "counton" | "countback" | "arrangements" | "skipcount";

const question = (
  staging: Staging,
  targetCount = 5,
  extra: Record<string, unknown> = {},
  /** Apples unless the artwork is part of what is being tested — see the base-ten rods. */
  objectId = "apple"
): CountingQuestion => ({
  id: `q-${staging}`,
  technique: CountingTechnique.MOVE_AND_COUNT,
  title: "Count",
  instruction: `Count ${targetCount} apples`,
  objectId,
  targetCount,
  config: {
    staging,
    requireAnswerInput: false,
    sourceBinLabel: SRC_LABEL,
    destinationBinLabel: DST_LABEL,
    ...extra,
  },
});

const mount = (staging: Staging, targetCount = 5, extra = {}, objectId = "apple") => {
  flow = COLUMN_STAGINGS.has(staging) ? "column" : "row";
  const view = render(
    <CountCanvas question={question(staging, targetCount, extra, objectId)} isPlayMode showGrid={false} />
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

/**
 * Acted on, whatever this staging calls it.
 *
 * `isCounted` keys off the word "Counted", which is precisely the wording Count
 * Back replaces — so it reads a crossed-out object as untouched. Anything
 * checking progress across stagings has to ask the neutral question.
 */
const isActed = (node: HTMLElement) => {
  const label = node.getAttribute("aria-label") || "";
  return label.startsWith("Counted") || label.startsWith("Crossed out");
};

/** The object the engine is pointing at — `ring-offset-2` is only the emphasis. */
const isRinged = (node: HTMLElement) => node.className.includes("ring-offset-2");

const badge = (node: HTMLElement) => {
  const chip = node.querySelector("div.rounded-full");
  return chip ? chip.textContent : null;
};

/**
 * The dashed places a child aims at, in render order, with their centres.
 *
 * Read from the DOM rather than recomputed: a test that does its own geometry
 * can agree with itself while disagreeing with what was drawn, which is the one
 * class of bug in a drop test that matters.
 */
const slotCentres = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('div[style*="z-index: 4"]')].map(node => {
    const size = parseFloat(node.style.width) || 0;
    return {
      label: node.textContent || "",
      /** The one place a child may fill next — solid, where the rest are dashed. */
      next: node.className.includes("border-solid"),
      x: (parseFloat(node.style.left) || 0) + size / 2,
      y: (parseFloat(node.style.top) || 0) + size / 2,
    };
  });

const IN_TARGET = { x: 600, y: 200 };
const IN_HOME = { x: 120, y: 200 };
/** Same two places on a column board, where the bands are stacked. */
const IN_TARGET_BELOW = { x: 450, y: 380 };
const IN_HOME_ABOVE = { x: 450, y: 120 };

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

/**
 * The two stagings folded in last, and the engine capabilities they needed.
 *
 * Both are checked through the same engine as the other four — if a capability
 * added for one of these had leaked into the engine as a special case, the
 * shared tests above would be the ones to break.
 */
describe("Group in Tens", () => {
  test("the cells are numbered across the frames", () => {
    const { container } = mount("tens", 12);
    const cells = slotCentres(container);
    expect(cells).toHaveLength(12);
    // Two ten-frames: eleven and twelve start the second one.
    expect(cells.map(cell => cell.label)).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1))
    );
  });

  /*
    Grouping into tens is counting, not sorting. A frame filled 1, 4, 9, 2 holds
    four ones and shows nothing — a ten-frame teaches because a partly filled one
    can be read at a glance, and that only holds if it fills in order.
  */
  test("only the next cell accepts, so the frame fills in order", () => {
    const { container, stage } = mount("tens", 10);
    const cells = slotCentres(container);

    // Seventh first would leave a frame with holes in it.
    drag(objects(container)[0], stage, { x: cells[6].x, y: cells[6].y });
    expect(objects(container).filter(isCounted)).toHaveLength(0);

    drag(objects(container)[0], stage, { x: cells[0].x, y: cells[0].y });
    const counted = objects(container).filter(isCounted);
    expect(counted).toHaveLength(1);
    expect(badge(counted[0])).toBe("1");
  });

  test("the next cell is pointed at, and moves along as the frame fills", () => {
    const { container, stage } = mount("tens", 10);
    const marked = () => slotCentres(container).filter(cell => cell.next).map(cell => cell.label);

    expect(marked()).toEqual(["1"]);

    const first = slotCentres(container)[0];
    drag(objects(container)[0], stage, { x: first.x, y: first.y });
    expect(marked()).toEqual(["2"]);
  });

  test("frames are drawn one per ten, and the last one is as short as it needs to be", () => {
    const { container } = mount("tens", 24);
    expect(container.querySelectorAll('div[aria-hidden="true"].rounded-2xl')).toHaveLength(3);
  });

  /**
   * A finished frame is read as tens and ones, not as a total.
   *
   * "All 13 counted" is true and teaches nothing: it describes the pile the
   * child started with rather than the ten they just built. The whole reason
   * this staging exists is the sentence at the end of it.
   */
  test("finishing reports the frames, not the pile", () => {
    const { container, stage } = mount("tens", 13);
    const cells = slotCentres(container);
    for (let i = 0; i < 13; i += 1) {
      const next = objects(container).find(node => !isCounted(node))!;
      drag(next, stage, { x: cells[i].x, y: cells[i].y });
    }

    expect(container.textContent).toContain("1 ten and 3 ones");
    expect(container.textContent).not.toContain("All 13 counted");
  });

  test("two full tens are not reported as ones as well", () => {
    // "2 tens and 0 ones" is a sentence nobody says.
    const { container, stage } = mount("tens", 20);
    const cells = slotCentres(container);
    for (let i = 0; i < 20; i += 1) {
      const next = objects(container).find(node => !isCounted(node))!;
      drag(next, stage, { x: cells[i].x, y: cells[i].y });
    }

    expect(container.textContent).toContain("2 tens");
    expect(container.textContent).not.toContain("0 ones");
  });

  test("the idle prompt does not hand over the answer", () => {
    // It used to read "Enter how many you grouped (13)!" — directly above the box asking for it.
    const { container, stage } = mount("tens", 13, { requireAnswerInput: true });
    const cells = slotCentres(container);
    for (let i = 0; i < 13; i += 1) {
      const next = objects(container).find(node => !isCounted(node))!;
      drag(next, stage, { x: cells[i].x, y: cells[i].y });
    }

    expect(container.textContent).not.toContain("(13)");
  });
});

describe("Count On", () => {
  const countOn = (base: number, extra: number) =>
    mount("counton", 0, { baseCount: base, extraCount: extra });

  test("the board is base plus extra, and the base group starts counted", () => {
    const { container } = countOn(5, 3);

    expect(objects(container)).toHaveLength(8);
    const counted = objects(container).filter(isCounted);
    expect(counted).toHaveLength(5);
    expect(counted.map(badge)).toEqual(["1", "2", "3", "4", "5"]);
  });

  test("only the places still to fill are marked, and they start after the group", () => {
    const { container } = countOn(5, 3);
    expect(slotCentres(container).map(slot => slot.label)).toEqual(["6", "7", "8"]);
  });

  test("counting on is ordinal — only the next number accepts", () => {
    const { container, stage } = countOn(5, 3);
    const [six, , eight] = slotCentres(container);
    const waiting = objects(container).filter(node => !isCounted(node));

    // Eight before six is the opposite of counting on, and is refused.
    drag(waiting[0], stage, { x: eight.x, y: eight.y });
    expect(objects(container).filter(isCounted)).toHaveLength(5);

    drag(waiting[0], stage, { x: six.x, y: six.y });
    const counted = objects(container).filter(isCounted);
    expect(counted).toHaveLength(6);
    expect(badge(counted[5])).toBe("6");
  });

  test("the group we started with cannot be taken back out", () => {
    const { container, stage } = countOn(5, 3);
    const first = objects(container).filter(isCounted)[0];

    drag(first, stage, IN_HOME_ABOVE);

    // Pulling the 5 out of "5 and 3 more" would leave a different question.
    expect(objects(container).filter(isCounted)).toHaveLength(5);
  });

  test("a new question rebuilds the starting group, not an empty board", () => {
    const base = { baseCount: 5, extraCount: 3 };
    flow = "column";
    const view = render(
      <CountCanvas question={question("counton", 0, base)} isPlayMode showGrid={false} />
    );
    const stage = view.container.querySelector<HTMLElement>(".overscroll-none")!;
    const six = slotCentres(view.container)[0];
    drag(objects(view.container).filter(node => !isCounted(node))[0], stage, { x: six.x, y: six.y });
    expect(objects(view.container).filter(isCounted)).toHaveLength(6);

    view.rerender(
      <CountCanvas
        question={{ ...question("counton", 0, base), id: "q-next" }}
        isPlayMode
        showGrid={false}
      />
    );

    /*
      Not zero, which is what "clear progress" means for every other staging.
      Resetting past the seeded group would hand the child a different question
      from the one they were asked.
    */
    expect(objects(view.container).filter(isCounted)).toHaveLength(5);
  });
});

/**
 * Count Back, the staging that separated three numbers the engine used to treat
 * as one: how many objects there are, how many acts finish it, and what the
 * answer is. Every assertion here is about one of those three being distinct.
 */
describe("Count Back", () => {
  const countBack = (total: number, remove: number) =>
    mount("countback", 0, { totalCount: total, removeCount: remove, requireAnswerInput: true });

  test("the board is the whole set, but only the goal finishes it", () => {
    const { container, stage } = countBack(8, 3);
    expect(objects(container)).toHaveLength(8);

    // Three crossings, not eight, and the set never empties.
    for (let step = 0; step < 3; step += 1) {
      const next = objects(container).filter(node => !isActed(node)).at(-1)!;
      tap(next, stage);
    }
    expect(objects(container).filter(isActed)).toHaveLength(3);
    expect(objects(container)).toHaveLength(8);
    expect(container.textContent).toContain("Enter the total answer below");
  });

  test("counting back is ordinal — the last one goes first", () => {
    const { container, stage } = countBack(6, 2);
    const all = objects(container);

    // The first object is where counting *started*; it is the last to come off.
    tap(all[0], stage);
    expect(objects(container).filter(isActed)).toHaveLength(0);

    tap(all[5], stage);
    expect(objects(container).filter(isActed)).toHaveLength(1);
  });

  test("the object to cross next is pointed at, so a refusal is a visible rule", () => {
    const { container, stage } = countBack(6, 2);
    const ringed = (nodes: HTMLElement[]) => nodes.filter(isRinged);

    expect(ringed(objects(container))).toHaveLength(1);
    expect(ringed(objects(container))[0]).toBe(objects(container)[5]);

    tap(objects(container)[5], stage);
    expect(ringed(objects(container))[0]).toBe(objects(container)[4]);
  });

  test("a crossed object is struck through, not badged with a number", () => {
    const { container, stage } = countBack(6, 2);
    tap(objects(container)[5], stage);

    const gone = objects(container).filter(isActed)[0];
    // It is not the sixth of anything any more.
    expect(badge(gone)).toBeFalsy();

    /*
      The artwork dims; the mark that crosses it out does not. These were the
      same element once, so the clearest signal on the board — "this one is
      gone" — was drawn at 40% along with the thing it was crossing out.
    */
    const dimmed = gone.querySelector<HTMLElement>(".opacity-40");
    const strike = gone.querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(dimmed).toBeTruthy();
    expect(strike).toBeTruthy();
    expect(dimmed!.contains(strike!)).toBe(false);
  });

  test("the countdown reports the numbers being said out loud", () => {
    const { container, stage } = countBack(8, 3);
    const countdown = () =>
      [...container.querySelectorAll<HTMLElement>("div.inset-0.flex-wrap span")]
        .map(node => node.textContent)
        .filter(text => text && text !== "→");

    expect(countdown()).toEqual(["8"]);

    tap(objects(container).filter(node => !isActed(node)).at(-1)!, stage);
    expect(countdown()).toEqual(["8", "7"]);

    tap(objects(container).filter(node => !isActed(node)).at(-1)!, stage);
    expect(countdown()).toEqual(["8", "7", "6"]);
  });

  test("the answer is what is left, which was never marked on the board", () => {
    const { container, stage } = countBack(8, 3);
    for (let step = 0; step < 3; step += 1) {
      tap(objects(container).filter(node => !isActed(node)).at(-1)!, stage);
    }

    // Not 8 (the objects) and not 3 (the acts).
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Your answer"]')!;
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click([...container.querySelectorAll("button")].find(b => b.textContent === "Check")!);
    expect(input.disabled).toBe(true);
  });

  test("progress is spoken in this staging's words, not counting's", () => {
    const { container } = countBack(8, 3);
    expect(container.textContent).toContain("3 to cross out");
    expect(container.textContent).not.toContain("to count");
  });
});

describe("Different Arrangements", () => {
  test("the arena is named for the arrangement, so what varies is what is labelled", () => {
    const { container } = mount("arrangements", 6, { pattern: "ring", sourceBinLabel: "" });
    expect(container.textContent).toContain("Ring Arrangement");
  });

  test("counting is a tap in place — nothing moves", () => {
    const { container, stage } = mount("arrangements", 5, { pattern: "line" });
    const before = objects(container).map(position);

    tap(objects(container)[2], stage);

    expect(objects(container).filter(isCounted)).toHaveLength(1);
    expect(objects(container).map(position)).toEqual(before);
  });

  test("the number track fills as the count goes on", () => {
    const { container, stage } = mount("arrangements", 4, { pattern: "grid" });
    const filled = () =>
      [...container.querySelectorAll<HTMLElement>("div.inset-0.flex-wrap > div")]
        .filter(node => !node.className.includes("border-dashed")).length;

    expect(filled()).toBe(0);
    tap(objects(container)[0], stage);
    expect(filled()).toBe(1);
    tap(objects(container)[1], stage);
    expect(filled()).toBe(2);
  });

  test("the arrangement changes but the count does not", () => {
    const ring = mount("arrangements", 7, { pattern: "ring" });
    const ringSpots = objects(ring.container).map(position);
    ring.unmount();

    const line = mount("arrangements", 7, { pattern: "line" });
    const lineSpots = objects(line.container).map(position);

    expect(ringSpots).not.toEqual(lineSpots);
    expect(ringSpots).toHaveLength(7);
    expect(lineSpots).toHaveLength(7);
  });
});

/**
 * Authored layouts, which the engine wrote and nobody read between the
 * nine-into-one merge and now.
 */
describe("teacher-authored positions", () => {
  const authored = (extra: Record<string, unknown> = {}) => ({
    customPositions: [
      { id: "count-item-0", x: 100, y: 40 },
      { id: "count-item-1", x: 300, y: 40 },
    ],
    layoutReference: { width: STAGE.width, height: STAGE.height },
    ...extra,
  });

  test("a saved position wins over the staging's arrangement", () => {
    const { container } = mount("arrangements", 3, { pattern: "grid", ...authored() });
    const [first, second] = objects(container).map(coords);

    expect(first).toEqual({ x: 100, y: 40 });
    expect(second).toEqual({ x: 300, y: 40 });
  });

  test("objects with no saved position keep the staging's own", () => {
    const plain = mount("arrangements", 3, { pattern: "grid" });
    const third = objects(plain.container).map(coords)[2];
    plain.unmount();

    const { container } = mount("arrangements", 3, { pattern: "grid", ...authored() });
    expect(objects(container).map(coords)[2]).toEqual(third);
  });

  test("saved coordinates are scaled from the stage they were authored on", () => {
    // Authored on a stage half this wide: everything should land twice as far across.
    const { container } = mount("arrangements", 3, {
      pattern: "grid",
      ...authored({ layoutReference: { width: STAGE.width / 2, height: STAGE.height } }),
    });
    expect(objects(container).map(coords)[0].x).toBe(200);
  });

  test("a stray saved position from a bigger count is ignored", () => {
    const { container } = mount("arrangements", 1, {
      pattern: "grid",
      ...authored(),
    });
    // Only one object on this board, and it is the one that had a position.
    expect(objects(container)).toHaveLength(1);
    expect(objects(container).map(coords)[0]).toEqual({ x: 100, y: 40 });
  });
});

/**
 * Motion, checked the only way jsdom can: which class the engine puts on.
 *
 * The look of a spring is not testable here — but *which* feedback an object
 * gets is, and that is the part that was wrong: a refused drop and an accepted
 * one used to be the same movement.
 */
describe("landing and refusal read differently", () => {
  test("an accepted drop lands", () => {
    const { container, stage } = mount("move");
    drag(objects(container)[0], stage, IN_TARGET);

    const landed = objects(container).filter(node => node.className.includes("animate-drop-pop"));
    expect(landed).toHaveLength(1);
    expect(isCounted(landed[0])).toBe(true);
  });

  test("a refused drop shakes instead of landing", () => {
    const { container, stage } = mount("lineup", 5);
    const slots = slotCentres(container);
    const waiting = objects(container);

    drag(waiting[0], stage, { x: slots[2].x, y: slots[2].y });
    // Second object, same slot: the staging refuses it.
    drag(waiting[1], stage, { x: slots[2].x, y: slots[2].y });

    const shaken = objects(container).filter(node => node.className.includes("animate-shake"));
    expect(shaken).toHaveLength(1);
    expect(isCounted(shaken[0])).toBe(false);
    // And it is not also being told it landed.
    expect(shaken[0].className).not.toContain("animate-drop-pop");
  });

  test("a tap that counts nothing is not reported as a refusal", () => {
    const { container, stage } = mount("tap");
    tap(objects(container)[0], stage);
    tap(objects(container)[0], stage);

    // Tapping a counted object is a no-op the child expects, not a rejection.
    expect(objects(container).filter(node => node.className.includes("animate-shake"))).toHaveLength(0);
  });
});

/**
 * Counting a board whose *artwork* is a group.
 *
 * A base-ten rod is the first asset worth more than one, and the failure it
 * invites is silent: the board draws the right number of things while the answer
 * panel expects a different total, or the bundle rule multiplies a rod by ten
 * and puts a hundred on the screen. Both are invisible in code and immediate to
 * a child, so both are pinned here.
 */
describe("skip counting base-ten rods", () => {
  /*
    Selected by being a placed object rather than by name, unlike `objects`.
    Skip Count's label for a counted bundle is "Counted a group of 10" — it names
    the group, not the artwork — so a rod stops matching its own name the moment
    it is counted, which is exactly when these tests want to look at it.
  */
  const rods = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>('[role="button"][style*="translate"]')];

  const rodBoard = (total: number, extra: Record<string, unknown> = {}) =>
    mount("skipcount", total, { assetType: "tenrod", skipStep: 10, totalCount: total, ...extra }, "tenrod");

  test("forty is four rods, not forty objects", () => {
    const { container } = rodBoard(40);
    expect(rods(container)).toHaveLength(4);
  });

  test("each rod is drawn once — the ten is on the rod, not ten rods in a pile", () => {
    // The bundle rule draws `skipStep` copies of the artwork. Applied to a rod
    // that would be ten rods, a hundred, which is the wrong board entirely.
    const { container } = rodBoard(40);
    expect(container.querySelectorAll('[data-testid="asset"]')).toHaveLength(4);
  });

  test("the numbers said out loud are the tens", () => {
    const { container, stage } = rodBoard(40);
    tap(rods(container)[0], stage);
    tap(rods(container)[1], stage);
    expect(rods(container).map(badge).filter(Boolean)).toEqual(["10", "20"]);
  });

  test("the answer is the blocks, and the rod outranks a stale skipStep", () => {
    // Authored as fives and switched to rods: the picture is worth ten, so six
    // rods is sixty however the field was left.
    const { container, stage } = rodBoard(60, { skipStep: 5, requireAnswerInput: true });
    const board = rods(container);
    expect(board).toHaveLength(6);
    for (const rod of board) tap(rod, stage);
    expect(container.textContent).toContain("60");
  });

  test("the board talks about tens, not about bundles of ten", () => {
    /*
      Nobody bundled a rod, and "four groups of ten makes forty" is not the
      sentence a child is being taught to say here. The words are the lesson as
      much as the artwork is, so they are pinned.
    */
    const { container, stage } = rodBoard(40);
    expect(container.textContent).toContain("Tens");
    expect(container.textContent).not.toContain("Bundles of");

    for (const rod of rods(container)) tap(rod, stage);
    expect(container.textContent).toContain("4 tens make 40");
  });
});

/**
 * What the board leads with.
 *
 * The instruction used to be a grey hint at the bottom that faded after three
 * seconds, while the largest words on the canvas were a tally — "0 of 5
 * counted" — of work the child had not started. A child who missed the fade had
 * no way back to what was being asked.
 */
describe("the question leads", () => {
  test("the heading is the question, not the tally", () => {
    const { container } = mount("move", 5);
    expect(container.querySelector("h2")!.textContent).toBe("Count 5 apples");
  });

  test("the question stays put while the count changes under it", () => {
    const { container, stage } = mount("move", 5);
    drag(objects(container)[0], stage, IN_TARGET);
    drag(objects(container)[1], stage, IN_TARGET);
    expect(container.querySelector("h2")!.textContent).toBe("Count 5 apples");
  });

  test("finishing replaces it with what to do next, once", () => {
    const { container, stage } = mount("move", 2, { requireAnswerInput: true });
    for (const object of objects(container)) drag(object, stage, IN_TARGET);
    expect(container.querySelector("h2")!.textContent).toContain("Enter the total answer");
  });

  test("Koda is not parked beside the board", () => {
    // The guide belongs to the voice. Nothing here has pressed Listen, so
    // nothing should be standing next to the question taking width from it.
    const { container } = mount("move", 5);
    expect(kodaState(container)).toBeNull();
  });
});

/**
 * Koda, attached to *this* canvas.
 *
 * `SharedCanvasLayout` owns the character; what belongs here is the wiring —
 * that Count asks for the right actor for the moment the board is in. That
 * mapping is four lines and every one of them is a silent failure: a board that
 * shrugs at a wrong answer, or grins through one, is worse than a board with no
 * guide at all.
 */
describe("Koda follows what the board is doing", () => {
  /** Count everything, then answer — the only route to the wrong/right moments. */
  const finishBoard = (container: HTMLElement, stage: HTMLElement) => {
    for (const object of objects(container)) drag(object, stage, IN_TARGET);
  };

  const answerWith = (value: string) => {
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
  };

  test("the voice brings Koda in talking, and leaves them waiting", () => {
    const { container } = mount("move", 3);

    listen();
    expect(kodaState(container)).toBe("talking");

    finishSpeaking();
    // Still there — a guide who leaves on the last syllable is never around for
    // the answer, which is most of what a guide is for.
    expect(kodaState(container)).toBe("waiting");
  });

  test("a wrong answer is met with the oops actor", () => {
    const { container, stage } = mount("move", 3, { requireAnswerInput: true });
    listen();
    finishSpeaking();
    finishBoard(container, stage);

    answerWith("9");
    expect(kodaState(container)).toBe("oops");
  });

  test("the right answer is met with the celebrating actor", () => {
    const { container, stage } = mount("move", 3, { requireAnswerInput: true });
    listen();
    finishSpeaking();
    finishBoard(container, stage);

    answerWith("3");
    expect(kodaState(container)).toBe("excited");
  });

  test("correcting a wrong answer takes the wince back", () => {
    // `error` is read before `solved`, so a stale rejection cannot outlive the
    // answer that cleared it.
    const { container, stage } = mount("move", 3, { requireAnswerInput: true });
    listen();
    finishSpeaking();
    finishBoard(container, stage);

    answerWith("9");
    expect(kodaState(container)).toBe("oops");

    answerWith("3");
    expect(kodaState(container)).toBe("excited");
  });
});
