import React, { type RefObject } from "react";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { UIButton } from "./ThemeUI";

export interface UIReaderFrameProps {
  toolbar: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
  contentRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}

/**
 * A reader viewport with stable chrome. Only `children` scroll; the toolbar and
 * footer always remain available at the top and bottom of the screen.
 */
export const UIReaderFrame: React.FC<UIReaderFrameProps> = ({ toolbar, footer, children, contentRef, className = "" }) => (
  <div className={`ui-reader-frame mx-auto flex w-full max-w-3xl flex-col overflow-hidden ${className}`}>
    <header className="ui-reader-frame-toolbar shrink-0 bg-surface">{toolbar}</header>
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
export const UIQuizToolbar: React.FC<UIQuizToolbarProps> = ({ onBack, onReadAgain, hintHostRef }) => (
  <div className="mobile-reader-toolbar">
    <div className="mobile-reader-toolbar-row flex items-center justify-between gap-2">
      <UIButton type="button" variant="secondary" size="md" icon={<ArrowLeft aria-hidden="true" />} onClick={onBack}>
        Back
      </UIButton>
      <div className="flex items-center gap-2">
        <UIButton type="button" variant="secondary" size="md" icon={<BookOpen aria-hidden="true" />} onClick={onReadAgain}>
          Read again
        </UIButton>
        <div ref={hintHostRef} className="flex items-center" />
      </div>
    </div>
  </div>
);

export interface UIReaderPaginationProps {
  page: number;
  pageCount: number;
  storyPageCount: number;
  onPrevious(): void;
  onNext(): void;
  onComplete(): void;
  completeLabel?: string;
}

/** Shared book pagination, including the reader's final full-width action. */
export const UIReaderPagination: React.FC<UIReaderPaginationProps> = ({
  page,
  pageCount,
  storyPageCount,
  onPrevious,
  onNext,
  onComplete,
  completeLabel = "Check My Learning",
}) => {
  const last = pageCount - 1;
  if (page === last) {
    return (
      <nav aria-label="Pages" className="ui-reader-pagination ui-reader-pagination-final">
        <UIButton type="button" variant="primary" size="md" onClick={onComplete} className="!min-h-12 w-full shadow-[0_6px_18px_rgba(79,70,229,0.22)] active:shadow-[0_3px_10px_rgba(79,70,229,0.18)]">
          {completeLabel}
        </UIButton>
      </nav>
    );
  }

  return (
    <nav aria-label="Pages" className="ui-reader-pagination">
      <UIButton type="button" variant="secondary" size="icon" onClick={onPrevious} disabled={page === 0} aria-label="Previous page">
        <ChevronLeft aria-hidden="true" />
      </UIButton>
      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <span className="text-sm font-bold tabular-nums text-muted" aria-live="polite">
          {page === 0 ? "Cover" : `Page ${page} of ${storyPageCount}`}
        </span>
        <span className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: pageCount }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === page ? "w-5 bg-neutral-800 dark:bg-neutral-200" : "w-1.5 bg-neutral-300 dark:bg-neutral-700"}`} />
          ))}
        </span>
      </div>
      <UIButton type="button" variant="secondary" size="icon" onClick={onNext} aria-label="Next page">
        <ChevronRight aria-hidden="true" />
      </UIButton>
    </nav>
  );
};
