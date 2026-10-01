import React, { type RefObject } from "react";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { UIButton } from "./ThemeUI";
import { useT } from "../../lib/i18n";

export interface UIReaderFrameProps {
  toolbar: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
  contentRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  /** How far through the reader is, 0–1, drawn as a hairline under the toolbar. */
  progress?: number;
}

/**
 * A reader viewport with stable chrome. Only `children` scroll; the toolbar and
 * footer always remain available at the top and bottom of the screen.
 *
 * The line under the toolbar is the reader's progress rather than a divider: the
 * one rule on the screen may as well say something.
 */
export const UIReaderFrame: React.FC<UIReaderFrameProps> = ({ toolbar, footer, children, contentRef, className = "", progress }) => (
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

/** Shared quiz toolbar: navigation and support actions stay in one stable row. */
export const UIQuizToolbar: React.FC<UIQuizToolbarProps> = ({ onBack, onReadAgain, hintHostRef }) => {
  const { t } = useT();
  return (
  <div className="mobile-reader-toolbar">
    <div className="mobile-reader-toolbar-row flex items-center justify-between gap-2">
      <UIButton type="button" variant="secondary" size="md" icon={<ArrowLeft aria-hidden="true" />} onClick={onBack}>
        {t("reader.back")}
      </UIButton>
      <div className="flex items-center gap-2">
        <UIButton type="button" variant="secondary" size="md" icon={<BookOpen aria-hidden="true" />} onClick={onReadAgain}>
          {t("reader.readAgain")}
        </UIButton>
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
}) => {
  const { t } = useT();
  const last = pageCount - 1;
  if (page === last) {
    return (
      <nav aria-label={t("reader.pages")} className="ui-reader-pagination ui-reader-pagination-final">
        <UIButton type="button" variant="primary" size="md" onClick={onComplete} className="!min-h-12 w-full shadow-[0_6px_18px_rgba(79,70,229,0.22)] active:shadow-[0_3px_10px_rgba(79,70,229,0.18)]">
          {completeLabel ?? t("reader.checkLearning")}
        </UIButton>
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
