# Dot Connect — build plan

Follows [SKILL_BUILD_TEMPLATE.md](SKILL_BUILD_TEMPLATE.md). Four phases, 0 to 3, in
[Delivery](#delivery). **Phases 0–3 are built**; all 16 lessons were played in the running app on 2026-11-19 (390px, Khmer, dark, offline). The skill stays `draft` until its voice clips are recorded.

## Release scope

- **ID / name / ages:** `dot-connect` / Dot Connect / 6–12
- **Learner outcome:** join every pair of matching dots with lines that never cross,
  and fill the board, by reasoning from forced moves rather than by trial.
- **Prerequisites:** none. `manifest.requires: []`.
- **Included techniques:** joining, not crossing, detours, filling the board, forced
  moves, edge routes, spotting a move that traps another colour, walls, exact step
  counts, bridges.
- **Deferred:** timers, non-square boards, warps, number connect-the-dots (its own
  skill), letter-matching dots. Dots carry A, B, C… so colour is never the only cue.
- **Closest reference engine:** `src/skills/bottle-sort/activities/BottleSort.tsx` —
  one long interaction scored as a single question. Contract:
  `src/skills/kit/example/ExampleActivity.tsx`.

### Rules the engine holds

1. Drag from a dot; each step goes up, down, left or right to a neighbouring square.
2. A line may not enter another colour's dot, a wall, or itself (stepping back onto
   itself shortens it).
3. Drawing over another colour's line cuts that line back; pulling away in the same
   drag restores it.
4. Lessons 1–3 are solved when every pair is joined. From lesson 4 on (`mustFill`)
   every open square must also be covered. Any valid answer is accepted — the check
   never compares against the stored solution.

## Lesson map

13 teaching lessons and 3 practice, `params.level` 1–16. Hint ladder throughout:
**nudge (find a dot with one way out) → name a colour → draw that colour's line**;
practice passes none.

| Order / lesson ID | Objective / conceptKey | Requires | Engine / mode | Question constraints | Practice |
|---|---|---|---|---|---|
| 1 / `one-pair` | draw a line / `path-joiner` | — | connect · join | 3×3, 1 pair | `practice-joining` |
| 2 / `two-pairs` | lines cannot cross / `path-joiner` | — | connect · join | 4×4, 2 pairs | `practice-joining` |
| 3 / `go-around` | detour round a dot / `path-joiner` | — | connect · join | 4×4, 3 pairs, a pair's straight route is blocked (`detour`) | `practice-joining` |
| 4 / `fill-every-square` | cover the board / `board-filler` | `path-joiner` | connect · fill | 4×4, 3 pairs, unique, shortest joins leave gaps (`gap`) | `practice-joining` |
| 5 / `practice-joining` | practice / `board-filler` | — | connect · mixed | specs 2–4 | — |
| 6 / `one-way-out` | forced moves / `forced-mover` | `board-filler` | connect · fill | 5×5, 4 pairs, unique, a dot with one exit (`forced-start`) | `practice-planning` |
| 7 / `hug-the-edge` | edge routes / `edge-router` | `forced-mover` | connect · fill | 5×5, 4 pairs, unique, a solution line runs ≥4 squares of edge (`edge`) | `practice-planning` |
| 8 / `dont-box-it-in` | spot a trap / `trap-spotter` | `edge-router` | connect · fill | 6×6, 5 pairs, unique, a tempting first move kills the board (`trap`) | `practice-planning` |
| 9 / `five-pairs` | whole-board plan / `board-planner` | `trap-spotter` | connect · fill | 6×6, 5 pairs, unique | `practice-planning` |
| 10 / `practice-planning` | practice / `board-planner` | — | connect · mixed | specs 6–9 | — |
| 11 / `big-board` | scale up / `big-board-solver` | `board-planner` | connect · fill | 7×7, 6 pairs, unique | `practice-dot-connect` |
| 12 / `walls` | route round walls / `wall-router` | `big-board-solver` | connect · fill | 6×6, 4 pairs, 3 walls, unique | `practice-dot-connect` |
| 13 / `exact-steps` | count the route / `step-counter` | `wall-router` | connect · steps | 5×5, 4 pairs, unique, one line must take exactly N steps | `practice-dot-connect` |
| 14 / `bridges` | one crossing square / `bridge-crosser` | `step-counter` | connect · bridge | 5×5, 4 pairs, unique, one bridge used both ways | `practice-dot-connect` |
| 15 / `on-your-own` | no help / `independent-solver` | `bridge-crosser` | connect · fill | 7×7, 7 pairs, unique, no hints | `practice-dot-connect` |
| 16 / `practice-dot-connect` | practice / `independent-solver` | — | connect · mixed | specs 9, 11, 12, 15 | — |

## Engine decisions

- **One engine, `connect`.** Modes are configuration: `mustFill`, walls, and in
  Phase 3 step targets and bridges.
- **Generation** (`internal/generate.ts`): a random Hamiltonian path (backbite moves
  from a serpentine) is cut into short pieces, which are re-joined where any two ends
  touch until the pair count is reached — so neighbouring dots are not always the
  ends of consecutive lines. Walls are taken from line ends (lines stay ≥3 squares).
  Each candidate must pass: an independent tiling check, the solver's uniqueness
  check for `mustFill` specs, and the lesson's feature. Bounded retries; if they run
  out the best valid board is returned and flagged `fallback`, which tests forbid.
- **Solver** (`internal/solve.ts`): extends the most-constrained colour first, prunes
  squares with fewer than two possible neighbours and regions no unfinished colour
  can reach from both ends. Counts to two, with a node cap; a capped board is
  rejected, never assumed unique. Its branch count is the difficulty measure.
- **Win check** (`internal/check.ts`): validates the child's lines directly — each
  line starts and ends on its own two dots, moves orthogonally, never overlaps or
  enters a wall. It shares no code with the generator or solver.
- **Difficulty bands:** each fill spec carries a solver-branch band
  (`fill-every-square` 0–6 … `on-your-own` 12–120); a board outside it is redrawn.
- **Speed (Phase 0, Mac):** 1–50 ms per board up to 6×6; `big-board` ~290 ms and
  `walls` ~170 ms. A phone may be 3–5× slower, so boards ship as a **pre-built bank**
  (`internal/bank.json`, 12 per spec from `scripts/generate-dot-connect-bank.ts`),
  each shown in 8 rotations/mirrors — 96 deals per lesson, no solving on the phone.
- **Print:** none in this release; a paper board loses cutting and redrawing.

## Delivery

| Phase | Scope | Status |
|---|---|---|
| 0 | Board types, generator, solver, win check, feature checks, specs 1–12 and 15–16; tests across seeds | **built** |
| 1 | `connect` engine (drag, cut, restore, undo, start over), manifest, lessons 1–5, registry + course, 390px light/dark, offline | **built** — checked in the app 2026-11-19 |
| 2 | Lessons 6–12, hint ladder, Smart guide | **built** |
| 3 | `steps` and `bridge` modes, lessons 13–16, voice, Khmer catalog, release gate | **built** — 25 voice clips not recorded (OpenAI credit exhausted) |

Phase 0 has no UI; it is reviewed through Phase 1's real screen.
