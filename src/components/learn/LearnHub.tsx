/**
 * Learn — one destination for everything a learner does.
 *
 * Think (lessons), Read (books) and Write (trace) used to be three tabs of their own, which on
 * a phone was three of the five slots in the bar and, for a six-year-old, three
 * different places to remember. They are one place now, with the kind of thing
 * to do picked at the top. The studios that make the content are untouched:
 * they are where adults go deliberately, and stay their own pages.
 *
 * Speed is the design constraint, not an afterthought:
 *
 * - Only the chosen category is mounted. A shelf that is not on screen is not
 *   subscribing, rendering or holding pictures in memory.
 * - Books and Write & Draw are their own chunks, fetched while the browser is
 *   idle after Learn first opens, and again on hover or touch of a segment —
 *   so by the time a finger lands the code is already here.
 * - A switch is a transition: the shelf on screen stays until the next one can
 *   draw, so there is never a spinner between two pages that are both local.
 *   That needs the one Suspense boundary below, mounted across switches — React
 *   shows a *new* boundary's fallback even inside a transition, so a boundary
 *   per category flashed a loader on every first visit.
 */

import React, { Suspense, lazy, useEffect, useState } from "react";
import { useT } from "../../lib/i18n";
import { playSound } from "../../utils/audio";
import { BookOpen, Lightbulb, PenLine, type LucideIcon } from "lucide-react";
import { UIPageHeader, UIPageLoader } from "../ui";

export type LearnCategory = "lessons" | "books" | "trace";

// One-colour line icons, like every other tab bar in the app: the colour says
// which tab is open, and the pictures stay quiet.
export const LEARN_CATEGORIES: readonly { id: LearnCategory; icon: LucideIcon }[] = [
  { id: "lessons", icon: Lightbulb },
  { id: "books", icon: BookOpen },
  { id: "trace", icon: PenLine },
];

/*
 * One loader per chunk, shared by `lazy` and the prefetch, so both resolve to
 * the same module request rather than the prefetch warming a copy nobody uses.
 */
const loadLibrary = () => import("../../library/LibraryPage");
const loadTrace = () => import("../../trace/TracePage");

export const LibraryPage = lazy(() => loadLibrary().then((m) => ({ default: m.LibraryPage })));
export const TracePage = lazy(() => loadTrace().then((m) => ({ default: m.TracePage })));

const PRELOAD: Record<LearnCategory, (() => Promise<unknown>) | null> = {
  lessons: null,
  books: loadLibrary,
  trace: loadTrace,
};

/** Fetch a category's code ahead of the tap. Failures are ignored: the tap retries. */
export const preloadCategory = (id: LearnCategory): void => {
  void PRELOAD[id]?.().catch(() => undefined);
};

const STORAGE_KEY = "koda.learnCategory";

const isCategory = (value: unknown): value is LearnCategory =>
  value === "lessons" || value === "books" || value === "trace";

/** The category Learn opens on: the one this device last used, else Lessons. */
export const useLearnCategory = (): [LearnCategory, (next: LearnCategory) => void] => {
  const [category, setCategory] = useState<LearnCategory>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return isCategory(saved) ? saved : "lessons";
    } catch {
      return "lessons";
    }
  });
  const choose = (next: LearnCategory) => {
    setCategory(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Remembered for this visit only. */
    }
  };
  return [category, choose];
};

/** Warm the other categories once the page has settled. */
const usePreloadWhenIdle = () => {
  useEffect(() => {
    const run = () => {
      preloadCategory("books");
      preloadCategory("trace");
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 1200);
    return () => window.clearTimeout(id);
  }, []);
};

export interface LearnSwitcherProps {
  value: LearnCategory;
  onChange(next: LearnCategory): void;
}

/**
 * Three equal segments, picture over word.
 *
 * Equal widths so the control does not shift when the language changes, and
 * the drawn menu artwork so a child who cannot read yet still finds the books.
 */
export const LearnSwitcher: React.FC<LearnSwitcherProps> = ({ value, onChange }) => {
  const { t } = useT();

  const select = (id: LearnCategory) => {
    if (id === value) return;
    playSound("pop");
    onChange(id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const at = LEARN_CATEGORIES.findIndex((c) => c.id === value);
    const next = (at + step + LEARN_CATEGORIES.length) % LEARN_CATEGORIES.length;
    select(LEARN_CATEGORIES[next].id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t("learnHub.categories")}
      onKeyDown={onKeyDown}
      className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1"
    >
      {LEARN_CATEGORIES.map(({ id, icon: Icon }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(id)}
            onPointerEnter={() => preloadCategory(id)}
            onFocus={() => preloadCategory(id)}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              selected
                ? "bg-surface text-indigo-700 shadow-sm dark:text-indigo-300"
                : "text-muted hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="max-w-full truncate">{t(`learnHub.${id}`)}</span>
          </button>
        );
      })}
    </div>
  );
};

export interface LearnHubProps extends LearnSwitcherProps {
  /** Inside a book, a trace item or a skill: the page is the activity, so no switcher. */
  immersed: boolean;
  /** Dimmed while the next category is still arriving. */
  pending?: boolean;
  children: React.ReactNode;
}

export const LearnHub: React.FC<LearnHubProps> = ({ value, onChange, immersed, pending = false, children }) => {
  const { t } = useT();
  usePreloadWhenIdle();

  /*
   * One tree whether or not the child is inside an activity. Returning the
   * panel on its own when immersed moved it to a different place in the tree,
   * so React rebuilt the page underneath: opening a book or a trace item reset
   * it straight back to its shelf. The header and switcher are left out
   * instead, and the panel keeps its place.
   */
  return (
    <div className={immersed ? undefined : "flex flex-col gap-5"}>
      {/* On a phone the app bar already says "Learn", so this collapses away. */}
      {/* Title only: the switcher right under it already says "think, read and
          write", and the line that repeated it pushed the shelf down a row. */}
      {!immersed && <UIPageHeader title={t("nav.game")} />}
      {!immersed && <LearnSwitcher value={value} onChange={onChange} />}
      <div role="tabpanel" aria-busy={pending} className={pending ? "opacity-60 transition-opacity" : undefined}>
        <Suspense fallback={<UIPageLoader label={t("learnHub.loading")} />}>{children}</Suspense>
      </div>
    </div>
  );
};
