import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as frames from "./activities/FrameTakeaway";
import * as bonds from "./activities/BondHouse";
import * as numberline from "./activities/DifferenceLine";
import * as facts from "./activities/FactDeck";
import * as base10 from "./activities/BlockExchange";
import * as chart from "./activities/PlaceValueDesk";

afterEach(cleanup);

describe("subtraction apparatus on paper", () => {
  it("draws five or ten cells and all starting counters", () => {
    for (const mode of ["five", "ten", "from_five", "from_ten"] as const) {
      const q = frames.buildQuestion({ mode }, 0, new Set());
      const { container } = render(<>{frames.figureFor(q)}</>);
      expect(container.querySelectorAll("rect")).toHaveLength(q.size);
      expect(container.querySelectorAll("circle")).toHaveLength(q.minuend);
      const label = container.querySelector("svg")!.getAttribute("aria-label")!;
      // A recall frame is there to check a fact the child states first, so its
      // label describes the apparatus instead of instructing the removal.
      expect(label).toContain(frames.isRecall(mode)
        ? `to check ${q.minuend} minus ${q.subtrahend}`
        : `cross out ${q.subtrahend}`);
      cleanup();
    }
  });

  it("prints the frame answer as the remainder, never the removed count", () => {
    const q = frames.buildQuestion({ mode: "ten", minuendRange: [9, 9], subtrahendRange: [4, 4] }, 0, new Set());
    expect(frames.printedFor(q).answer).toBe("5");
    expect(q.expected).toBe("5");
  });

  it("leaves exactly the named bond role blank", () => {
    for (const mode of ["part_unknown", "subtrahend_unknown", "minuend_unknown"] as const) {
      const q = bonds.buildQuestion({ mode }, 0, new Set());
      const { container } = render(<>{bonds.figureFor(q)}</>);
      const boxes = [...container.querySelectorAll("span")].filter((node) => node.className.includes("border-2 border-slate-900"));
      expect(boxes).toHaveLength(3);
      expect(boxes.filter((node) => node.textContent === "")).toHaveLength(1);
      expect(container.querySelector('[role="img"]')?.getAttribute("aria-label")).toContain(`${q.blankRole} missing`);
      cleanup();
    }
  });

  it("preserves the unknown position in the printed equation", () => {
    const part = bonds.buildQuestion({ mode: "part_unknown" }, 0, new Set());
    const removed = bonds.buildQuestion({ mode: "subtrahend_unknown" }, 0, new Set());
    const whole = bonds.buildQuestion({ mode: "minuend_unknown" }, 0, new Set());
    expect(bonds.printedFor(part).text).toMatch(/− \d+ = □$/);
    expect(bonds.printedFor(removed).text).toMatch(/− □ = \d+$/);
    expect(bonds.printedFor(whole).text).toMatch(/^□ −/);
  });

  it("prints a line with an unclipped start label", () => {
    for (const mode of ["path_back", "open_back", "count_up", "bridge_ten", "bridge_hundred"] as const) {
      const q = numberline.buildQuestion({ mode }, 0, new Set());
      const { container } = render(<>{numberline.figureFor(q)}</>);
      const labels = [...container.querySelectorAll("text")].map((node) => node.textContent);
      expect(labels).toContain(String(q.from));
      const [x, , width] = container.querySelector("svg")!.getAttribute("viewBox")!.split(" ").map(Number);
      expect(x).toBeLessThan(0);
      expect(width + x).toBeGreaterThan(320);
      cleanup();
    }
  });

  it("does not print an open line's unknown landing value", () => {
    const q = numberline.buildQuestion({ mode: "open_back", minuendRange: [47, 47], subtrahendRange: [8, 8] }, 0, new Set());
    const { container } = render(<>{numberline.figureFor(q)}</>);
    const labels = [...container.querySelectorAll("text")].map((node) => node.textContent);
    expect(labels).toEqual(["47"]);
    expect(labels).not.toContain("39");
  });

  it("prints all four family facts without answering them in the question", () => {
    const q = facts.buildQuestion({ mode: "family", minuendRange: [8, 8], subtrahendRange: [3, 3] }, 0, new Set());
    const printed = facts.printedFor(q);
    expect(printed.text).toContain("3, 5, and 8");
    expect(printed.text).not.toContain("=");
    expect(printed.answer).toBe("3 + 5 =8; 5 + 3 =8; 8 − 3 =5; 8 − 5 =3");
  });

  it("prints think-addition as a missing addend, not as a subtraction blank", () => {
    const q = facts.buildQuestion({ mode: "missing_addend", minuendRange: [9, 9], subtrahendRange: [4, 4] }, 0, new Set());
    const printed = facts.printedFor(q);
    expect(printed.text).toContain("4 + □ = 9");
    expect(printed.text).not.toContain("9 − 4 = □");
    expect(printed.answer).toBe("5");
  });

  it("prints the helper a derived fact depends on", () => {
    const q = facts.buildQuestion({ mode: "known_fact", minuendRange: [13, 13], subtrahendRange: [5, 5] }, 0, new Set());
    const printed = facts.printedFor(q);
    expect(printed.text).toContain(`13 − ${q.helper!.subtrahend} = ${q.helper!.difference}`);
    expect(printed.answer).toBe("8");
  });

  it("prints the double a doubles fact undoes", () => {
    const q = facts.buildQuestion({ mode: "doubles", nRange: [6, 6] }, 0, new Set());
    expect(facts.printedFor(q).text).toBe("6 + 6 = 12, so 12 − 6 =");
    expect(facts.printedFor(q).answer).toBe("6");
  });

  it("labels the bridge but keeps its final landing unknown", () => {
    const q = numberline.buildQuestion({ mode: "bridge_ten", minuendRange: [14, 14], subtrahendRange: [6, 6] }, 0, new Set());
    const { container } = render(<>{numberline.figureFor(q)}</>);
    const labels = [...container.querySelectorAll("text")].map((node) => node.textContent);
    expect(labels).toContain("10");
    expect(labels).toContain("14");
    expect(labels).not.toContain("8");
  });

  it("draws one shape per place the minuend is built from", () => {
    const q = base10.buildQuestion({ mode: "trade_hundred", minuendRange: [425, 425], subtrahendRange: [182, 182] }, 0, new Set());
    const { container } = render(<>{base10.figureFor(q)}</>);
    // 4 flats + 2 rods + 5 units, and nothing else.
    expect(container.querySelectorAll("rect")).toHaveLength(4 + 2 + 5);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("blocks for 425; cross out 182");
    expect(base10.printedFor(q).answer).toBe("243");
  });

  it("prints a chart with the answer row left blank", () => {
    const q = chart.buildQuestion({ mode: "chart_three", minuendRange: [486, 486], subtrahendRange: [132, 132] }, 0, new Set());
    const { container } = render(<>{chart.figureFor(q)}</>);
    const filled = [...container.querySelectorAll("span")].map((node) => node.textContent).filter(Boolean);
    expect(filled).toContain("4");
    expect(filled).toContain("1");
    // The three answer cells are the empty bordered boxes at the bottom.
    const blanks = [...container.querySelectorAll("span")].filter((node) =>
      node.className.includes("border-2 border-slate-900") && node.textContent === "");
    expect(blanks).toHaveLength(3);
    expect(container.querySelector('[role="img"]')!.getAttribute("aria-label")).toContain("answer row blank");
  });

  /*
   * Printing must not quietly move the unknown. Expanded form that arrives on
   * paper as "67 − 24 =" has thrown away the method it exists to teach, and a
   * check that arrives without its second blank cannot be checked.
   */
  it("prints each written method as the method, not as a bare difference", () => {
    const at = (mode: Parameters<typeof chart.buildQuestion>[0]["mode"]) =>
      chart.printedFor(chart.buildQuestion({ mode, minuendRange: [67, 67], subtrahendRange: [24, 24] }, 0, new Set()));
    expect(at("expanded").text).toBe("(60 + 7) − (20 + 4) =");
    expect(at("check_addition").text).toBe("67 − 24 = □, then □ + 24 = 67");
    expect(at("left_right").text).toBe("67 − 20 = □, then 47 − 4 = □");
    for (const mode of ["expanded", "check_addition", "left_right"] as const) {
      expect(at(mode).answer).toBe("43");
    }
  });
});
