import React from "react";
import { Clock3, ListChecks, Volume2 } from "lucide-react";

export interface UIBookCardProps {
  cover: React.ReactNode;
  title: React.ReactNode;
  meta: React.ReactNode;
  status: React.ReactNode;
  quizLabel: React.ReactNode;
  hasAudio?: boolean;
  showAction?: boolean;
  onClick(): void;
  ariaLabel: string;
  className?: string;
}

/** A responsive story card: one full-width choice on phones, a grid tile on larger screens. */
export const UIBookCard: React.FC<UIBookCardProps> = ({ cover, title, meta, status, quizLabel, hasAudio = false, showAction = true, onClick, ariaLabel, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className={`group grid w-full gap-0 overflow-hidden rounded-2xl border-2 border-line bg-surface text-left transition focus-visible:ring-2 focus-visible:ring-indigo-500 ${className}`}
  >
    <span className="block w-full overflow-hidden">{cover}</span>
    <span className="grid gap-1 p-3">
      <span className="min-w-0 break-words inline-flex items-center gap-1.5 text-xs text-muted"><Clock3 className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />{meta}{hasAudio && <Volume2 className="ml-1 h-4 w-4 shrink-0 text-emerald-600" aria-label="Audio available" />}</span>
      <span className="min-w-0 break-words text-lg font-extrabold leading-tight text-ink">{title}</span>
      <span className="min-w-0 break-words text-xs text-muted">{status}</span>
      <span className={`${showAction ? "mt-2" : "mt-1"} flex min-h-10 items-center ${showAction ? "justify-between" : "justify-start"} gap-3 text-sm font-medium text-indigo-600 dark:text-indigo-300`}>
        <span className="min-w-0 break-words inline-flex items-center gap-2"><ListChecks className="h-4 w-4 shrink-0" aria-hidden="true" />{quizLabel}</span>
        {showAction && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-xl font-normal transition group-hover:bg-indigo-100 dark:bg-indigo-950" aria-hidden="true">→</span>}
      </span>
    </span>
  </button>
);
