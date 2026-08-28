import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";

/**
 * The shared data table.
 *
 * Every table in the app should be this one. It exists because the alternative
 * is what the learning log started as: a hand-rolled `<table>` whose header
 * styling, sort behaviour and empty state are decided again, slightly
 * differently, in each place a table appears.
 *
 * Columns are declared rather than marked up, which is what makes sorting,
 * alignment and numeric formatting consistent without every caller
 * reimplementing them.
 */

export interface UIDataTableColumn<Row> {
  /** Stable id. Also the sort key. */
  key: string;
  header: string;
  /** Cell contents. Return a string and it is rendered as-is. */
  render(row: Row): React.ReactNode;
  /**
   * Value to sort by, when the rendered output is not sortable text (a date
   * shown as "17 Aug 14:32" sorts wrongly as a string; its ISO timestamp does
   * not). Providing this is what makes a column sortable.
   */
  sortValue?(row: Row): string | number;
  align?: "left" | "right";
  /** Tabular figures + monospace. Use for anything a reader compares down a column. */
  numeric?: boolean;
  /** Keeps a column on one line. Off by default so long text can wrap. */
  nowrap?: boolean;
  /** De-emphasised, for supporting detail. */
  muted?: boolean;
}

export interface UIDataTableProps<Row> {
  columns: UIDataTableColumn<Row>[];
  rows: Row[];
  rowKey(row: Row): string;
  /** Column key to sort by initially. */
  defaultSort?: { key: string; direction: "asc" | "desc" };
  /** Shown instead of the table when there are no rows. */
  emptyMessage?: string;
  /** Caps the body height and scrolls, keeping the header pinned. */
  maxHeight?: string;
  /** Announced to screen readers and shown above the table. */
  caption?: string;
  onRowClick?(row: Row): void;
  className?: string;
}

type Direction = "asc" | "desc";

export function UIDataTable<Row>({
  columns,
  rows,
  rowKey,
  defaultSort,
  emptyMessage = "Nothing to show yet.",
  maxHeight,
  caption,
  onRowClick,
  className = "",
}: UIDataTableProps<Row>) {
  const [sort, setSort] = useState<{ key: string; direction: Direction } | null>(
    defaultSort ?? null,
  );

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;

    // Copy first: sorting the caller's array in place would mutate their state.
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      const order = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.direction === "asc" ? order : -order;
    });
  }, [rows, sort, columns]);

  const toggle = (key: string) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  if (rows.length === 0) {
    return (
      <div className={`${themeSystem.table.wrapper} ${className}`}>
        <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  const cellClass = (c: UIDataTableColumn<Row>) =>
    [
      themeSystem.table.cell,
      c.align === "right" ? "text-right" : "text-left",
      c.numeric ? "font-mono tabular-nums" : "",
      c.nowrap ? "whitespace-nowrap" : "",
      c.muted ? "text-slate-500 dark:text-slate-400" : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div
      className={`${themeSystem.table.wrapper} ${className}`}
      style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
    >
      <table className={themeSystem.table.table}>
        {caption && <caption className="sr-only">{caption}</caption>}

        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((c) => {
              const isSorted = sort?.key === c.key;
              const sortable = Boolean(c.sortValue);
              return (
                <th
                  key={c.key}
                  scope="col"
                  // Tells assistive tech the current sort, which a visual arrow
                  // alone does not.
                  aria-sort={
                    isSorted ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={`${themeSystem.table.header} ${
                    c.align === "right" ? "text-right" : "text-left"
                  } ${c.nowrap ? "whitespace-nowrap" : ""}`}
                >
                  {sortable ? (
                    <button
                      onClick={() => toggle(c.key)}
                      className={`inline-flex items-center gap-1 uppercase hover:text-slate-900 dark:hover:text-white transition cursor-pointer ${
                        c.align === "right" ? "flex-row-reverse" : ""
                      }`}
                    >
                      {c.header}
                      {isSorted ? (
                        sort!.direction === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${themeSystem.table.row} ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={cellClass(c)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
