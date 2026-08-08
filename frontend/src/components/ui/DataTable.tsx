/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared feature-rich data table component supporting search, filter controls,
 * server/client pagination, custom column rendering, and expandable sub-rows.
 */

import React from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T, index: number) => string;
  
  // Search & Filter bar props
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filterControls?: React.ReactNode;
  headerActions?: React.ReactNode;
  
  // Pagination props
  pagination?: boolean;
  page?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  
  // Loading & Empty state
  loading?: boolean;
  emptyText?: string;
  
  // Row expansion / hierarchy
  renderExpandedRow?: (row: T, index: number) => React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  searchable = false,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  filterControls,
  headerActions,
  pagination = false,
  page = 1,
  pageSize = 20,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  loading = false,
  emptyText = "No records found.",
  renderExpandedRow,
  onRowClick,
}: DataTableProps<T>) {
  const actualTotal = totalItems ?? data.length;
  const totalPages = Math.max(1, Math.ceil(actualTotal / pageSize));
  
  const startItem = actualTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(actualTotal, page * pageSize);

  return (
    <div className="flex flex-col">
      {/* Top Toolbar (Search, Custom Filters & Actions) */}
      {(searchable || filterControls || headerActions) && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between px-5 py-3 border-b border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900/40">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            {searchable && (
              <div className="relative flex-1 max-w-md min-w-[240px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search size={15} className="text-slate-400" />
                </div>
                <Input
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full !pl-9 pr-3 text-xs font-bold border-2 border-slate-200 dark:border-white/15"
                />
              </div>
            )}
            {filterControls}
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}

      {/* Main Table View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-white/10 dark:bg-white/[0.02]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  } ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-xs font-bold text-slate-400">
                  Loading data…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-xs font-bold text-slate-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const key = getRowKey(row, idx);
                const expandedContent = renderExpandedRow?.(row, idx);

                return (
                  <React.Fragment key={key}>
                    <tr
                      onClick={() => onRowClick?.(row)}
                      className={`group border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors ${
                        onRowClick ? "cursor-pointer" : ""
                      }`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-5 py-3 align-middle ${
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left"
                          } ${col.className ?? ""}`}
                        >
                          {col.cell(row, idx)}
                        </td>
                      ))}
                    </tr>
                    {expandedContent}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Pagination Controls */}
      {pagination && actualTotal > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing <span className="font-bold text-slate-700 dark:text-slate-200">{startItem}</span> to{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">{endItem}</span> of{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">{actualTotal}</span> items
            </span>

            {onPageSizeChange && (
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1 text-xs font-bold dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} per page
                  </option>
                ))}
              </select>
            )}
          </div>

          {onPageChange && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="h-7 text-[11px]"
              >
                <ChevronLeft size={12} /> Prev
              </Button>
              <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="h-7 text-[11px]"
              >
                Next <ChevronRight size={12} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
