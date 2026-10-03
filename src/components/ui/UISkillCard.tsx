import React from "react";
import { Check, ChevronRight, Play } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton } from "./ThemeUI";
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
 * The banner's colour for each subject: the poster tile's gradient a step
 * deeper, so white words on it stay readable. No amber or lime — yellow tones
 * are hard to read in this app, so those subjects borrow a neighbour's colour.
 */
const HERO_TONE: Record<string, string> = {
  "number-sense": "from-indigo-600 to-violet-800",
  operations: "from-emerald-600 to-teal-800",
  "place-value": "from-sky-600 to-indigo-800",
  patterns: "from-sky-600 to-cyan-800",
  fractions: "from-rose-600 to-pink-800",
  measurement: "from-emerald-600 to-green-800",
  geometry: "from-fuchsia-600 to-purple-800",
};
const heroTone = (category?: string) => HERO_TONE[category ?? ""] ?? "from-indigo-500 to-indigo-800";

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
    /* `md` was a 4px hairline beside a count it now shares a line with. A bar
       nobody can see is decoration, not progress. */
    className={`${size === "lg" ? "h-2" : "h-1.5"} flex-1 overflow-hidden rounded-full bg-surface-muted`}
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
            <Progress percent={percent} size="sm" />
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
   * A banner, drawn the way the Library and Trace draw theirs: the subject's
   * colour on the left with the words in white, the artwork filling the right
   * and fading into the colour — a poster rather than a picture in a box. On a
   * phone the artwork is a band across the top, fading downwards.
   */
  if (size === "lg") {
    return (
      <section
        className={`relative grid overflow-hidden rounded-3xl bg-gradient-to-br text-white md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] ${heroTone(category)} ${className}`}
        aria-label={title}
      >
        {hasArtwork ? (
          <span
            aria-hidden="true"
            className="relative order-first block aspect-[16/9] [mask-image:linear-gradient(to_bottom,black_60%,transparent)] md:order-last md:aspect-auto md:min-h-64 md:[mask-image:linear-gradient(to_right,transparent,black_35%)]"
          >
            <UISkillThumbnail thumbnail={thumbnail} fallbackIconName={fallbackIconName} category={category} size="lg" fill cover />
          </span>
        ) : (
          /* A glyph floats whole on the colour; stretched across half a banner it is one symbol saying very little. */
          <span aria-hidden="true" className="order-first flex h-32 items-center justify-center md:order-last md:h-auto md:min-h-64">
            <span className="block h-24 w-24 overflow-hidden rounded-3xl shadow-lg ring-4 ring-white/25 md:h-32 md:w-32">
              <UISkillThumbnail thumbnail={thumbnail} fallbackIconName={fallbackIconName} category={category} size="lg" fill />
            </span>
          </span>
        )}
        <div className="relative z-10 flex min-w-0 flex-col gap-3 p-5 pt-1 md:p-8">
          {eyebrow && <span className="text-xs font-extrabold uppercase tracking-widest text-white/80">{eyebrow}</span>}
          {(subjectName || badges) && (
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white/85">
              {subjectName && <span>{subjectName}</span>}
              {badges}
            </div>
          )}
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">{title}</h2>
          {tagline && <p className="line-clamp-2 max-w-lg text-sm text-white/85 sm:text-base">{tagline}</p>}
          {meta && <p className="font-mono text-xs font-bold text-white/75">{meta}</p>}
          <div className="flex max-w-sm flex-col gap-1.5">
            <span
              className="block h-2 overflow-hidden rounded-full bg-white/25"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("skillCard.progress", { title })}
            >
              <span className="block h-full rounded-full bg-white transition-all" style={{ width: `${percent}%` }} />
            </span>
            <span className="text-sm font-semibold tabular-nums text-white/85">
              {completedLessons
                ? t("skillCard.lessonsComplete", { done: completedLessons, total: lessonCount })
                : t("skillCard.readyToBegin")}
            </span>
            {footnote && <span className="text-xs text-white/75">{footnote}</span>}
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={act}
              disabled={registering}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 text-base font-extrabold text-ink shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 disabled:opacity-60"
            >
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              {registering ? t("skillCard.adding") : label}
            </button>
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
        {completedLessons > 0 && <Progress percent={percent} size="md" label={t("skillCard.progress", { title })} />}

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
            <button
              type="button"
              onClick={act}
              aria-label={`${label} ${title}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-xl text-indigo-600 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-indigo-950 dark:text-indigo-300"
            >
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <UIButton type="button" size="sm" className="shrink-0 rounded-full" onClick={act} isLoading={registering} aria-label={`${label} ${title}`}>
              {label}
            </UIButton>
          )}
        </div>
      </div>
    </article>
  );
};
