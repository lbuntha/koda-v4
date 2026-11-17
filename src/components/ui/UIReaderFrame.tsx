import React, { type RefObject } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIArtIcon } from "./UIArtIcon";
import { useT } from "../../lib/i18n";

export interface UIReaderFrameProps {
  toolbar: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
  contentRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  /** How far through the reader is, 0–1, drawn as a hairline under the toolbar. */
  progress?: number;
  /** Anything that belongs with the toolbar but is not the reader's own — an author's page controls in a preview. */
  controls?: React.ReactNode;
}

/**
 * A reader viewport with stable chrome. Only `children` scroll; the toolbar and
 * footer always remain available at the top and bottom of the screen.
 *
 * The line under the toolbar is the reader's progress rather than a divider: the
 * one rule on the screen may as well say something.
 */
export const UIReaderFrame: React.FC<UIReaderFrameProps> = ({ toolbar, footer, children, contentRef, className = "", progress, controls }) => (
  <div className={`ui-reader-frame mx-auto flex w-full max-w-3xl flex-col overflow-hidden ${className}`}>
    <header className="ui-reader-frame-toolbar relative shrink-0 bg-surface">
      {toolbar}
      {progress !== undefined && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-full bg-line/60">
          <span
            className="block h-full origin-left rounded-full bg-indigo-500 transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none"
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }}
          />
        </span>
      )}
    </header>
    {controls && <div className="ui-reader-frame-controls shrink-0 bg-surface pt-2">{controls}</div>}
    <div ref={contentRef} className="ui-reader-frame-content min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {children}
    </div>
    <footer className="ui-reader-frame-footer shrink-0 bg-surface">{footer}</footer>
  </div>
);

export interface UIQuizToolbarProps {
  onBack(): void;
  onReadAgain(): void;
  hintHostRef?: React.Ref<HTMLDivElement>;
}

/**
 * Shared quiz toolbar: the way back on the left, the helpers on the right.
 *
 * Read again and Hint are the same pill — an art icon from the kit and a word —
 * so the two ways of getting help look like a pair. The hint button is drawn by
 * the question (it knows how many hints are left) into `hintHostRef`, wearing
 * `themeSystem.quiz.tool` like this one.
 */
export const UIQuizToolbar: React.FC<UIQuizToolbarProps> = ({ onBack, onReadAgain, hintHostRef }) => {
  const { t } = useT();
  return (
  <div className="mobile-reader-toolbar">
    <div className="mobile-reader-toolbar-row flex items-center justify-between gap-2">
      <button type="button" onClick={onBack} aria-label={t("reader.back")} className={`-ml-1 ${themeSystem.quiz.back}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t("reader.back")}</span>
      </button>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onReadAgain} className={themeSystem.quiz.tool}>
          <UIArtIcon id="kit-read-again" className="h-7 w-7" />
          {t("reader.readAgain")}
        </button>
        <div ref={hintHostRef} className="flex items-center" />
      </div>
    </div>
  </div>
  );
};

export interface UIReaderPaginationProps {
  page: number;
  pageCount: number;
  storyPageCount: number;
  onPrevious(): void;
  onNext(): void;
  onComplete(): void;
  completeLabel?: string;
  /** A short line under the label, e.g. "3 questions about the story". */
  completeHint?: string;
  /** The picture on the button: a star for a quiz, a party for "I finished!". */
  completeArt?: "kit-star" | "kit-party";
}

/**
 * The page arrows: round, and plain enough not to compete with the page. "Next"
 * is filled, because going on is what a reader is there to do.
 */
const turnButton = "grid h-12 w-12 shrink-0 place-items-center rounded-full border transition-[background-color,transform,opacity] duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-0 motion-reduce:transition-none [&>svg]:h-5 [&>svg]:w-5";

/** Shared book pagination, including the reader's final full-width action. */
export const UIReaderPagination: React.FC<UIReaderPaginationProps> = ({
  page,
  pageCount,
  storyPageCount,
  onPrevious,
  onNext,
  onComplete,
  completeLabel,
  completeHint,
  completeArt = "kit-star",
}) => {
  const { t } = useT();
  const last = pageCount - 1;
  /*
   * The last page: an invitation, not a form button. A full-width bar read as
   * "submit"; this is one friendly pill in the middle — a picture, a short
   * title, how much is in it, and an arrow that nudges — so the next step
   * looks like something to play. It glows twice to catch the eye, then rests.
   * The back arrow stays, so a child can still look at the story again.
   */
  if (page === last) {
    const label = completeLabel ?? t("reader.quizTime");
    return (
      <nav aria-label={t("reader.pages")} className="ui-reader-pagination">
        <button type="button" onClick={onPrevious} disabled={page === 0} aria-label={t("reader.previousPage")} className={`${turnButton} border-line bg-surface text-ink hover:bg-surface-muted`}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onComplete}
          aria-label={label}
          className="ui-glow group flex min-h-14 min-w-0 flex-1 sm:max-w-sm items-center gap-3 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 py-2 pl-2 pr-5 text-left text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-sm">
            <UIArtIcon id={completeArt} className="h-7 w-7" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-base font-black">{label}</span>
            {completeHint && <span className="block truncate text-xs font-semibold text-white/80">{completeHint}</span>}
          </span>
          <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1 motion-safe:animate-[ui-nudge_1.6s_ease-in-out_2]" />
        </button>
        {/* Keeps the pill centred: the same width as the back arrow. */}
        <span className="hidden h-12 w-12 shrink-0 sm:block" aria-hidden="true" />
      </nav>
    );
  }

  return (
    <nav aria-label={t("reader.pages")} className="ui-reader-pagination">
      <button type="button" onClick={onPrevious} disabled={page === 0} aria-label={t("reader.previousPage")} className={`${turnButton} border-line bg-surface text-ink hover:bg-surface-muted`}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <div className="flex min-w-0 flex-col items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] tabular-nums text-muted" aria-live="polite">
          {page === 0 ? t("reader.cover") : t("reader.pageOf", { page, total: storyPageCount })}
        </span>
        {/* One dot a page reads well up to a dozen; past that the row outgrows a phone. */}
        {pageCount <= 14 && (
          <span className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: pageCount }, (_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none ${i === page ? "w-5 bg-indigo-500" : i < page ? "w-1.5 bg-neutral-400 dark:bg-neutral-500" : "w-1.5 bg-neutral-200 dark:bg-neutral-700"}`} />
            ))}
          </span>
        )}
      </div>
      <button type="button" onClick={onNext} aria-label={t("reader.nextPage")} className={`${turnButton} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-500`}>
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
};
