import React from "react";
import { CHART_CELL, CHART_GAP, SCROLL_BOX, TRACED } from "../data/multiplicationLayout";
import { EACH, GROUPS, NEUTRAL, PRODUCT } from "../data/multiplicationPalette";

/**
 * The times table, as one component.
 *
 * Two callers with different needs and one chart between them: `TableGrid`
 * drives it as apparatus — cells are buttons, rows and columns trace, a
 * selection is checked — and `FactDeck` shows it behind the `times_table_chart`
 * switch as a reference a child can read but not answer into.
 *
 * That is the whole reason the feature waited for this phase. Declaring
 * `times_table_chart` in Phase 1 would have shipped a switch in the Skill
 * Manager with no chart behind it.
 */

export type CellTone = "plain" | "traced" | "chosen" | "given" | "right" | "wrong";

export interface TimesTableChartProps {
  /** 10 or 12, from the `tableCeiling` setting. */
  ceiling: number;
  /** How each cell should look. Called for every cell, so keep it cheap. */
  toneOf?: (row: number, col: number) => CellTone;
  /** Absent for a reference chart, which is read rather than answered into. */
  onCell?: (row: number, col: number) => void;
  disabled?: boolean;
  /** Names the chart for a screen reader, e.g. "Times table up to 12". */
  label?: string;
}

const TONE: Record<CellTone, string> = {
  plain: `${NEUTRAL.border} bg-surface text-ink`,
  traced: `${GROUPS.border} ${GROUPS.soft} ${GROUPS.text} ${TRACED}`,
  chosen: `${PRODUCT.border} ${PRODUCT.soft} ${PRODUCT.text} font-black`,
  given: `${EACH.border} ${EACH.soft} ${EACH.text} font-black`,
  right: `${PRODUCT.border} ${PRODUCT.solid} text-white font-black`,
  wrong: `border-rose-400 bg-rose-500/12 text-rose-700 dark:text-rose-400`,
};

/** The header strip down the side and across the top: the factors themselves. */
const Header: React.FC<{ value: number | "×"; role: "row" | "col" }> = ({ value, role }) => (
  <span
    aria-hidden="true"
    className={`${CHART_CELL} flex shrink-0 items-center justify-center rounded font-black tabular-nums ${
      value === "×" ? NEUTRAL.text : role === "row" ? GROUPS.text : EACH.text
    }`}
  >
    {value}
  </span>
);

export const TimesTableChart: React.FC<TimesTableChartProps> = ({
  ceiling,
  toneOf,
  onCell,
  disabled,
  label,
}) => {
  const factors = Array.from({ length: ceiling }, (_, i) => i + 1);

  return (
    <div className={SCROLL_BOX}>
      <div
        role={onCell ? "grid" : "img"}
        aria-label={label ?? `Times table up to ${ceiling}`}
        className={`mx-auto flex w-fit flex-col ${CHART_GAP}`}
      >
        <div className={`flex ${CHART_GAP}`}>
          <Header value="×" role="col" />
          {factors.map((col) => <Header key={col} value={col} role="col" />)}
        </div>

        {factors.map((row) => (
          <div key={row} className={`flex ${CHART_GAP}`}>
            <Header value={row} role="row" />
            {factors.map((col) => {
              const tone = toneOf?.(row, col) ?? "plain";
              const shared = `${CHART_CELL} flex shrink-0 items-center justify-center rounded border-2 tabular-nums ${TONE[tone]}`;
              /*
               * A reference chart renders spans, not disabled buttons.
               *
               * A grid of 144 dead buttons is 144 stops for anyone moving by
               * keyboard or switch, and every one of them does nothing.
               */
              return onCell ? (
                <button
                  key={col}
                  type="button"
                  aria-label={`${row} times ${col}`}
                  onClick={() => onCell(row, col)}
                  disabled={disabled}
                  className={`${shared} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
                >
                  {row * col}
                </button>
              ) : (
                <span key={col} aria-hidden="true" className={shared}>
                  {row * col}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
