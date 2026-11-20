import { counted, scopeOf, type Board, type Color } from "./board";
import { PALETTE, PALETTE_THEME } from "./palette";
import { colourWord, tw } from "./i18n";
import { useT } from "../../../lib/i18n";

/**
 * The rule of the game, on screen.
 *
 * Before this the only on-screen instruction was "colour every blank tile so
 * all the clues are true", which says what to do and not what a clue is. A
 * child who had skipped lesson 4, or a parent looking over their shoulder, had
 * nothing to work from. The rule is one sentence and one tiny worked board:
 * an orange 2 with exactly two orange tiles touching it.
 *
 * `lessonLine` is the lesson's own pointer ("This clue says zero…"), which
 * until now was only ever spoken.
 */

/* Orange at top-left and right of an orange 2; everything else navy. */
const EXAMPLE: Color[] = ["orange", "navy", "navy", "navy", "orange", "orange", "navy", "navy", "navy"];

function Example() {
  return (
    <div aria-hidden className={`grid shrink-0 grid-cols-3 gap-0.5 ${PALETTE_THEME}`}>
      {EXAMPLE.map((c, i) => (
        <span
          key={i}
          className="grid h-5 w-5 place-items-center rounded text-[11px] font-black"
          style={{ background: PALETTE[c].fill, color: PALETTE[c].ink, outline: i === 4 ? "2px solid currentColor" : undefined }}
        >
          {i === 4 ? "2" : ""}
        </span>
      ))}
    </div>
  );
}

export function RuleCard({
  board,
  lessonLine,
  open,
  onToggle,
}: {
  board: Board;
  lessonLine?: string;
  open: boolean;
  onToggle: () => void;
}) {
  useT();
  const crossColour = board.clues.some((c) => c.color && counted(c) !== c.color);
  const offBoard = board.clues.some((c) => scopeOf(c).kind !== "neighborhood");

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        className="rounded-full border-2 border-line bg-surface px-3 py-1 text-sm font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        {tw("rule.show")}
      </button>
    );
  }

  return (
    <section
      aria-label={tw("rule.title")}
      className="w-full max-w-md rounded-2xl border-2 border-line bg-surface-muted p-3 text-sm text-ink"
    >
      <div className="flex items-start gap-3">
        <Example />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wide text-muted">{tw("rule.title")}</h3>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded
              className="rounded px-1 text-xs font-bold text-muted underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {tw("rule.hide")}
            </button>
          </div>
          <p className="font-semibold leading-snug">{tw("rule.text")}</p>
          <p className="leading-snug text-muted">{tw("rule.example", { colour: colourWord("orange") })}</p>
          {crossColour ? <p className="leading-snug">{tw("rule.other")}</p> : null}
          {offBoard ? <p className="leading-snug">{tw("rule.chips")}</p> : null}
        </div>
      </div>
      {lessonLine ? (
        <p className="mt-2 border-t-2 border-line pt-2 font-bold leading-snug">
          <span className="text-violet-600 dark:text-violet-300">{tw("rule.lesson")}: </span>
          {lessonLine}
        </p>
      ) : null}
    </section>
  );
}
