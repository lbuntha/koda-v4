import React from "react";
import { ArrowRight, Check, ChevronRight, Play } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton } from "./ThemeUI";
import { UIProgressBar } from "./UIProgressBar";
import { UISkillThumbnail, skillArtFor, useHasSkillArtwork } from "./UISkillThumbnail";
import { useT } from "../../lib/i18n";

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
  subjectName?: string;
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
  subjectName,
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
  const hasArtwork = useHasSkillArtwork(thumbnail);
  const { t } = useT();
  const percent =
    progressPercent ?? (lessonCount ? Math.round((completedLessons / lessonCount) * 100) : 0);
  const complete = percent === 100;
  const categoryLabel = subjectName ?? skillArtFor(category).label;
  const label =
    actionLabel ??
    t(!registered ? "skillCard.add" : complete ? "skillCard.review" : completedLessons > 0 ? "skillCard.continue" : "skillCard.open");
  const act = registered ? onOpen : onRegister;

  /*
   * A row. The whole card is the control, because at this height there is no
   * room for an action beside the name and nothing else on the row is a target.
   */
  if (size === "sm") {
    return (
      <button
        type="button"
        /* `act`, not `onOpen`: in a catalogue this row may be a skill the
           learner has not added yet, and pressing it there means "add it" — the
           same thing pressing the poster means. */
        onClick={act}
        aria-label={`${label} ${title}`}
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
                {t("skillCard.ready", { count: readyCount })}
              </span>
            )}
          </div>

          {/* Only where one is passed: Home's subject rows are a list of things
              the learner already has, and a tagline there is a sentence they
              have read every day. A catalogue row is a skill they are deciding
              about, so it needs the line. */}
          {subjectName && <p className="mt-1 text-xs text-muted">{subjectName}</p>}
          {tagline && (
            <p className="mt-0.5 truncate text-[13px] leading-snug text-muted">{tagline}</p>
          )}

          <div className="mt-1.5 flex items-center gap-2">
            <UIProgressBar value={percent} max={100} size="sm" className="flex-1" />
            <span className="shrink-0 text-[11px] font-bold text-muted tabular-nums">
              {completedLessons}/{lessonCount}
            </span>
          </div>
        </div>

        {registered ? (
          <ChevronRight className="w-4 h-4 shrink-0 text-muted" />
        ) : (
          <span className="shrink-0 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-black text-white">
            {registering ? t("skillCard.adding") : label}
          </span>
        )}
      </button>
    );
  }

  /*
   * A banner: a violet gradient across the whole card with the words in white
   * and the artwork filling the right half, fading into the colour —
   * the same calm colour for every subject, so the banner reads as Koda rather
   * than as whichever skill happens to be in it.
   */
  if (size === "lg") {
    return (
      <section
        className={`relative isolate grid overflow-hidden rounded-3xl ${themeSystem.heroGradient} text-white md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${className}`}
        aria-label={title}
      >
        {/* The artwork runs to the card's edges and fades into the violet, as the
            Library's "pick up where you left off" card does; on a phone it is a
            band across the top fading downwards. */}
        {hasArtwork ? (
          <span aria-hidden="true" className="relative order-first block aspect-[16/9] [mask-image:linear-gradient(to_bottom,black_60%,transparent)] md:order-last md:aspect-auto md:min-h-64 md:[mask-image:linear-gradient(to_right,transparent,black_35%)]">
            <UISkillThumbnail thumbnail={thumbnail} fallbackIconName={fallbackIconName} category={category} size="lg" fill cover />
          </span>
        ) : (
          /* A glyph floats whole on the colour; stretched across half a banner it is one symbol saying very little. */
          <span aria-hidden="true" className="order-first flex h-32 items-center justify-center pt-5 md:order-last md:h-auto md:min-h-64 md:pt-0">
            <span className="block h-24 w-24 overflow-hidden rounded-3xl shadow-lg ring-4 ring-white/50 md:h-32 md:w-32">
              <UISkillThumbnail thumbnail={thumbnail} fallbackIconName={fallbackIconName} category={category} size="lg" fill />
            </span>
          </span>
        )}
        <div className="relative z-10 flex min-w-0 flex-col justify-center gap-3 p-5 pt-1 sm:p-6 sm:pt-1 md:p-8">
          {eyebrow && <span className="text-xs font-extrabold uppercase tracking-widest text-white/90">{eyebrow}</span>}
          {(subjectName || badges) && (
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {subjectName && <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold text-white">{subjectName}</span>}
              {badges}
            </div>
          )}
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">{title}</h2>
          {tagline && <p className="line-clamp-2 max-w-lg text-base font-medium text-white sm:text-lg">{tagline}</p>}
          {meta && <p className="font-mono text-xs font-bold text-white/90">{meta}</p>}
          <div className="flex max-w-sm flex-col gap-1.5">
            <UIProgressBar
              onColor
              size="lg"
              value={percent}
              max={100}
              label={t("skillCard.progress", { title })}
              caption={
                completedLessons
                  ? t("skillCard.lessonsComplete", { done: completedLessons, total: lessonCount })
                  : t("skillCard.readyToBegin")
              }
            />
            {footnote && <span className="text-xs text-white/90">{footnote}</span>}
          </div>
          <div className="mt-1">
            {/* White on the violet, medium, and the full width of a phone — as the Library's and Trace's banners. */}
            <UIButton
              variant="light"
              className="w-full sm:w-auto"
              icon={<Play className="fill-current" aria-hidden="true" />}
              onClick={act}
              disabled={registering}
            >
              {registering ? t("skillCard.adding") : label}
            </UIButton>
          </div>
        </div>
      </section>
    );
  }

  /*
   * A poster in a grid, as the Library shows a book and Trace a collection: the
   * artwork edge to edge with small labels on it, then the name, how far the
   * learner is, and one round way in.
   */
  return (
    <article
      className={`group grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-2xl border-2 border-line bg-surface text-left transition hover:border-indigo-300 ${className}`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("subjectCard.open", { subject: title })}
        /* Drawn artwork earns 16:9. A fallback glyph on a gradient does not —
           full-bleed on a phone that is a third of the screen carrying one
           symbol, which is what every skill looks like before it has art. */
        className={`relative block w-full overflow-hidden ${
          hasArtwork ? "aspect-[16/9]" : "aspect-[3/1]"
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500`}
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
        {/* Bottom, not top: a skill's drawn artwork carries its own name in the top corner. */}
        <span className="absolute bottom-3 left-3 max-w-[70%] truncate rounded-full bg-white/95 px-3 py-1 text-[11px] font-black text-slate-900">
          {categoryLabel}
        </span>
        {status === "draft" ? (
          <UIBadge variant="warning" className="absolute right-3 top-3">
            {t("skillCard.draft")}
          </UIBadge>
        ) : (
          complete && (
            <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
              <Check className="h-4 w-4" aria-hidden="true" />
            </span>
          )
        )}
      </button>

      <div className="flex flex-col gap-2 p-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {/*
            * Sized for a phone, where this poster is the full width of the
            * screen and its tagline is the only sentence describing the skill.
            */}
          <h3 className="line-clamp-2 text-lg font-extrabold leading-tight text-ink">{title}</h3>
          {tagline && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{tagline}</p>}
        </button>

        {/* The bar only once there is progress; before that, a full bar of nothing is noise. */}
        {completedLessons > 0 && <UIProgressBar value={percent} max={100} size="sm" label={t("skillCard.progress", { title })} />}

        <div className="mt-auto flex min-h-10 items-center justify-between gap-3">
          {/* The lesson count only until progress gives it — at poster width a third clause truncates the ages away. */}
          <span
            className={`min-w-0 truncate text-sm font-semibold tabular-nums ${complete ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}`}
          >
            {completedLessons > 0
              ? complete
                ? t("skillCard.done")
                : t("skillCard.xOfY", { done: completedLessons, total: lessonCount })
              : `${t("skillCard.lessons", { count: lessonCount })}${ages ? ` · ${t("skillCard.ages", { from: ages[0], to: ages[1] })}` : ""}`}
          </span>
          {registered ? (
            <UIButton
              type="button"
              variant="light"
              size="icon"
              className="shrink-0"
              icon={<ArrowRight aria-hidden="true" />}
              onClick={act}
              aria-label={`${label} ${title}`}
            />
          ) : (
            <UIButton
              type="button"
              variant="light"
              /* The arrow's height: the icon size is 42px (44px under a finger), so
                 a card reads the same whether its skill is added or not. */
              className="h-[42px] shrink-0 !py-0 pointer-coarse:h-11"
              onClick={act} isLoading={registering} aria-label={`${label} ${title}`}>
              {label}
            </UIButton>
          )}
        </div>
      </div>
    </article>
  );
};
