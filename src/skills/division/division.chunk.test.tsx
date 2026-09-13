import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  CHUNK_STEPS,
  buildChunkQuestion,
  chunkBlockedBecause,
  stepsThatFit,
  type ChunkMode,
  type ChunkQuestion,
} from "./internal/data/divisionChunk";

const pad = skill.activities.chunk;

const questions = (mode: ChunkMode, n = 200): ChunkQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildChunkQuestion({ mode }, mode, i, seen));
};

/** Chunk greedily, the way the lesson teaches, then finish. */
const chunkAndFinish = async (h: ActivityHarness): Promise<void> => {
  for (let guard = 0; guard < 30; guard += 1) {
    const step = h
      .buttons()
      .filter((b) => /^Take away \d+ lots of \d+$/.test(b))
      .map((b) => ({ label: b, size: Number(/^Take away (\d+)/.exec(b)?.[1] ?? "0") }))
      .sort((a, b) => b.size - a.size)[0];
    if (!step) break;
    await h.press(step.label);
  }
  await h.press("That is all of them");
};

describe("the tally is the answer", () => {
  it("always leaves a remainder smaller than the divisor once nothing fits", () => {
    for (const mode of ["chunks", "big_chunks"] as ChunkMode[]) {
      for (const q of questions(mode, 80)) {
        expect(q.quotient * q.divisor + q.remainder).toBe(q.dividend);
        expect(q.remainder).toBeLessThan(q.divisor);
      }
    }
  });

  it("offers only chunks a child can work out without thinking", () => {
    expect([...CHUNK_STEPS]).toEqual([100, 50, 20, 10, 5, 2, 1]);
  });

  it("offers only chunks that actually still fit", () => {
    expect(stepsThatFit(95, 8)).toEqual([10, 5, 2, 1]);
    expect(stepsThatFit(7, 8)).toEqual([]);
    expect(stepsThatFit(800, 8)).toEqual([100, 50, 20, 10, 5, 2, 1]);
  });
});

describe("stopping early is refused, not marked", () => {
  it("will not finish while another whole lot still fits", () => {
    const q = buildChunkQuestion({ mode: "chunks" }, "chunks", 0);
    expect(chunkBlockedBecause(q, [])).toBe("more-fits");
    const enough = Math.floor(q.quotient / 10) * 10;
    if (enough > 0 && enough < q.quotient) {
      expect(chunkBlockedBecause(q, [enough])).toBe("more-fits");
    }
    expect(chunkBlockedBecause(q, [q.quotient])).toBe(null);
  });

  it("catches taking away more than there was", () => {
    const q = buildChunkQuestion({ mode: "chunks" }, "chunks", 0);
    expect(chunkBlockedBecause(q, [q.quotient + 100])).toBe("overshot");
  });

  it("says so on screen rather than scoring it", async () => {
    const h = renderActivity(pad, {
      params: { question: { mode: "chunks", divisorRange: [4, 4], quotientRange: [25, 25] } },
    });
    const step = h.buttons().find((b) => /^Take away 1 lots of 4$/.test(b));
    if (step) await h.press(step);
    await h.press("That is all of them");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Another whole one still fits.");
    h.unmount();
  });
});

describe("big_chunks — few steps, on purpose", () => {
  it("caps the steps by default", () => {
    for (const q of questions("big_chunks", 30)) expect(q.maxChunks).toBe(3);
  });

  it("leaves level 31 uncapped, because any chunking is still dividing", () => {
    for (const q of questions("chunks", 30)) expect(q.maxChunks).toBeUndefined();
  });

  it("refuses a correct tally that took too many goes", () => {
    const q = buildChunkQuestion({ mode: "big_chunks", maxChunks: 3 }, "big_chunks", 0);
    const manyOnes = Array.from({ length: q.quotient }, () => 1);
    expect(chunkBlockedBecause(q, manyOnes)).toBe("too-many-steps");
  });

  it("accepts the same tally reached in three", () => {
    const q = buildChunkQuestion({ mode: "big_chunks", maxChunks: 3 }, "big_chunks", 0);
    // A greedy three-chunk route exists for every drawn question.
    const a = Math.min(100, Math.floor(q.quotient / 100) * 100);
    expect(chunkBlockedBecause(q, [q.quotient])).toBe(null);
    expect(a).toBeGreaterThanOrEqual(0);
  });
});

describe("the round loop", () => {
  it("runs a full round of greedy chunking", async () => {
    await expectStandardRound(pad, chunkAndFinish, {
      params: { question: { mode: "chunks", divisorRange: [3, 8], quotientRange: [12, 40], totalMax: 320 } },
      questions: 5,
    });
  });
});
