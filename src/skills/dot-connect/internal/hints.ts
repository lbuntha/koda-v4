import { composeHints } from "../../kit";
import { checkLines } from "./check";
import { neighbours } from "./grid";
import { isJoined, type Lines } from "./drawing";
import { letterOf, td } from "./i18n";
import type { Board } from "./types";

/**
 * The hint ladder, read off the board as it stands.
 *
 * 1. The lesson's own tip — a nudge toward forced moves.
 * 2. This board: the rule the child is missing (empty squares, the step
 *    count, the bridge), else a dot with one way out, else the colour to
 *    work on.
 * 3. That colour's whole route, in moves. Drawing is done rather than chosen,
 *    so the last rung explains the action fully.
 */

/** The answer line as a child would draw it: "2 right, 1 down", first three moves. */
export function describeRoute(line: number[]): string {
  const runs: Array<{ dir: "right" | "left" | "up" | "down"; n: number }> = [];
  for (let i = 1; i < line.length; i += 1) {
    const d = line[i] - line[i - 1];
    const dir = d === 1 ? "right" : d === -1 ? "left" : d < 0 ? "up" : "down";
    const last = runs[runs.length - 1];
    if (last && last.dir === dir) last.n += 1; else runs.push({ dir, n: 1 });
  }
  // Three moves at most: enough to get a stuck child going, short enough to
  // read. The rest of the route is theirs to finish.
  const said = runs.slice(0, 3).map((r) => td(`dir.${r.dir}`, { n: String(r.n) })).join(", ");
  return runs.length > 3 ? `${said} ${td("dir.more")}` : said;
}

const matches = (line: number[] | undefined, answer: number[]) =>
  !!line && line.length === answer.length &&
  (line.every((c, i) => c === answer[i]) || line.every((c, i) => c === answer[answer.length - 1 - i]));

/**
 * The colour the hints talk about: the first one not yet drawn as the answer
 * has it — or, where any answer counts, the first not joined.
 */
export function focusColour(board: Board, lines: Lines, mustFill: boolean): number {
  return board.pairs.findIndex((_, k) => (mustFill ? !matches(lines[k], board.solution[k]) : !isJoined(board, lines, k)));
}

/** A free end — an unstarted dot, or the tip of a line — with one square to go to. */
export function forcedDot(board: Board, lines: Lines): number {
  const taken = new Set<number>([...board.walls, ...lines.flat(), ...board.pairs.flat()]);
  for (let k = 0; k < board.pairs.length; k += 1) {
    if (isJoined(board, lines, k)) continue;
    const [a, b] = board.pairs[k];
    const line = lines[k];
    const ends = line.length ? [line[line.length - 1], line[0] === a ? b : a] : [a, b];
    for (const end of ends) {
      const twin = end === a ? b : end === b ? a : undefined;
      const exits = neighbours(end, board.size).filter((nb) => nb === twin || (!taken.has(nb) && !(board.bridges ?? []).includes(nb)));
      if (exits.length === 1) return k;
    }
  }
  return -1;
}

export function connectHints(board: Board, lines: Lines, options: { mustFill: boolean; kidTip?: string }): string[] {
  const { mustFill } = options;
  const check = checkLines(board, lines);
  const k = focusColour(board, lines, mustFill);

  let here: string | undefined;
  if (mustFill && check.joined.length === board.pairs.length && check.covered < check.open) here = td("hint.gaps");
  else if (board.steps && !matches(lines[board.steps.pair], board.solution[board.steps.pair])) {
    here = td("hint.steps", { letter: letterOf(board.steps.pair), steps: String(board.steps.steps) });
  } else if (board.bridges?.length && check.covered < check.open) here = td("hint.bridge");
  else {
    const forced = forcedDot(board, lines);
    here = forced >= 0 ? td("hint.forced", { letter: letterOf(forced) })
      : k >= 0 ? td("hint.next", { letter: letterOf(k) }) : undefined;
  }

  const worked = k >= 0
    ? td("hint.draw", { letter: letterOf(k), moves: describeRoute(board.solution[k]) })
    : undefined;
  return composeHints(options.kidTip ?? td("hint.kidTip"), here, worked);
}
