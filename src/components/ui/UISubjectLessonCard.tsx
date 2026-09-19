import React from "react";
import { ChevronRight, Play } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UISkillThumbnail } from "./UISkillThumbnail";

export interface UISubjectLessonCardProps {
  /** The skill's name — the group's heading. */
  subject: string;
  thumbnail?: string;
  fallbackIconName?: string;
  category: string;
  /** The lesson the learner is on in this subject. */
  lessonTitle: string;
  /** Where that lesson sits on the teaching path: "Lesson 19". */
  lessonNumber: number;
  completedLessons: number;
  lessonCount: number;
  actionLabel?: string;
  onPlay(): void;
  onOpenSubject(): void;
  className?: string;
}

/**
 * A subject the learner is part-way through, drawn as the lesson they are on.
 *
 * The subject row answered "how far am I?" and left "what do I press?" to a
 * second tap. Once a subject has progress the lesson is the more useful thing to
 * show, so the artwork moves onto it and the subject shrinks to a heading — the
 * name once, small, rather than a card of its own sitting under a lesson card
 * that already says "Addition".
 *
 * Lessons carry no artwork of their own, only an icon, so the picture is the
 * subject's. Two targets: the heading opens the subject, the card plays the
 * lesson — the same split the Learn page makes between its path and its button.
 */
export const UISubjectLessonCard: React.FC<UISubjectLessonCardProps> = ({
  subject,
  thumbnail,
  fallbackIconName,
  category,
  lessonTitle,
  lessonNumber,
  completedLessons,
  lessonCount,
  actionLabel = "Play",
  onPlay,
  onOpenSubject,
  className = "",
}) => {
  /* Clamped: a registry that gains a lesson, or a record that counts a replay,
     can put `completedLessons` above `lessonCount`, and a bar drawn at 140% is
     a rendering fault rather than a nice surprise. */
  const percent = lessonCount
    ? Math.min(100, Math.round((completedLessons / lessonCount) * 100))
    : 0;

  return (
    <section className={className}>
      <button
        type="button"
        onClick={onOpenSubject}
        aria-label={`Open ${subject}`}
        className="flex w-full items-center gap-2 px-1 text-left text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-black uppercase tracking-widest">
          {subject}
        </span>
        <span className="shrink-0 text-[11px] font-bold tabular-nums">
          {completedLessons}/{lessonCount}
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      </button>

      <button
        type="button"
        onClick={onPlay}
        aria-label={`${actionLabel} ${lessonTitle}, lesson ${lessonNumber} of ${subject}`}
        className={`${themeSystem.card("interactive")} mt-1.5 flex w-full items-center gap-3 p-3 text-left`}
      >
        {/* A fixed 16:9 frame, so a subject still waiting for artwork holds the
            same slot as one that has it rather than shrinking to a 40px tile. */}
        <span className="block w-28 sm:w-32 aspect-[16/9] shrink-0 overflow-hidden rounded-xl">
          <UISkillThumbnail
            thumbnail={thumbnail}
            fallbackIconName={fallbackIconName}
            category={category}
            fill
            cover
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Lesson {lessonNumber}
          </span>
          <span className="mt-0.5 block truncate text-base font-black leading-tight text-ink">
            {lessonTitle}
          </span>
          <span
            aria-hidden="true"
            className="mt-2.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
          >
            <span
              className="block h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>

        {/* Its own column, centred on the card. Sharing the bar's line left it
            hanging below the text block, level with nothing. A mark rather than
            a labelled button at every width — the card's accessible name carries
            the word — and a span, not a nested button, since the whole card is
            already the control. */}
        <span className="shrink-0 grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-full bg-indigo-600 text-white shadow-sm">
          <Play className="h-4 w-4 sm:h-5 sm:w-5 translate-x-px fill-current" />
        </span>
      </button>
    </section>
  );
};
