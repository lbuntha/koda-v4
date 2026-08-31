import React from "react";
import { ChevronRight, Play } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton } from "./ThemeUI";
import { UISkillThumbnail, skillArtFor } from "./UISkillThumbnail";

/**
 * How much room a skill is given.
 *
 *   sm  a row in a list of subjects — art, name, progress, chevron
 *   md  a poster in a grid — 16:9 art above name, tagline, progress, action
 *   lg  a banner introducing one skill — art beside everything, big action
 *
 * The same three words the button scale uses, and for the same reason: a skill
 * appears on four surfaces in this app and each one had built its own. Home had
 * a row, the catalog had a poster *and* a hand-built "Continue learning"
 * banner, and the skill page had a second hand-built banner — four layouts,
 * four progress bars at four different heights, four type scales, and any fix
 * to one of them silently not applied to the other three.
 */
export type SkillCardSize = "sm" | "md" | "lg";

export interface UISkillCardProps {
  size?: SkillCardSize;
  title: string;
  tagline?: string;
  thumbnail?: string;
  fallbackIconName?: string;
  category: string;
  ages?: [number, number];
  lessonCount: number;
  completedLessons?: number;
  /** Derived from the lesson counts when omitted. */
  progressPercent?: number;
  status?: "draft" | "published";
  registered?: boolean;
  registering?: boolean;
  /** `lg`: the small line above the title, e.g. "Continue learning". */
  eyebrow?: string;
  /** `lg`: extra badges beside the category — an age band, a draft marker. */
  badges?: React.ReactNode;
  /** `lg`: a mono line under the tagline — author, version, counts. */
  meta?: React.ReactNode;
  /** `lg`: a line under the progress bar, e.g. "Up next: Dice Dots". */
  footnote?: React.ReactNode;
  /** `sm`: how many lessons are open to this learner right now. */
  readyCount?: number;
  /** Overrides the label the card would pick from its own progress. */
  actionLabel?: string;
  onOpen(): void;
  onRegister?(): void;
  className?: string;
}

/**
 * One progress bar, at the weight its card size calls for.
 *
 * `label` both names the bar and decides whether it is a bar at all to a
 * screen reader. The `sm` row wraps its whole self in a `<button>`, and a
 * `progressbar` nested inside a control is read inconsistently — some readers
 * fold it into the button's name, some announce a second widget. That row
 * already carries "3 of 15" as text inside the button's accessible name, so
 * there it stays decorative and the number does the work.
 */
const Progress: React.FC<{ percent: number; size: SkillCardSize; label?: string }> = ({
  percent,
  size,
  label,
}) => (
  <div
    className={`${size === "sm" ? "h-1.5" : size === "md" ? "h-1" : "h-2"} flex-1 overflow-hidden rounded-full bg-surface-muted`}
    {...(label
      ? { role: "progressbar", "aria-valuenow": percent, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": label }
      : { "aria-hidden": true })}
  >
    <div
      className="h-full rounded-full bg-indigo-600 transition-all"
      style={{ width: `${percent}%` }}
    />
  </div>
);

/**
 * Shared skill card — the one place a skill is drawn.
 *
 * Artwork owns the full card width at the 16:9 a store listing is drawn to, so
 * conforming art fills the window exactly with nothing trimmed. Art drawn to
 * another shape is cropped from the centre rather than letterboxed — a card
 * whose picture floats in a band of background reads as broken, and the middle
 * of a canvas is where its title sits.
 */
export const UISkillCard: React.FC<UISkillCardProps> = ({
  size = "md",
  title,
  tagline,
  thumbnail,
  fallbackIconName,
  category,
  ages,
  lessonCount,
  completedLessons = 0,
  progressPercent,
  status = "published",
  registered = true,
  registering = false,
  eyebrow,
  badges,
  meta,
  footnote,
  readyCount = 0,
  actionLabel,
  onOpen,
  onRegister,
  className = "",
}) => {
  const percent =
    progressPercent ?? (lessonCount ? Math.round((completedLessons / lessonCount) * 100) : 0);
  const complete = percent === 100;
  const categoryLabel = skillArtFor(category).label;
  const label =
    actionLabel ??
    (!registered ? "Add" : complete ? "Review" : completedLessons > 0 ? "Continue" : "Open");
  const act = registered ? onOpen : onRegister;

  /*
   * A row. The whole card is the control, because at this height there is no
   * room for an action beside the name and nothing else on the row is a target.
   */
  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`${themeSystem.card("interactive")} flex w-full items-center gap-3 p-3 text-left ${className}`}
      >
        <UISkillThumbnail
          thumbnail={thumbnail}
          fallbackIconName={fallbackIconName}
          category={category}
          size="sm"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-black text-ink">{title}</h3>
            {readyCount > 0 && (
              <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {readyCount} ready
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <Progress percent={percent} size="sm" />
            <span className="shrink-0 font-mono text-[11px] font-bold text-muted">
              {completedLessons}/{lessonCount}
            </span>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 shrink-0 text-muted" />
      </button>
    );
  }

  /*
   * A banner. One skill, introduced — so the artwork sits beside the words
   * rather than over them, and the action is the page's `lg` button.
   */
  if (size === "lg") {
    return (
      <section className={`${themeSystem.card("default")} overflow-hidden ${className}`}>
        <div className="p-5 sm:p-7 flex flex-col md:flex-row md:items-center gap-5">
          <UISkillThumbnail
            thumbnail={thumbnail}
            fallbackIconName={fallbackIconName}
            category={category}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-xs font-mono font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                {eyebrow}
              </p>
            )}
            {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
            <h2
              className={`${eyebrow || badges ? "mt-2" : ""} text-2xl sm:text-3xl font-black tracking-tight text-ink`}
            >
              {title}
            </h2>
            {tagline && <p className="mt-2 text-base text-muted max-w-2xl">{tagline}</p>}
            {meta && <p className="mt-2 text-xs font-mono font-bold text-muted">{meta}</p>}

            <div className="mt-5 max-w-xl">
              <div className="flex justify-between text-xs font-mono font-bold text-muted mb-1.5">
                <span>
                  {completedLessons
                    ? `${completedLessons} of ${lessonCount} lessons complete`
                    : "Ready to begin"}
                </span>
                <span>{percent}%</span>
              </div>
              <div className="flex">
                <Progress percent={percent} size="lg" label={`${title} progress`} />
              </div>
              {footnote && <p className="mt-2 text-xs text-muted">{footnote}</p>}
            </div>
          </div>
          <UIButton
            size="lg"
            className="w-full md:w-auto"
            icon={<Play />}
            isLoading={registering}
            onClick={act}
          >
            {label}
          </UIButton>
        </div>
      </section>
    );
  }

  /* A poster in a grid. */
  return (
    <article
      className={`${themeSystem.card("interactive")} group h-full overflow-hidden flex flex-col ${className}`}
    >
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
          {tagline && (
            <p className="mt-1 text-[11px] leading-snug text-muted line-clamp-2">{tagline}</p>
          )}
        </button>

        {/* The lesson count only where the progress row is not already giving
            it — at poster width a third clause just truncates the ages away. */}
        <p className="text-[10px] font-mono font-bold text-muted truncate">
          {categoryLabel}
          {ages ? ` · ages ${ages[0]}–${ages[1]}` : ""}
          {completedLessons > 0 ? "" : ` · ${lessonCount} lessons`}
        </p>

        {completedLessons > 0 && (
          <div>
            <div className="flex justify-between text-[10px] font-mono font-bold text-muted mb-1">
              <span>{complete ? "Completed" : `${completedLessons} of ${lessonCount}`}</span>
              <span>{percent}%</span>
            </div>
            <div className="flex">
              <Progress percent={percent} size="md" label={`${title} progress`} />
            </div>
          </div>
        )}

        {/*
          * Full width and last: at poster width there is no room beside a
          * title, and the action is what a learner is reaching for. `outline`
          * keeps it quiet enough to repeat twelve times down a grid without the
          * page turning into a wall of indigo.
          */}
        <UIButton
          type="button"
          variant="outline"
          size="sm"
          fullWidth
          className="mt-auto"
          onClick={act}
          isLoading={registering}
          aria-label={`${label} ${title}`}
        >
          {label}
        </UIButton>
      </div>
    </article>
  );
};
