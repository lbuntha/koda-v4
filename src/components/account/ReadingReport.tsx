import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { GOOD_WEEK_DAYS, READING_QUIZ_PARTS, WEEK_DAYS, weeklyDays, type ReadingSummary } from "../../lib/childReport";
import { formatDate, formatNumber, useT } from "../../lib/i18n";
import { MASTERY_ACCURACY, MIN_EVIDENCE } from "../../lib/learning/mastery";
import { STARTER_PASSAGES } from "../../library/data/starterPassages";
import { themeSystem } from "../../lib/themeSystem";
import { UIArtIcon, UIBadge, UISectionHeader } from "../ui";

function ReadingDetails({ title, preview, children }: { title: string; preview?: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-3 hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="koda-admin-card-title text-ink">{title}</span>
          {preview && <span className="mt-0.5 block break-words text-sm text-muted">{preview}</span>}
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      {children}
    </details>
  );
}

function bookTitle(book: { bookId: string; title: string | null }) {
  return book.title ?? STARTER_PASSAGES.find((starter) => starter.id === book.bookId)?.title;
}

export function ReadingReport({ reading }: { reading: ReadingSummary }) {
  const { t, language } = useT();
  const hasQuiz = READING_QUIZ_PARTS.some((part) => reading.quiz[part]?.answered);
  const hasActivity = reading.readingDays > 0 || hasQuiz;
  const recentDays = reading.readingDates && weeklyDays(reading.readingDates).at(-1);
  const readingTargetMet = (recentDays ?? 0) >= GOOD_WEEK_DAYS;
  const comprehension = reading.quiz.comprehension;
  const books = (reading.books ?? []).map((book) => ({ ...book, title: bookTitle(book) }));
  const latestTitle = books[0]?.title;
  const bookToRevisit = books.find(({ title, comprehension: score }) =>
    title && (score?.incorrectFirstTry || score?.correctWithHelp),
  );
  const bookToDiscuss = bookToRevisit?.title ?? books.find((book) => book.title)?.title;
  const nextStep = bookToDiscuss
    ? t(bookToRevisit ? "report.reading.tryTogether.revisit" : "report.reading.tryTogether.discuss", { title: bookToDiscuss })
    : t("report.reading.tryTogether.start");
  const reportWindow = t("report.reading.window", { count: reading.days });

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader title={t("report.reading.title")} icon={<UIArtIcon id="menu-library" className="h-6 w-6" />} />
      {hasActivity ? (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface-muted p-3">
              <dt className="text-xs text-muted">{t("report.reading.weeklyDays", { count: WEEK_DAYS })}</dt>
              {recentDays === undefined ? (
                <dd className="mt-1 text-sm text-ink">{t("report.reading.targets.weeklyGoal", { target: GOOD_WEEK_DAYS, days: WEEK_DAYS })}</dd>
              ) : (
                <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="koda-admin-metric tabular-nums">{t("report.reading.targets.weeklyProgress", { done: recentDays, target: GOOD_WEEK_DAYS })}</span>
                  {readingTargetMet && <UIBadge variant="success">{t("report.reading.targets.met")}</UIBadge>}
                </dd>
              )}
            </div>
            <div className="rounded-2xl border border-line bg-surface-muted p-3">
              <dt className="text-xs text-muted">{t("report.reading.booksFinished")} · {reportWindow}</dt>
              <dd className="koda-admin-metric tabular-nums">{formatNumber(reading.booksFinished, language)}</dd>
            </div>
            <div className="col-span-2 rounded-2xl border border-line bg-surface-muted p-3 sm:col-span-1">
              <dt className="text-xs text-muted">{t("report.reading.part.comprehension")} · {reportWindow}</dt>
              {comprehension?.answered ? (
                <dd>
                  <span className="koda-admin-metric tabular-nums">{t("report.reading.score", { right: comprehension.correctFirstTry, total: comprehension.answered })}</span>
                  <p className="text-xs text-muted">{t("report.reading.firstTry")}</p>
                </dd>
              ) : (
                <dd className="mt-1 text-sm text-muted">{t("report.reading.noComprehension")}</dd>
              )}
            </div>
          </dl>
          <div className="rounded-2xl border border-line bg-surface-muted p-3">
            <h4 className="koda-admin-card-title text-ink">{t("report.reading.tryTogether.title")}</h4>
            <p className="mt-1 break-words text-sm text-ink">{nextStep}</p>
          </div>
          {(books.length > 0 || reading.readingDays > 0) && (
            <ReadingDetails title={t("report.reading.books.title")} preview={latestTitle ? t("report.reading.books.latest", { title: latestTitle }) : undefined}>
              <p className="border-t border-line px-3 py-2 text-xs text-muted">
                {t("report.reading.books.activity", { days: reading.readingDays, visits: reading.pageVisits, window: reportWindow })}
              </p>
              {books.length > 0 && (
                <ul className="divide-y divide-line border-t border-line">
                  {books.map((book) => {
                    const title = book.title ?? t("report.reading.books.untitled");
                    const date = formatDate(`${book.lastReadDay}T00:00:00`, { dateStyle: "medium" }, language);
                    const score = book.comprehension;
                    const details = [
                      score?.correctWithHelp ? t("report.reading.books.withHelp", { count: score.correctWithHelp }) : null,
                      score?.incorrectFirstTry ? t("report.reading.books.incorrect", { count: score.incorrectFirstTry }) : null,
                    ].filter(Boolean);
                    return (
                      <li key={book.bookId} className="space-y-1 px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <h4 className="min-w-0 break-words font-medium text-ink">{title}</h4>
                          <UIBadge variant={book.finished ? "success" : "neutral"}>
                            {t(book.finished ? "report.reading.books.finished" : "report.reading.books.explored")}
                          </UIBadge>
                        </div>
                        <p className="text-xs text-muted">{t("report.reading.books.lastRead", { date })}</p>
                        <p className="text-muted">
                          {score?.answered
                            ? t("report.reading.books.comprehension", { right: score.correctFirstTry, total: score.answered })
                            : t("report.reading.books.noComprehension")}
                        </p>
                        {details.length > 0 && <p className="text-xs text-muted">{details.join(" · ")}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ReadingDetails>
          )}
          {hasQuiz && (
            <ReadingDetails title={t("report.reading.quiz")}>
              <p className="border-y border-line px-3 py-2 text-xs text-muted">
                {t("report.reading.targets.quizGoal", { percent: MASTERY_ACCURACY * 100, count: MIN_EVIDENCE })}
              </p>
              <dl className="divide-y divide-line">
                {READING_QUIZ_PARTS.map((part) => {
                  const score = reading.quiz[part];
                  if (!score?.answered) return null;
                  const remaining = MIN_EVIDENCE - score.answered;
                  const targetMet = remaining <= 0 && score.correctFirstTry / score.answered >= MASTERY_ACCURACY;
                  return (
                    <div key={part} className="flex flex-wrap justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm">
                      <dt className="font-medium text-ink">{t(`report.reading.part.${part}`)}</dt>
                      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums text-muted">
                        <span>{t("report.reading.score", { right: score.correctFirstTry, total: score.answered })}</span>
                        <UIBadge variant={targetMet ? "success" : "neutral"}>
                          {remaining > 0
                            ? t("report.reading.targets.moreAnswers", { count: remaining })
                            : t(targetMet ? "report.reading.targets.met" : "report.reading.targets.below")}
                        </UIBadge>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </ReadingDetails>
          )}
        </>
      ) : <p className="text-sm text-muted">{nextStep}</p>}
    </section>
  );
}
