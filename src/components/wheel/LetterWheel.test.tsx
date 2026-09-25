import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LetterWheel, type LetterWheelProps } from "./LetterWheel";

/**
 * Drives the ring the way a child does — by dragging, tapping and pressing keys
 * on things found by their accessible names.
 *
 * The test environment asks for reduced motion (see kit/testing/setup.ts), so the
 * ring is drawn straight from state: every tile's `transform` is its resting
 * position, and jsdom's zero-sized layout means client coordinates are read as
 * drawing units. So a drag is simply "press at tile A's centre, move to tile B's
 * centre, lift".
 */

function setup(props: Partial<LetterWheelProps> = {}) {
  const onSubmit = vi.fn<LetterWheelProps["onSubmit"]>(() => "correct");
  const onTraceChange = vi.fn();
  const onStartOver = vi.fn();
  const onShuffle = vi.fn();
  const utils = render(
    <LetterWheel tiles={["C", "A", "T", "Z"]} onSubmit={onSubmit} onTraceChange={onTraceChange} onStartOver={onStartOver} onShuffle={onShuffle} {...props} />,
  );
  const svg = utils.container.querySelector("svg")!;
  return { ...utils, svg, onSubmit, onTraceChange, onStartOver, onShuffle };
}

const tileEls = () => [...document.querySelectorAll<SVGGElement>("[data-wheel-tile]")];
const tileEl = (label: string, nth = 0) => tileEls().filter((g) => g.getAttribute("aria-label")?.split(",")[0] === label)[nth];
const centre = (g: SVGGElement) => {
  const m = g.getAttribute("transform")!.match(/translate\(([\d.-]+) ([\d.-]+)\)/)!;
  return { clientX: Number(m[1]), clientY: Number(m[2]) };
};
const trace = () => document.querySelector("[data-wheel-trace]")!.getAttribute("d") ?? "";
const chip = () => document.querySelector("[data-wheel-chip]")!.textContent ?? "";

function drag(svg: SVGSVGElement, path: SVGGElement[], opts: { lift?: boolean } = {}) {
  const pts = path.map(centre);
  fireEvent.pointerDown(svg, { ...pts[0], pointerId: 1, button: 0, pointerType: "touch" });
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    for (let s = 1; s <= 4; s++) {
      fireEvent.pointerMove(svg, { clientX: a.clientX + ((b.clientX - a.clientX) * s) / 4, clientY: a.clientY + ((b.clientY - a.clientY) * s) / 4, pointerId: 1, pointerType: "touch" });
    }
  }
  if (opts.lift !== false) fireEvent.pointerUp(svg, { ...pts[pts.length - 1], pointerId: 1, pointerType: "touch" });
}
const tap = (svg: SVGSVGElement, g: SVGGElement) => {
  fireEvent.pointerDown(svg, { ...centre(g), pointerId: 2, button: 0, pointerType: "touch" });
  fireEvent.pointerUp(svg, { ...centre(g), pointerId: 2, pointerType: "touch" });
};

describe("what is on screen", () => {
  it("draws one named tile per label, and the shuffle button", () => {
    setup();
    expect(tileEls().map((g) => g.getAttribute("aria-label"))).toEqual(["C", "A", "T", "Z"]);
    expect(screen.getByRole("button", { name: "Shuffle the letters" })).toBeTruthy();
    expect(screen.getByRole("group", { name: /Letter ring\. 4 tiles/ })).toBeTruthy();
  });

  it("shows no Start over or Check until something is chosen", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Start over" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });
});

describe("dragging", () => {
  it("submits the traced word once, on lift, in the order traced", () => {
    const { svg, onSubmit } = setup();
    drag(svg, [tileEl("C"), tileEl("A"), tileEl("T")]);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(["C", "A", "T"], [0, 1, 2]);
  });

  it("shows the verdict it is handed, and clears the trace", () => {
    const { svg } = setup();
    drag(svg, [tileEl("C"), tileEl("A"), tileEl("T")]);
    expect(chip()).toBe("CAT ✓");
    expect(trace()).toBe("");
  });

  it("shows a wrong word as wrong — by mark as well as colour", () => {
    const { svg } = setup({ onSubmit: () => "wrong" });
    drag(svg, [tileEl("T"), tileEl("A"), tileEl("C")]);
    expect(chip()).toBe("TAC ✕");
  });

  it("draws the chosen tiles as straight lines, with one curve to the finger while it is down", () => {
    const { svg } = setup();
    drag(svg, [tileEl("C"), tileEl("A"), tileEl("T")], { lift: false });
    const d = trace();
    expect(d.match(/L/g)).toHaveLength(2);
    expect(d.match(/Q/g)).toHaveLength(1);
    expect(chip()).toBe("CAT");
  });

  it("unwinds the last tile when the finger goes back to the one before", () => {
    const { svg, onSubmit } = setup();
    drag(svg, [tileEl("C"), tileEl("A"), tileEl("T"), tileEl("A")], { lift: false });
    expect(chip()).toBe("CA");
    fireEvent.pointerUp(svg, { ...centre(tileEl("A")), pointerId: 1 });
    expect(onSubmit).toHaveBeenCalledWith(["C", "A"], [0, 1]);
  });

  it("drops a drag shorter than minTiles instead of submitting it", () => {
    const { svg, onSubmit } = setup({ minTiles: 3 });
    drag(svg, [tileEl("C"), tileEl("A")]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(trace()).toBe("");
  });

  it("ignores a press that starts on no tile", () => {
    const { svg, onTraceChange } = setup();
    fireEvent.pointerDown(svg, { clientX: 5, clientY: 470, pointerId: 1, button: 0 });
    fireEvent.pointerUp(svg, { clientX: 5, clientY: 470, pointerId: 1 });
    expect(onTraceChange).not.toHaveBeenCalled();
  });

  it("finishes a drag released outside the ring", () => {
    const { svg, onSubmit } = setup();
    drag(svg, [tileEl("C"), tileEl("A"), tileEl("T")], { lift: false });
    act(() => { window.dispatchEvent(new Event("pointerup")); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("tapping", () => {
  it("builds a word one tile at a time without submitting it", () => {
    const { svg, onSubmit } = setup();
    tap(svg, tileEl("C"));
    tap(svg, tileEl("A"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(chip()).toBe("CA");
    expect(trace().match(/L/g)).toHaveLength(1);
  });

  it("takes the last tile off when it is tapped again", () => {
    const { svg } = setup();
    tap(svg, tileEl("C"));
    tap(svg, tileEl("A"));
    tap(svg, tileEl("A"));
    expect(chip()).toBe("C");
  });

  it("submits with Check", () => {
    const { svg, onSubmit } = setup();
    tap(svg, tileEl("C"));
    tap(svg, tileEl("A"));
    tap(svg, tileEl("T"));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(onSubmit).toHaveBeenCalledWith(["C", "A", "T"], [0, 1, 2]);
  });

  it("submits by itself at autoSubmitAt", () => {
    const { svg, onSubmit } = setup({ autoSubmitAt: 3 });
    tap(svg, tileEl("C"));
    tap(svg, tileEl("A"));
    expect(onSubmit).not.toHaveBeenCalled();
    tap(svg, tileEl("T"));
    expect(onSubmit).toHaveBeenCalledWith(["C", "A", "T"], [0, 1, 2]);
  });

  it("keeps two identical letters apart — SHEEP has two Es and needs both", () => {
    const onSubmit = vi.fn(() => "correct" as const);
    const { container } = render(<LetterWheel tiles={["E", "S", "P", "E", "H"]} onSubmit={onSubmit} />);
    const svg = container.querySelector("svg")!;
    drag(svg, [tileEl("S"), tileEl("H"), tileEl("E", 0), tileEl("E", 1), tileEl("P")]);
    expect(onSubmit).toHaveBeenCalledWith(["S", "H", "E", "E", "P"], [1, 4, 0, 3, 2]);
  });
});

describe("keyboard", () => {
  it("chooses with Enter and Space, takes off with Backspace, clears with Escape", () => {
    const { onStartOver } = setup();
    fireEvent.keyDown(tileEl("C"), { key: "Enter" });
    fireEvent.keyDown(tileEl("A"), { key: " " });
    expect(chip()).toBe("CA");
    expect(tileEl("A").getAttribute("aria-label")).toBe("A, chosen 2nd");
    expect(tileEl("A").getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(tileEl("A"), { key: "Backspace" });
    expect(chip()).toBe("C");
    fireEvent.keyDown(tileEl("C"), { key: "Escape" });
    expect(chip()).toBe("");
    expect(onStartOver).toHaveBeenCalledTimes(1);
  });

  it("moves focus round the ring with the arrow keys, wrapping at the ends", () => {
    setup();
    tileEl("C").focus();
    fireEvent.keyDown(tileEl("C"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tileEl("A"));
    fireEvent.keyDown(tileEl("A"), { key: "ArrowLeft" });
    fireEvent.keyDown(tileEl("C"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tileEl("Z"));
  });

  it("submits by itself at autoSubmitAt, like a tap", () => {
    const { onSubmit } = setup({ autoSubmitAt: 2 });
    fireEvent.keyDown(tileEl("A"), { key: "Enter" });
    fireEvent.keyDown(tileEl("T"), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith(["A", "T"], [1, 2]);
  });
});

describe("start over", () => {
  it("clears the trace and is never an attempt", () => {
    const { svg, onSubmit, onStartOver } = setup();
    tap(svg, tileEl("C"));
    tap(svg, tileEl("A"));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(chip()).toBe("");
    expect(onStartOver).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("shuffle", () => {
  it("moves every tile, keeps the same tiles, clears the trace and says so", () => {
    const { svg, onShuffle } = setup();
    tap(svg, tileEl("C"));
    const before = Object.fromEntries(tileEls().map((g) => [g.getAttribute("aria-label")!.split(",")[0], g.getAttribute("transform")]));
    fireEvent.click(screen.getByRole("button", { name: "Shuffle the letters" }));
    const after = Object.fromEntries(tileEls().map((g) => [g.getAttribute("aria-label")!.split(",")[0], g.getAttribute("transform")]));
    expect(Object.keys(after).sort()).toEqual(["A", "C", "T", "Z"]);
    for (const k of Object.keys(after)) expect(after[k]).not.toBe(before[k]);
    expect(new Set(Object.values(after)).size).toBe(4);
    expect(chip()).toBe("");
    expect(onShuffle).toHaveBeenCalledTimes(1);
  });

  it("does not start a drag when the shuffle button is pressed", () => {
    const { svg, onTraceChange } = setup();
    const hub = screen.getByRole("button", { name: "Shuffle the letters" });
    fireEvent.pointerDown(hub, { clientX: 210, clientY: 210, pointerId: 1, button: 0 });
    fireEvent.pointerUp(svg, { clientX: 210, clientY: 210, pointerId: 1 });
    expect(onTraceChange).not.toHaveBeenCalled();
  });

  it("can still be dragged after a shuffle — hits follow the new places", () => {
    const { svg, onSubmit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Shuffle the letters" }));
    drag(svg, [tileEl("C"), tileEl("A"), tileEl("T")]);
    expect(onSubmit).toHaveBeenCalledWith(["C", "A", "T"], [0, 1, 2]);
  });
});

describe("the caller's controls", () => {
  it("starts afresh when given a new word", () => {
    const onSubmit = vi.fn();
    const { container, rerender } = render(<LetterWheel tiles={["C", "A", "T"]} onSubmit={onSubmit} />);
    tap(container.querySelector("svg")!, tileEl("C"));
    expect(chip()).toBe("C");
    rerender(<LetterWheel tiles={["D", "O", "G"]} onSubmit={onSubmit} />);
    expect(chip()).toBe("");
    expect(tileEls().map((g) => g.getAttribute("aria-label"))).toEqual(["D", "O", "G"]);
  });

  it("ignores every input while disabled", () => {
    const { svg, onSubmit, onTraceChange } = setup({ disabled: true });
    drag(svg, [tileEl("C"), tileEl("A"), tileEl("T")]);
    fireEvent.keyDown(tileEl("C"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Shuffle the letters" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onTraceChange).not.toHaveBeenCalled();
  });

  it("marks a hinted tile, in words as well as a ring", () => {
    setup({ highlight: 1 });
    expect(tileEl("A").getAttribute("aria-label")).toBe("A, suggested");
    expect(tileEl("A").querySelector("[data-wheel-hint]")).not.toBeNull();
    expect(tileEl("C").querySelector("[data-wheel-hint]")).toBeNull();
  });

  it("reports every change to the trace", () => {
    const { svg, onTraceChange } = setup();
    tap(svg, tileEl("C"));
    tap(svg, tileEl("A"));
    expect(onTraceChange).toHaveBeenLastCalledWith(["C", "A"]);
  });
});

describe("Khmer", () => {
  it("spells in clusters and draws them in a Khmer font", () => {
    const onSubmit = vi.fn(() => "correct" as const);
    const tiles = ["ស្វ", "ា", "យ", "ក"];
    const { container } = render(<LetterWheel tiles={tiles} script="khmer" onSubmit={onSubmit} />);
    const svg = container.querySelector("svg")!;
    drag(svg, [tileEl("ស្វ"), tileEl("ា"), tileEl("យ")]);
    expect(onSubmit).toHaveBeenCalledWith(["ស្វ", "ា", "យ"], [0, 1, 2]);
    expect(chip()).toBe("ស្វាយ ✓");
    const text = within(tileEl("ស្វ") as unknown as HTMLElement).getByText("ស្វ");
    expect(text.getAttribute("font-family")).toMatch(/Khmer/);
  });
});
