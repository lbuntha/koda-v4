import React from "react";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge } from "./ThemeUI";
import { UISkillThumbnail, skillArtFor } from "./UISkillThumbnail";

export interface UISkillCardProps {
  title: string;
  tagline: string;
  thumbnail?: string;
  fallbackIconName?: string;
  category: string;
  ages?: [number, number];
  lessonCount: number;
  completedLessons?: number;
  progressPercent?: number;
  status?: "draft" | "published";
  registered?: boolean;
  registering?: boolean;
  onOpen(): void;
  onRegister?(): void;
}

/**
 * Shared learner catalog card.
 *
 * Artwork owns the full card width at the 16:9 a store listing is drawn to, so
 * conforming art fills the window exactly with nothing trimmed. Art drawn to
 * another shape is cropped from the centre rather than letterboxed — a card
 * whose picture floats in a band of background reads as broken, and the middle
 * of a canvas is where its title sits.
 */
export const UISkillCard: React.FC<UISkillCardProps> = ({
  title,
  tagline,
  thumbnail,
  fallbackIconName,
  category,
  ages,
  lessonCount,
  completedLessons = 0,
  progressPercent = 0,
  status = "published",
  registered = true,
  registering = false,
  onOpen,
  onRegister,
}) => {
  const complete = progressPercent === 100;
  const categoryLabel = skillArtFor(category).label;

  return (
    <article className={`${themeSystem.card("interactive")} group h-full overflow-hidden flex flex-col`}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${title}`}
        className="relative block w-full aspect-[16/9] bg-slate-50 dark:bg-slate-950/40 border-b-2 border-slate-100 dark:border-slate-800 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
      >
        <UISkillThumbnail
          thumbnail={thumbnail}
          fallbackIconName={fallbackIconName}
          category={category}
          size="lg"
          fill
          cover
          className="transition-transform duration-200 group-hover:scale-[1.03]"
        />
        {status === "draft" && (
          <UIBadge variant="warning" className="absolute top-3 right-3">
            Draft
          </UIBadge>
        )}
      </button>

      <div className="p-3 flex flex-col flex-1 gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="text-left min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
        >
          <h3 className="font-mono font-black text-sm text-ink leading-tight truncate">{title}</h3>
          <p className="mt-1 text-[11px] leading-snug text-muted line-clamp-2">{tagline}</p>
        </button>

        {/* The lesson count only where the progress row is not already giving
            it — at poster width a third clause just truncates the ages away. */}
        <p className="text-[10px] font-mono font-bold text-muted truncate">
          {categoryLabel}
          {ages ? ` · ages ${ages[0]}–${ages[1]}` : ""}
          {completedLessons > 0 ? "" : ` · ${lessonCount} lessons`}
        </p>

        {completedLessons > 0 && (
          <div aria-label={`${progressPercent}% complete`}>
            <div className="flex justify-between text-[10px] font-mono font-bold text-muted mb-1">
              <span>{complete ? "Completed" : `${completedLessons} of ${lessonCount}`}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1 rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Full width and last: at poster width there is no room beside a title,
            and the action is what a learner is reaching for. */}
        <button
          type="button"
          onClick={registered ? onOpen : onRegister}
          disabled={registering}
          aria-label={`${registered ? complete ? "Review" : completedLessons > 0 ? "Continue" : "Open" : "Register"} ${title}`}
          className="mt-auto w-full rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 px-3 py-1.5 text-[11px] font-mono font-black uppercase tracking-wide text-indigo-600 dark:text-indigo-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
        >
          {registering
            ? "Adding…"
            : !registered
              ? "Add"
              : complete
                ? "Review"
                : completedLessons > 0
                  ? "Continue"
                  : "Open"}
        </button>
      </div>
    </article>
  );
};
