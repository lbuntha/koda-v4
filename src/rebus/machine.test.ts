import { describe, expect, it } from "vitest";
import { adaptLevel, difficultyScale, effectiveLevel, isLockedOut, MACHINE, planMachine, type MachineLevel } from "./machine";
import { makeRng } from "./rng";
import { decidePuzzle } from "./scoring";

describe("planMachine", () => {
  it("is the same plan for the same seed, and a different one for another", () => {
    expect(planMachine(1, 2, makeRng("a"))).toEqual(planMachine(1, 2, makeRng("a")));
    expect(planMachine(1, 2, makeRng("a"))).not.toEqual(planMachine(1, 2, makeRng("b")));
  });

  it("answers inside its level's window, scaled by how hard the puzzle is", () => {
    for (const level of [0, 1, 2] as MachineLevel[]) {
      const [min, max] = MACHINE.delay[level];
      for (let i = 0; i < 200; i++) {
        const plan = planMachine(level, 2, makeRng(`${level}-${i}`));
        const first = plan.attempts[0].at;
        expect(first).toBeGreaterThanOrEqual(min * difficultyScale(2));
        expect(first).toBeLessThanOrEqual(max * difficultyScale(2));
      }
    }
  });

  it("takes longer on a hard puzzle than an easy one", () => {
    expect(difficultyScale(3)).toBeGreaterThan(difficultyScale(1));
  });

  it("is right about as often as its level says, and a harder level is right more often", () => {
    const rate = (level: MachineLevel) => {
      let right = 0;
      const n = 2000;
      for (let i = 0; i < n; i++) if (planMachine(level, 2, makeRng(`r${level}${i}`)).attempts[0].correct) right++;
      return right / n;
    };
    const [easy, medium, hard] = [rate(0), rate(1), rate(2)];
    expect(easy).toBeGreaterThan(0.5);
    expect(easy).toBeLessThan(0.6);
    expect(medium).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(medium);
  });

  it("gets a second try after a wrong guess, later than the first, and stops there", () => {
    const wrongFirst = Array.from({ length: 400 }, (_, i) => planMachine(0, 1, makeRng(`w${i}`))).find((p) => !p.attempts[0].correct);
    expect(wrongFirst).toBeDefined();
    const plan = wrongFirst!;
    expect(plan.attempts).toHaveLength(2);
    expect(plan.attempts[1].at).toBeGreaterThan(plan.attempts[0].at);
    expect(plan.solvesAt).toBe(plan.attempts[1].correct ? plan.attempts[1].at : null);
  });

  it("solves at its first attempt when that one is right", () => {
    const right = Array.from({ length: 50 }, (_, i) => planMachine(2, 1, makeRng(`x${i}`))).find((p) => p.attempts[0].correct)!;
    expect(right.attempts).toHaveLength(1);
    expect(right.solvesAt).toBe(right.attempts[0].at);
  });
});

describe("isLockedOut", () => {
  it("shows a lockout for a few seconds after a wrong guess, then not", () => {
    const plan = { attempts: [{ at: 10, correct: false }, { at: 20, correct: true }], solvesAt: 20 };
    expect(isLockedOut(plan, 9)).toBe(false);
    expect(isLockedOut(plan, 10)).toBe(true);
    expect(isLockedOut(plan, 10 + MACHINE.lockoutSeconds - 0.1)).toBe(true);
    expect(isLockedOut(plan, 10 + MACHINE.lockoutSeconds)).toBe(false);
  });
});

describe("adaptLevel", () => {
  it("steps up when the child wins and down when the Machine does, within the three levels", () => {
    expect(adaptLevel(1, "child")).toBe(2);
    expect(adaptLevel(1, "machine")).toBe(0);
    expect(adaptLevel(1, "none")).toBe(1);
    expect(adaptLevel(2, "child")).toBe(2);
    expect(adaptLevel(0, "machine")).toBe(0);
  });
});

describe("effectiveLevel", () => {
  it("lets the owner's lock win over the child's pick, and follows the adaptive level otherwise", () => {
    expect(effectiveLevel(2, 0, 1)).toBe(2);
    expect(effectiveLevel("free", 0, 1)).toBe(0);
    expect(effectiveLevel("free", "adaptive", 2)).toBe(2);
  });
});

describe("decidePuzzle", () => {
  const limit = 60;
  it("gives it to whoever is right first", () => {
    expect(decidePuzzle({ childSolvedAt: 10, machineSolvesAt: 20, limit })).toBe("child");
    expect(decidePuzzle({ childSolvedAt: 30, machineSolvesAt: 20, limit })).toBe("machine");
  });

  it("gives a tie to the child", () => {
    expect(decidePuzzle({ childSolvedAt: 15, machineSolvesAt: 15, limit })).toBe("child");
  });

  it("gives it to the Machine when the child never answers right, and to nobody when neither does in time", () => {
    expect(decidePuzzle({ childSolvedAt: null, machineSolvesAt: 20, limit })).toBe("machine");
    expect(decidePuzzle({ childSolvedAt: null, machineSolvesAt: null, limit })).toBe("none");
    expect(decidePuzzle({ childSolvedAt: 70, machineSolvesAt: 80, limit })).toBe("none");
  });

  it("ignores an answer that came after the limit", () => {
    expect(decidePuzzle({ childSolvedAt: 61, machineSolvesAt: 59, limit })).toBe("machine");
    expect(decidePuzzle({ childSolvedAt: 59, machineSolvesAt: 61, limit })).toBe("child");
  });
});
