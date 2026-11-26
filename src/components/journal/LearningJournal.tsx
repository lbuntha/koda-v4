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

/**
 * One day as a child writes it in their school reading book: the date, then a
 * short row per book or lesson — what it was, and how it went.
 */
export interface HandbookRow {
  kind: "read" | "practised";
  title: string;
  detail: string;
}
export interface HandbookEntry {
  date: string;
  rows: HandbookRow[];
}

export function handbookEntry(day: JournalDay, titles: Record<string, string>, t: Translate, language: string): HandbookEntry {
  const rows: HandbookRow[] = [];
  for (const b of day.books.filter((b) => b.pages > 0 || b.finished || b.quiz)) {
    const bits = [t("journal.pagesShort", { read: b.pages, total: b.pageCount })];
    if (b.finished) bits.push(t("journal.finished"));
    if (b.quiz?.answered) bits.push(t("journal.quiz", { right: b.quiz.correctFirstTry, total: b.quiz.answered }));
    rows.push({ kind: "read", title: bookTitleOf(b, titles) ?? t("journal.untitledBook"), detail: bits.join(" · ") });
  }
  for (const l of day.lessons) {
    const name = lessonNameOf(l);
    rows.push({ kind: "practised", title: name.lesson ?? name.skill, detail: t("journal.right", { right: l.correctFirstTry, total: l.answered }) });
  }
  return { date: dayDate(day.day, language, "short"), rows };
}

/** The same entry as plain text, one row per line, for the clipboard. */
export const handbookText = (entry: HandbookEntry, t: Translate): string =>
  [entry.date, ...entry.rows.map((r) => `${t(`journal.line.${r.kind}`)}: ${r.title} — ${r.detail}`)].join("\n");

const Stat: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => (
  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface-muted p-3">
    <span className="shrink-0">{icon}</span>
    <span className="min-w-0">
      <span className="block text-2xl font-black tabular-nums leading-none text-ink">{value}</span>
      <span className="mt-1 block text-xs font-bold text-muted">{label}</span>
    </span>
  </div>
);

function printEntries(title: string, entries: HandbookEntry[], t: Translate) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return frame.remove();
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const day = (e: HandbookEntry) =>
    `<section><h2>${esc(e.date)}</h2><table>${e.rows
      .map((r) => `<tr><th>${esc(t(`journal.line.${r.kind}`))}</th><td><b>${esc(r.title)}</b><br>${esc(r.detail)}</td></tr>`)
      .join("")}</table></section>`;
  doc.open();
  doc.write(
    `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<style>body{font:15px/1.5 system-ui,sans-serif;color:#000;margin:24px}h1{font-size:20px}h2{font-size:16px;margin:18px 0 6px}` +
      `table{border-collapse:collapse;width:100%}th{text-align:left;vertical-align:top;width:7em;padding:6px 8px 6px 0;font-weight:600}td{padding:6px 0;border-bottom:1px solid #bbb}</style>` +
      `<h1>${esc(title)}</h1>${entries.map(day).join("")}`,
  );
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 1000);
}

const CopyDay: React.FC<{ entry: HandbookEntry }> = ({ entry }) => {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(handbookText(entry, t));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no clipboard (old browser, no permission): the day is on screen to copy by hand */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? t("journal.copied") : t("journal.copy")}
      title={copied ? t("journal.copied") : t("journal.copy")}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-muted hover:text-ink"
    >
      {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
    </button>
  );
};

/** One day: the date, then a clean row per book or lesson — what it was, and how it went. */
const DayCard: React.FC<{ day: JournalDay; titles: Record<string, string> }> = ({ day, titles }) => {
  const { t, language } = useT();
  const entry = handbookEntry(day, titles, t, language);
  const books = day.books.filter((b) => b.pages > 0 || b.finished || b.quiz);
  const icons: React.ReactNode[] = [
    ...books.map(() => <UIArtIcon id="menu-library" className="h-10 w-10" />),
    ...day.lessons.map((lesson) => {
      const name = lessonNameOf(lesson);
      return name.art ? (
        <UIArtIcon id={name.art as React.ComponentProps<typeof UIArtIcon>["id"]} className="h-10 w-10" />
      ) : (
        <UILessonIcon name={name.iconName} tone={name.iconTone} />
      );
    }),
  ];
  return (
    <li className={themeSystem.card("default", "p-4")} data-testid="journal-day">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-black text-ink">{dayDate(day.day, language, "long")}</h3>
          <p className="text-xs font-bold text-muted">{t("journal.dayTotals", { minutes: day.minutes })}</p>
        </div>
        <CopyDay entry={entry} />
      </div>
      <ul className="mt-2 divide-y divide-line">
        {entry.rows.map((row, i) => (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <span className="shrink-0">{icons[i]}</span>
            <span className="min-w-0 flex-1">
              <span className="block break-words font-bold text-ink">{row.title}</span>
              <span className="block text-sm tabular-nums text-muted">{row.detail}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                row.kind === "read"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                  : "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"
              }`}
            >
              {t(`journal.line.${row.kind}`)}
            </span>
          </li>
        ))}
      </ul>
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
            <UIButton variant="secondary" size="sm" icon={<Printer />} onClick={() => printEntries(title, days.slice(0, 7).map((d) => handbookEntry(d, titles, t, language)), t)}>
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
