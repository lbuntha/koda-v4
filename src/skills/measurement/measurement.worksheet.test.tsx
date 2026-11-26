import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { SKILLS, loadSkill } from "../registry";
import { MIN_WORKSHEET_ITEMS, buildWorksheet, canPrint } from "../../lib/worksheet";
import type { ResolvedLesson } from "../../curriculum";
import type { WorksheetSource } from "../types";
import { skill } from ".";
import { SHEETS } from "./activities/sheets";
import { ESTIMATE_THINGS } from "./internal/estimate";
import { quartersText } from "./internal/ruler";

/* Measure It on paper: every printed key is checked against the question's own numbers. */
type Any = { q: Record<string, never> & Record<string, unknown>; prompt: string };
const teaching = skill.lessons.filter((l) => !(l.params as { question: { practice?: boolean } }).question.practice);
const engineOf = (l: (typeof teaching)[number]) => l.activity.split("/")[1];
const num = (s: string) => Number(s.replace("−", "-").replace("½", ".5").replace("¼", ".25").replace("¾", ".75").replace(/[^\d.-]/g, ""));

/** The lessons whose subject is a thing to touch: nothing to write down. */
const PICTURE_ONLY = new Set([
  "what-can-we-measure", "longer-shorter", "taller-shorter", "line-them-up", "order-three", "compare-with-string",
  "heavier-lighter", "holds-more", "measure-with-blocks", "spot-the-mistake", "big-unit-small-unit", "balance-with-cubes",
  "fill-with-cups", "measure-it",
]);

function draw(sheet: WorksheetSource, question: Record<string, unknown>, n: number) {
  const seen = new Set<string>();
  const out: { question: Any; text: string; answer: string }[] = [];
  for (let i = 0; i < n; i += 1) {
    const qn = sheet.build(question, i, seen, { current: null }) as unknown as Any;
    const paper = sheet.printed!(qn);
    if (paper) out.push({ question: qn, ...paper });
  }
  return out;
}

/** The answer worked out from the question itself, not from the engine's key. */
function solve(engine: string, { q, prompt }: Any): number | string {
  switch (engine) {
    case "ruler": {
      const r = q.ruler as unknown as { sub: number };
      if (q.mode === "draw") return q.answer as number;
      if (q.mode === "numberline") {
        const line = q.line as unknown as { start: number; change: number; op: string };
        return line.op === "add" ? line.start + line.change : line.start - line.change;
      }
      if (q.mode === "difference") return ((q.steps as number) - (q.other as unknown as { steps: number }).steps) / r.sub;
      if (q.mode === "read_mm") return q.steps as number;
      if (q.mode === "read_inch_fraction") return quartersText(q.steps as number);
      return (q.steps as number) / r.sub;
    }
    case "scale":
      return q.value as number;
    case "thermo": {
      const c = q.change as unknown as { by: number; dir: string } | undefined;
      return c ? (q.value as number) + (c.dir === "warmer" ? c.by : -c.by) : (q.value as number);
    }
    case "capacity":
      if (q.mode === "customary") {
        const cups: Record<string, number> = { cup: 1, pint: 2, quart: 4, gallon: 16 };
        return q.kind === "which" ? String(cups[q.big] > cups[q.small] ? q.big : q.small) : cups[q.big] / cups[q.small];
      }
      return q.ml as number;
    case "story": {
      const [a, b] = (prompt.match(/\d+/g) ?? []).map(Number);
      return q.kind === "join" ? a + b : a - b;
    }
    case "estimate": {
      const t = ESTIMATE_THINGS[q.thing as keyof typeof ESTIMATE_THINGS] as { unit: string; size: number };
      const sym = t.unit === "mL" ? "ml" : t.unit === "L" ? "l" : t.unit;
      return q.mode === "choose_unit" ? sym : t.size;
    }
  }
  throw new Error(engine);
}

describe("Measure It worksheets", () => {
  it.each(teaching.filter((l) => !PICTURE_ONLY.has(l.id)).map((l) => [l.id, l] as const))("%s prints questions whose key is right", (_id, lesson) => {
    const engine = engineOf(lesson);
    const sheet = SHEETS[engine as keyof typeof SHEETS];
    const items = draw(sheet, (lesson.params as { question: Record<string, unknown> }).question, 30);
    expect(items.length).toBeGreaterThanOrEqual(10);
    for (const item of items) {
      expect(item.text.length, "a question in words").toBeGreaterThan(10);
      expect(item.text, "no blank of its own: the sheet draws the answer line").not.toContain("___");
      const want = solve(engine, item.question);
      if (typeof want === "string") expect(item.answer.toLowerCase(), item.text).toContain(want.toLowerCase());
      else if (/lb|oz/.test(item.answer)) {
        const lb = /(\d+) lb/.exec(item.answer)?.[1] ?? "0";
        const oz = /(\d+) oz/.exec(item.answer)?.[1] ?? "0";
        expect(16 * Number(lb) + Number(oz), item.text).toBe(want);
      } else expect(num(item.answer), `${item.text} → ${item.answer}`).toBeCloseTo(want, 6);
      expect(sheet.method!(item.question)!.every((line) => line.length > 10)).toBe(true);
    }
  });

  it("draws each instrument in plain black lines, with the reading left blank", () => {
    for (const [engine, mode] of [["ruler", "read"], ["scale", "interval"], ["thermo", "negative"], ["capacity", "jug"], ["capacity", "fill"]] as const) {
      const [item] = draw(SHEETS[engine], { mode }, 1);
      const { container } = render(<>{SHEETS[engine].figure!(item.question)}</>);
      const svg = container.querySelector("svg")!;
      expect(svg, `${engine} ${mode}`).not.toBeNull();
      expect(container.querySelector("[class]"), `${engine} uses theme classes`).toBeNull();
      expect(container.textContent).not.toContain(item.answer);
    }
  });

  it("prints no figure where the words carry the whole question", () => {
    for (const [engine, mode] of [["story", "same_unit"], ["thermo", "change"], ["ruler", "numberline"], ["ruler", "draw"], ["estimate", "choose_unit"]] as const) {
      const [item] = draw(SHEETS[engine], { mode }, 1);
      expect(SHEETS[engine].figure!(item.question), `${engine} ${mode}`).toBeNull();
    }
  });
});

describe("Measure It through the real printer", () => {
  beforeAll(() => Promise.all(SKILLS.map((x) => loadSkill(x.manifest.id))));

  it.each(teaching.map((l) => [l.id, l] as const))("%s prints or says it cannot", (id, l) => {
    const lesson = { ...l, skillId: "measurement", levelNumber: 1 } as unknown as ResolvedLesson;
    expect(canPrint(lesson), id).toBe(!PICTURE_ONLY.has(id));
    if (PICTURE_ONLY.has(id)) return;
    const sheet = buildWorksheet(lesson, 12);
    expect(sheet.items.length).toBeGreaterThanOrEqual(MIN_WORKSHEET_ITEMS);
    expect(sheet.example).toBeDefined();
    expect(sheet.method.length).toBeGreaterThan(0);
    for (const item of sheet.items) expect(item.answer, item.prompt).not.toBe("");
  });
});

describe("practice on paper", () => {
  it("prints only the modes every region is taught", () => {
    for (const id of ["practice-scales", "practice-jugs", "practice-thermometers"]) {
      const lesson = skill.lessons.find((l) => l.id === id)!;
      const sheet = SHEETS[lesson.activity.split("/")[1] as keyof typeof SHEETS];
      const modes = new Set(draw(sheet, (lesson.params as { question: Record<string, unknown> }).question, 40).map((x) => String(x.question.q.mode)));
      expect(modes.size, id).toBeGreaterThan(1);
      for (const m of ["read_lb", "customary", "read_f"]) expect(modes.has(m), `${id} prints ${m}`).toBe(false);
    }
  });
});
