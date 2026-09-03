import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { buildQuestion, figureFor } from "./activities/FrameFill";
import * as column from "./activities/ColumnPad";
import * as chart from "./activities/PlaceValueDesk";
import * as numberline from "./activities/JumpLine";
import * as bonds from "./activities/BondTree";
import * as base10 from "./activities/BlockYard";

/**
 * The technique's apparatus, drawn for paper.
 *
 * A printed frame has to say two things a sentence cannot: how big the frame is,
 * and how much of it is already used. Both are things a child reads off the
 * picture rather than counting, which is the entire point of teaching with a
 * frame — so both are asserted here.
 */

afterEach(cleanup);

const frame = (mode: string, index = 0) =>
  buildQuestion({ mode } as never, index, new Set<string>());

const drawn = (node: React.ReactNode) => {
  const { container } = render(<>{node}</>);
  return {
    cells: container.querySelectorAll("rect").length,
    counters: container.querySelectorAll("circle").length,
    label: container.querySelector("svg")?.getAttribute("aria-label") ?? "",
  };
};

describe("a frame on paper", () => {
  it("draws ten cells for a ten-frame and five for a five-frame", () => {
    expect(drawn(figureFor(frame("ten"))).cells).toBe(10);
    expect(drawn(figureFor(frame("five"))).cells).toBe(5);
  });

  it("fills only the counters already in the frame, leaving the rest to the child", () => {
    /* The empty cells are the question. A frame printed full, or printed empty
       when the lesson says six are already there, asks something else. */
    for (const mode of ["five", "ten", "make_ten"]) {
      for (let i = 0; i < 8; i += 1) {
        const q = frame(mode, i);
        const { cells, counters } = drawn(figureFor(q));
        expect(counters, `${mode}: ${q.given} given`).toBe(q.given);
        expect(counters).toBeLessThanOrEqual(cells);
      }
    }
  });

  it("says what it is, for a reader who cannot see it", () => {
    const q = frame("ten");
    expect(drawn(figureFor(q)).label).toBe(`10 frame with ${q.given} counters`);
  });
});

describe("the other techniques' apparatus", () => {
  const build = (mod: { buildQuestion: (p: never, i: number, s: Set<string>) => unknown }, mode: string) =>
    mod.buildQuestion({ mode } as never, 0, new Set<string>());

  it("sets the column sum out, with the carry boxes and the answer row empty", () => {
    const q = build(column, "standard") as { a: number; b: number };
    const { container } = render(<>{column.figureFor(q as never)}</>);
    const text = container.textContent ?? "";

    // Both addends are placed, and the total is not.
    expect(text).toContain(String(q.a).slice(-1));
    expect(text).toContain("+");
    expect(container.querySelectorAll(".border-dashed").length).toBeGreaterThan(0);
  });

  it("heads the place-value chart with only the columns the numbers use", () => {
    const q = build(chart, "chart_add") as { a: number; b: number; sum: number };
    const { container } = render(<>{chart.figureFor(q as never)}</>);
    const heads = container.querySelectorAll("tr")[0].textContent ?? "";
    const width = Math.max(String(q.a).length, String(q.b).length, String(q.sum).length);

    expect(heads.length).toBe(width);
    expect("HTO").toContain(heads);
  });

  it("leaves room for the numbers under the first and last ticks", () => {
    /* The ticks sit on the ends of the line and their labels are centred under
       them, so half of each hangs outside the line's own width. With a fixed
       6px of padding the hundreds lessons printed "700" as "'00" and "1000" as
       "100" — a worksheet asking a child to read a number that is not there. */
    for (const mode of ["path", "open", "bridge_hundred"]) {
      const q = build(numberline, mode) as { min: number; max: number; ticks: number };
      const { container } = render(<>{numberline.figureFor(q as never)}</>);
      const [x, , boxWidth] = (container.querySelector("svg")!.getAttribute("viewBox") ?? "")
        .split(" ")
        .map(Number);

      const labels = [...container.querySelectorAll("text")].map((t) => t.textContent ?? "");
      const widest = Math.max(...labels.map((l) => l.length));
      // A digit is a little over half its font size wide; the label is centred.
      const overhang = (widest * 10 * 0.6) / 2;

      expect(-x, `${mode}: left overhang`).toBeGreaterThanOrEqual(overhang);
      expect(boxWidth + x, `${mode}: right overhang`).toBeGreaterThanOrEqual(320 + overhang);
    }
  });

  it("draws a number line that starts where the question starts", () => {
    const q = build(numberline, "path") as { from: number; min: number; max: number };
    const { container } = render(<>{numberline.figureFor(q as never)}</>);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain(
      `starting at ${q.from}`,
    );
    expect(container.querySelectorAll("line").length).toBeGreaterThan(1);
  });

  it("draws a bond with a box for every slot, filled only where the lesson gives one", () => {
    /* Asserted on the shape rather than on the values. A bond may legitimately
       be 5 and 5, and then the part that is shown carries the same digits as
       the part that is hidden — so "the answer does not appear" is true of the
       diagram and false of its text, and a test written that way fails once in
       every several runs for no reason. What must hold is that exactly one box
       is empty: the one the child fills in. */
    for (let i = 0; i < 12; i += 1) {
      const q = bonds.buildQuestion({ mode: "part_unknown" } as never, i, new Set<string>());
      const { container } = render(<>{bonds.figureFor(q as never)}</>);
      const boxes = [...container.querySelectorAll("span")].filter((el) =>
        el.className.includes("border-2 border-slate-900"),
      );

      // A whole and two parts.
      expect(boxes.length).toBe(3);
      expect(boxes.filter((b) => b.textContent === "")).toHaveLength(1);
      // The whole is always given; it is one of the parts that is asked for.
      expect(boxes[0].textContent).toBe(String((q as { sum: number }).sum));
      cleanup();
    }
  });

  it("refuses to draw blocks it would take a page of ink to print", () => {
    /* Three hundred and ninety as thirty-nine rods is not something a child
       counts. Those lessons print in words instead. */
    expect(base10.figureFor({ a: 390, b: 532 } as never)).toBeNull();
    expect(base10.figureFor({ a: 24, b: 13 } as never)).not.toBeNull();
  });
});
