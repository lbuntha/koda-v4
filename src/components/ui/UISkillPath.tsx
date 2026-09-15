import React from "react";
import { Check, Lock, Play, Star } from "lucide-react";
import type { PathNodeState } from "../../lib/themeSystem";

export interface UISkillPathItem {
  id: string;
  title: string;
  /** Emoji or icon for the lesson. Shown on every node that is not locked. */
  icon?: React.ReactNode;
  state: PathNodeState;
  /** Star count on a completed node. Omitted or 0 falls back to a tick. */
  stars?: number;
  /** The course tier is separate from whether this account can open it. */
  tier?: "free" | "premium";
  /**
   * A line under the lesson, for a padlock that owes an explanation.
   *
   * Only ever on the stone a learner is actually standing in front of — the
   * caller decides which that is. A reason repeated under all thirty locked
   * lessons of a path is not thirty explanations, it is a wall of text over a
   * wall.
   */
  note?: string;
}

export interface UISkillPathProps {
  items: UISkillPathItem[];
  /** Names the current lesson under its title. Defaults to "Start". */
  startLabel?: string;
  onSelect(id: string): void;
  className?: string;
}

/* The node's fill by state. Indigo for everything open, violet for the plan
   lock — the same split the rest of the app draws — and no amber anywhere:
   the old star badge was the one yellow on the page. */
const NODE: Record<PathNodeState, string> = {
  completed:
    "bg-indigo-100 border-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-700",
  current:
    "bg-indigo-600 border-indigo-700 text-white ring-4 ring-indigo-500/20 dark:bg-indigo-500 dark:border-indigo-400",
  available: "bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600",
  locked:
    "bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500",
  premium:
    "bg-violet-50 border-violet-300 text-violet-600 dark:bg-violet-950/60 dark:border-violet-800 dark:text-violet-300",
};

const TITLE: Record<PathNodeState, string> = {
  completed: "text-ink",
  current: "text-indigo-700 dark:text-indigo-300",
  available: "text-ink",
  locked: "text-slate-400 dark:text-slate-500",
  premium: "text-violet-700 dark:text-violet-300",
};

/**
 * One unit's lessons as a timeline: a column of nodes joined by a rail, each
 * lesson a full-width row with its name beside the node rather than under it.
 *
 * It replaced a Duolingo-style winding column of stones. That shape reads well
 * at four lessons and badly at fifty: the wave shifted every label sideways, the
 * "Continue" bubble floated up into the name of the lesson above it, and a
 * course of thirteen units was a very long scroll of mostly empty space. A row
 * keeps the order a child walks in, gives a long title room to be read, and
 * costs the same height at any number of lessons.
 *
 * Every row keeps its lesson's emoji at every state except locked, for the
 * reason the stones did: a finished unit of identical discs says nothing about
 * which one was the dice game.
 */
export const UISkillPath: React.FC<UISkillPathProps> = ({
  items,
  startLabel = "Start",
  onSelect,
  className = "",
}) => (
  <ol className={`relative ${className}`} aria-label="Lesson path">
    {items.map((item, index) => {
      const locked = item.state === "locked";
      /* Locked by a plan rather than by the path. It still presses — the tap
         is what explains it — so only the prerequisite lock is `disabled`. */
      const premium = item.state === "premium";
      const current = item.state === "current";
      const completed = item.state === "completed";
      const stars = Math.min(3, item.stars ?? 0);
      const tierLabel =
        item.tier === "premium" ? "Premium" : item.tier === "free" ? "Free" : null;
      const last = index === items.length - 1;

      return (
        <li key={item.id} className="relative">
          {/* The rail to the next node. Drawn from this node's foot to the next
              one's head, and indigo once the lesson it leaves is finished, so a
              unit shows how far along it is before a word is read. */}
          {!last && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-[27px] top-12 -bottom-2 z-10 w-0.5 rounded-full ${
                completed ? "bg-indigo-300 dark:bg-indigo-700" : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          )}

          <button
            type="button"
            disabled={locked}
            onClick={() => onSelect(item.id)}
            title={item.title}
            aria-label={`${item.title}${tierLabel ? ` (${tierLabel})` : ""}${locked ? ` (locked${item.note ? `: ${item.note}` : ""})` : premium ? " (subscription required)" : ""}`}
            className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${
              current
                ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800"
                : locked
                  ? "cursor-not-allowed"
                  : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
            }`}
          >
            <span
              className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 ${NODE[item.state]}`}
            >
              {locked || premium ? (
                <Lock className="h-4 w-4" />
              ) : item.icon ? (
                <span className="text-lg leading-none">{item.icon}</span>
              ) : completed ? (
                <Star className="h-4 w-4 fill-current text-indigo-600" />
              ) : (
                <Check className="h-4 w-4" />
              )}

              {/* A finished lesson always says so, whatever it scored: the fill
                  alone is the only other difference between "done" and "open",
                  and colour on its own is not a signal. */}
              {completed && (
                <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-indigo-600 text-white ring-2 ring-white dark:ring-slate-900">
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                </span>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-bold leading-snug line-clamp-2 ${TITLE[item.state]}`}>
                {item.title}
              </span>
              {current ? (
                <span className="mt-0.5 block font-mono text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  {startLabel}
                </span>
              ) : item.note ? (
                <span className="mt-0.5 block text-xs text-muted">{item.note}</span>
              ) : completed && stars > 0 ? (
                <span
                  aria-hidden="true"
                  className="mt-0.5 block text-xs leading-none tracking-wider text-indigo-500 dark:text-indigo-400"
                >
                  {"★".repeat(stars)}
                  <span className="text-slate-300 dark:text-slate-600">{"★".repeat(3 - stars)}</span>
                </span>
              ) : null}
            </span>

            {tierLabel && (
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${
                  item.tier === "premium"
                    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                }`}
              >
                {tierLabel}
              </span>
            )}

            {/* The row is the control; this is its mark, on the one lesson the
                learner is meant to press. */}
            {current && (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-white shadow-sm">
                <Play className="h-4 w-4 translate-x-px fill-current" />
              </span>
            )}
          </button>
        </li>
      );
    })}
  </ol>
);
