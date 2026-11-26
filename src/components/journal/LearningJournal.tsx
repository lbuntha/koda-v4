import React, { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { formatDate, formatNumber, translate, useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { useLearningJournal } from "../../lib/learningJournal";
import type { JournalBook, JournalDay, JournalLesson } from "../../lib/learning/journal";
import { BookStore } from "../../library/bookStore";
import { STARTER_PASSAGES } from "../../library/data/starterPassages";
import { getCourseLessons } from "../../curriculum";
import { getSkill } from "../../skills/registry";
import { SvgAsset } from "../../assets/svg";
import { UIArtIcon, UIButton, UILessonIcon, UISectionHeader } from "../ui";

/**
 * "My learning": what a child read and practised, by day.
 *
 * For the child first — big numbers, short words, one line per day they can
 * copy into the reading book school gives them — and the same page for the
 * parent, from the same fold (`buildJournal`). A day only appears when
 * something was finished or read, so the list never shows empty days.
 */

type Translate = ReturnType<typeof useT>["t"];

const dayDate = (day: string, language: string, style: "long" | "short") =>
  formatDate(`${day}T12:00:00`, style === "long" ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short", year: "numeric" }, language);

export function bookTitleOf(book: Pick<JournalBook, "bookId" | "lessonId">, titles: Record<string, string>): string | null {
  return (
    titles[book.lessonId] ??
    BookStore.shelf().find((p) => p.id === book.bookId)?.title ??
    STARTER_PASSAGES.find((p) => p.id === book.bookId)?.title ??
    null
  );
}

let courseLessons: Map<string, { title: string; iconName?: string; iconTone?: string }> | null = null;
/** Koda's own activities, which are not skills: named and drawn the way the rest of the app names and draws them. */
const APP_ACTIVITIES: Record<string, { name: string; art: string }> = {
  "koda-word-guess": { name: "wordGuess.title", art: "kit-words" },
  "koda-rebus": { name: "rebus.title", art: "kit-sparkle" },
  "koda-trace": { name: "todayPlan.kind.write", art: "menu-trace" },
};

export function lessonNameOf(lesson: Pick<JournalLesson, "skillId" | "lessonId">): {
  skill: string;
  lesson: string | null;
  iconName?: string;
  iconTone?: string;
  art?: string;
} {
  const app = APP_ACTIVITIES[lesson.skillId];
  if (app) return { skill: translate(app.name), lesson: null, art: app.art };
  courseLessons ??= new Map(getCourseLessons().map((l) => [`${l.skillId}/${l.id}`, { title: l.title, iconName: l.iconName, iconTone: l.iconTone }]));
  const found = courseLessons.get(`${lesson.skillId}/${lesson.lessonId}`);
  const skill = getSkill(lesson.skillId);
  return {
    skill: skill?.manifest.name ?? lesson.skillId,
    lesson: found?.title ?? null,
    iconName: found?.iconName ?? skill?.manifest.iconName,
    iconTone: found?.iconTone,
  };
}

/** The line a child copies into their school reading book. */
export function handbookLine(day: JournalDay, titles: Record<string, string>, t: Translate, language: string): string {
  const parts: string[] = [];
  const books = day.books.filter((b) => b.pages > 0 || b.finished || b.quiz);
  if (books.length) {
    parts.push(
      t("journal.line.read", {
        books: books
          .map((b) => {
            const bits = [t("journal.pages", { read: b.pages, total: b.pageCount })];
            if (b.finished) bits.push(t("journal.finished"));
            if (b.quiz?.answered) bits.push(t("journal.quiz", { right: b.quiz.correctFirstTry, total: b.quiz.answered }));
            return `${bookTitleOf(b, titles) ?? t("journal.untitledBook")} (${bits.join(", ")})`;
          })
          .join("; "),
      }),
    );
  }
  if (day.lessons.length) {
    parts.push(
      t("journal.line.practised", {
        lessons: day.lessons
          .map((l) => {
            const name = lessonNameOf(l);
            return `${name.lesson ? `${name.skill}: ${name.lesson}` : name.skill} ${l.correctFirstTry}/${l.answered}`;
          })
          .join("; "),
      }),
    );
  }
  return [dayDate(day.day, language, "short"), ...parts].join(" · ");
}

const Stat: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => (
  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface-muted p-3">
    <span className="shrink-0">{icon}</span>
    <span className="min-w-0">
      <span className="block text-2xl font-black tabular-nums leading-none text-ink">{value}</span>
      <span className="mt-1 block text-xs font-bold text-muted">{label}</span>
    </span>
  </div>
);

const CopyLine: React.FC<{ line: string }> = ({ line }) => {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no clipboard (old browser, no permission): the line is on screen to copy by hand */
    }
  };
  return (
    <div className="mt-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 p-3 dark:border-indigo-700 dark:bg-indigo-950/40">
      <p className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">{t("journal.forHandbook")}</p>
      <p className="mt-1 break-words text-sm text-ink" data-testid="handbook-line">{line}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? t("journal.copied") : t("journal.copy")}
      </button>
    </div>
  );
};

function printLines(title: string, lines: string[]) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return frame.remove();
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  doc.open();
  doc.write(
    `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<style>body{font:16px/1.6 system-ui,sans-serif;color:#000;margin:24px}h1{font-size:20px}li{margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #999}</style>` +
      `<h1>${esc(title)}</h1><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`,
  );
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 1000);
}

const DayCard: React.FC<{ day: JournalDay; titles: Record<string, string> }> = ({ day, titles }) => {
  const { t, language } = useT();
  const books = day.books.filter((b) => b.pages > 0 || b.finished || b.quiz);
  return (
    <li className={themeSystem.card("default", "p-4")}>
      <h3 className="text-base font-black text-ink">{dayDate(day.day, language, "long")}</h3>
      <p className="text-xs font-bold text-muted">
        {t("journal.dayTotals", { minutes: day.minutes })}
        {day.answered > 0 && ` · ${t("journal.rightFirstTry", { right: day.correctFirstTry, total: day.answered })}`}
      </p>
      <ul className="mt-3 space-y-2">
        {books.map((book) => (
          <li key={book.bookId} className="flex items-start gap-3">
            <UIArtIcon id="menu-library" className="mt-0.5 h-10 w-10" />
            <span className="min-w-0">
              <span className="block break-words font-bold text-ink">{bookTitleOf(book, titles) ?? t("journal.untitledBook")}</span>
              <span className="block text-sm text-muted">
                {[
                  t("journal.pages", { read: book.pages, total: book.pageCount }),
                  book.finished ? t("journal.finished") : null,
                  book.quiz?.answered ? t("journal.quiz", { right: book.quiz.correctFirstTry, total: book.quiz.answered }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </li>
        ))}
        {day.lessons.map((lesson) => {
          const name = lessonNameOf(lesson);
          return (
            <li key={`${lesson.skillId}/${lesson.lessonId}`} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">
                {name.art ? (
                  <UIArtIcon id={name.art as React.ComponentProps<typeof UIArtIcon>["id"]} className="h-10 w-10" />
                ) : (
                  <UILessonIcon name={name.iconName} tone={name.iconTone} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block break-words font-bold text-ink">{name.lesson ?? name.skill}</span>
                <span className="block text-sm text-muted">
                  {[
                    name.lesson ? name.skill : null,
                    t("journal.rightFirstTry", { right: lesson.correctFirstTry, total: lesson.answered }),
                    lesson.rounds > 1 ? t("journal.rounds", { count: lesson.rounds }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <CopyLine line={handbookLine(day, titles, t, language)} />
    </li>
  );
};

export const LearningJournal: React.FC<{
  learnerId: string;
  /** Shown to a parent: "Sok's learning". A child's own page says "My learning". */
  learnerName?: string;
  onBack?: () => void;
}> = ({ learnerId, learnerName, onBack }) => {
  const { t, language } = useT();
  const { journal, titles, settled, offline } = useLearningJournal(learnerId);
  const { summary, days } = journal;
  const title = learnerName ? t("journal.titleFor", { name: learnerName }) : t("journal.title");
  const weekLabels = summary.week.map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return formatDate(d, { weekday: "narrow" }, language);
  });
  const thisWeek = summary.week.filter(Boolean).length;
  const percent = summary.answered ? Math.round((100 * summary.correctFirstTry) / summary.answered) : null;

  return (
    <section className={`w-full space-y-4 ${themeSystem.spacing.section}`} aria-label={title}>
      <UISectionHeader
        title={title}
        subtitle={t("journal.subtitle")}
        icon={<UIArtIcon id="kit-report" className="h-6 w-6" />}
        action={
          onBack ? (
            <UIButton variant="secondary" size="sm" onClick={onBack}>
              {t("reader.back")}
            </UIButton>
          ) : undefined
        }
      />

      <div className={themeSystem.card("default", "p-4")}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-ink">{t("journal.thisWeek", { count: thisWeek })}</p>
          {summary.streak > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-1 text-xs font-black text-pink-700 dark:bg-pink-900/50 dark:text-pink-200">
              <SvgAsset id="streak" size={18} title={t("home.learningStreak")} fallback={<span />} />
              {t("streak.days", { count: summary.streak })}
            </span>
          )}
        </div>
        <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label={t("journal.thisWeek", { count: thisWeek })}>
          {summary.week.map((done, i) => (
            <li key={i} className="flex flex-col items-center gap-1">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full border-2 ${
                  done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line bg-surface text-muted"
                } ${i === 6 ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-surface" : ""}`}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </span>
              <span className="text-[11px] font-bold text-muted">{weekLabels[i]}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<UIArtIcon id="menu-library" className="h-9 w-9" />} value={formatNumber(summary.booksFinished, language)} label={t("journal.stat.books")} />
        <Stat icon={<UIArtIcon id="kit-words" className="h-9 w-9" />} value={formatNumber(summary.pagesRead, language)} label={t("journal.stat.pages")} />
        <Stat
          icon={<UIArtIcon id="kit-target" className="h-9 w-9" />}
          value={percent === null ? "–" : `${formatNumber(percent, language)}%`}
          label={t("journal.stat.right", { right: summary.correctFirstTry, total: summary.answered })}
        />
        <Stat icon={<UIArtIcon id="kit-clock" className="h-9 w-9" />} value={formatNumber(summary.minutes, language)} label={t("journal.stat.minutes")} />
      </div>
      <p className="px-1 text-xs text-muted">{t("journal.window", { count: 30 })}</p>

      {offline && <p className={themeSystem.flash("info")}>{t("journal.offline")}</p>}

      {days.length === 0 ? (
        <p className={themeSystem.card("default", "p-5 text-sm text-muted")}>{settled ? t("journal.empty") : t("journal.loading")}</p>
      ) : (
        <>
          <div className="flex justify-end">
            <UIButton variant="secondary" size="sm" icon={<Printer />} onClick={() => printLines(title, days.slice(0, 7).map((d) => handbookLine(d, titles, t, language)))}>
              {t("journal.print")}
            </UIButton>
          </div>
          <ol className="space-y-3">
            {days.map((day) => (
              <DayCard key={day.day} day={day} titles={titles} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
};
