import { counted, governed, validateAssignment, validateBoard, type Assignment, type Board, type Color } from "./board";

export type Rule = "zero" | "full" | "remaining-exclude" | "remaining-fill" | "overlap-exclude" | "overlap-fill" | "run";
export interface Evidence {
  clueId: string; color: Color; required: number; knownMatches: number[]; candidates: number[]; remaining: number;
  /**
   * The clue read as the other colour.
   *
   * With two colours in play a clue states two things: an orange 3 over eight
   * tiles also says five are navy. That second reading is free, and it is what
   * lets a clue counting orange be compared with a clue counting navy — before
   * it existed the reduction rule simply skipped such a pair and the board
   * stalled with the answer in plain sight.
   */
  derived?: boolean;
}
export interface Change { cell: number; before: Color[]; after: Color[] }
export interface ProofStep {
  rule: Rule; color: Color; evidence: Evidence[]; changes: Change[];
  /** Longest causal path through earlier candidate deductions used by these clues. */
  depth: number;
}
export interface DeductionResult {
  status: "solved" | "stalled" | "contradiction";
  domains: Color[][]; steps: ProofStep[]; violatedClueIds: string[];
}

/** No guessing, no recursive search, and no access to an authored solution. */
export function deduce(board: Board, assigned: Assignment = board.givens, options: { overlap?: boolean; complement?: boolean } = {}): DeductionResult {
  validateBoard(board); validateAssignment(board, assigned);
  const domains: Color[][] = assigned.map(c => c === null ? [...board.palette] : [c]);
  const depth = domains.map(() => 0), steps: ProofStep[] = [];
  const result = (status: DeductionResult["status"], violatedClueIds: string[] = []): DeductionResult => ({ status, domains, steps, violatedClueIds });
  // Each successful pass removes at least one candidate; this is a strict finite bound.
  for (let pass = 0; pass <= board.givens.length * (board.palette.length - 1); pass++) {
    const read = (clue: typeof board.clues[number], color: Color, required: number, derived: boolean): Evidence => {
      const around = governed(clue, board.size);
      const knownMatches = around.filter(i => domains[i].length === 1 && domains[i][0] === color);
      const candidates = around.filter(i => domains[i].length > 1 && domains[i].includes(color));
      return { clueId: clue.id, color, required, knownMatches, candidates, remaining: required - knownMatches.length, ...(derived ? { derived } : {}) };
    };
    const constraints: Evidence[] = board.clues.map(clue => read(clue, counted(clue), clue.count, false));
    /*
     * The colour nobody counted.
     *
     * Every tile has one of the palette's colours, so across any set of cells
     * the counts add up to the size of the set. Knowing all but one therefore
     * gives the last for free — with two colours that is "an orange 3 over
     * eight tiles also says five are navy", and with three it is what lets a
     * cyan count and a navy count settle how much orange is left.
     *
     * Grouped by the cells still undecided, not by the cells a clue governs.
     * Those are different: a centre clue governs eight tiles while only three
     * of them are open, and a row clue over exactly those three is talking
     * about the same tiles in a different colour. Grouping by what each clue
     * *governs* missed every such pair, which is most of them.
     */
    if (options.complement !== false) {
      const groups = new Map<string, Evidence[]>();
      for (const c of constraints) {
        if (!c.candidates.length) continue;
        const key = c.candidates.slice().sort((a, b) => a - b).join(",");
        groups.set(key, [...(groups.get(key) ?? []), c]);
      }
      for (const [key, group] of groups) {
        const cells = key.split(",").map(Number);
        const byColor = new Map(group.map(c => [c.color, c.remaining]));
        if (byColor.size !== board.palette.length - 1) continue;
        const missing = board.palette.find(c => !byColor.has(c));
        if (missing === undefined) continue;
        const remaining = cells.length - [...byColor.values()].reduce((a, b) => a + b, 0);
        if (remaining < 0) return result("contradiction", [...new Set(group.map(c => c.clueId))]);
        /*
         * Stated over the open cells only, so `knownMatches` is empty by
         * construction and `required` is simply what is left to place.
         *
         * The candidate list is narrowed to cells that can still be this
         * colour. Listing a cell that cannot be forced a "change" that changed
         * nothing, and the solver span until it hit its pass bound and threw —
         * the identity holds over all the cells, but only some of them are
         * places the colour could go.
         */
        const able = cells.filter(i => domains[i].includes(missing));
        if (!able.length) continue;
        constraints.push({ clueId: group[0].clueId, color: missing, required: remaining,
          knownMatches: [], candidates: able, remaining, derived: true });
      }
    }
    const violated = constraints.filter(c => c.remaining < 0 || c.remaining > c.candidates.length);
    /* One clue, named once. A clue now yields two constraints — itself and its
       complement — and a broken clue breaks both, which would report it twice
       to anything reading the list. */
    if (violated.length) return result("contradiction", [...new Set(violated.map(c => c.clueId))]);
    if (domains.every(d => d.length === 1)) return result("solved");
    let next: { evidence: Evidence[]; cells: number[]; remaining: number; rule: Rule } | undefined;
    for (const c of constraints) {
      if (!c.candidates.length) continue;
      if (c.remaining === 0) {
        next = { evidence: [c], cells: c.candidates, remaining: 0, rule: c.required === 0 ? "zero" : "remaining-exclude" }; break;
      }
      if (c.remaining === c.candidates.length) {
        const clue = board.clues.find(clue => clue.id === c.clueId)!;
        /* A derived constraint is stated over open cells, so "its number equals
           its whole neighbourhood" is not a question that means anything for it. */
        const whole = !c.derived && c.required === governed(clue, board.size).length;
        next = { evidence: [c], cells: c.candidates, remaining: c.remaining, rule: whole ? "full" : "remaining-fill" }; break;
      }
    }
    /*
     * A run: which arrangements the line still allows.
     *
     * Every way of placing the counted colour along the line is listed, those
     * inconsistent with what is already known are dropped, and any cell that
     * comes out the same colour in all of them is settled. Sound by
     * construction, and it does not need a rule per pattern — the condition
     * simply removes arrangements the count would have allowed.
     */
    if (!next) {
      for (const clue of board.clues) {
        if (!clue.run) continue;
        const line = governed(clue, board.size);
        const color = counted(clue);
        const other = board.palette.find(c => c !== color)!;
        const placements: Color[][] = [];
        for (let mask = 0; mask < (1 << line.length); mask++) {
          const picked = line.filter((_, k) => mask & (1 << k));
          if (picked.length !== clue.count) continue;
          const at = line.map((cell, k) => (mask & (1 << k)) ? k : -1).filter(k => k >= 0);
          const together = at.every((k, n) => n === 0 || k === at[n - 1] + 1);
          if (clue.run === "together" ? !together : together) continue;
          if (line.some((cell, k) => !domains[cell].includes((mask & (1 << k)) ? color : other))) continue;
          placements.push(line.map((_, k) => (mask & (1 << k)) ? color : other));
        }
        if (!placements.length) return result("contradiction", [clue.id]);
        const cells: number[] = [];
        line.forEach((cell, k) => {
          if (domains[cell].length === 1) return;
          if (placements.every(p => p[k] === placements[0][k])) cells.push(cell);
        });
        if (!cells.length) continue;
        /* Each settled cell keeps only the colour every arrangement agrees on. */
        const settledAs = new Map(cells.map(cell => [cell, placements[0][line.indexOf(cell)]]));
        const evidence: Evidence = { clueId: clue.id, color, required: clue.count,
          knownMatches: line.filter(i => domains[i].length === 1 && domains[i][0] === color),
          candidates: line.filter(i => domains[i].length > 1), remaining: 0 };
        const stepDepth2 = 1 + Math.max(0, ...line.map(i => depth[i]));
        const changes = cells.map(cell => {
          const before = [...domains[cell]];
          const after = [settledAs.get(cell)!];
          domains[cell] = after; depth[cell] = stepDepth2;
          return { cell, before, after: [...after] };
        });
        steps.push({ rule: "run", color, evidence: [evidence], changes, depth: stepDepth2 });
        next = { evidence: [evidence], cells: [], remaining: 0, rule: "run" };
        break;
      }
      if (next && !next.cells.length) continue;
    }
    if (!next && options.overlap !== false) {
      outer: for (const small of constraints) for (const big of constraints) {
        /* A clue never reduces against itself — including against its own
           complement, which describes the very same tiles. */
        if (small.clueId === big.clueId) continue;
        if (small.color !== big.color || !small.candidates.length || small.candidates.length >= big.candidates.length || !small.candidates.every(i => big.candidates.includes(i))) continue;
        const cells = big.candidates.filter(i => !small.candidates.includes(i));
        const remaining = big.remaining - small.remaining;
        if (remaining < 0 || remaining > cells.length) return result("contradiction", [small.clueId, big.clueId]);
        if (remaining === 0 || remaining === cells.length) {
          next = { evidence: [small, big], cells, remaining, rule: remaining === 0 ? "overlap-exclude" : "overlap-fill" }; break outer;
        }
      }
    }
    if (!next) return result("stalled");
    const color = next.evidence[0].color;
    /* A derived constraint depends on the cells it was stated over, not on the
       neighbourhood of whichever clue lent it an id. */
    const dependencies = next.evidence.flatMap(c => c.derived
      ? c.candidates
      : governed(board.clues.find(clue => clue.id === c.clueId)!, board.size));
    const stepDepth = 1 + Math.max(0, ...dependencies.map(i => depth[i]));
    const changes = next.cells.map(cell => {
      const before = [...domains[cell]];
      const after = next!.remaining === 0 ? before.filter(c => c !== color) : before.filter(c => c === color);
      domains[cell] = after; depth[cell] = stepDepth;
      return { cell, before, after: [...after] };
    });
    steps.push({ rule: next.rule, color, evidence: next.evidence, changes, depth: stepDepth });
    // Rebuild every residual before another deduction. Never apply stale counts.
  }
  throw new Error("Deduction did not decrease candidate count");
}
