import React, { useEffect, useState } from "react";
import { BookOpen, Sparkles, Star, TrendingUp } from "lucide-react";

import { useT } from "../../lib/i18n";
import { cachedFeed, StudyFeedAPI, type PopularItem, type StudyFeed, type StudyItem } from "../../lib/studyFeedApi";
import { themeSystem } from "../../lib/themeSystem";
import { UIAvatar } from "../ui";

/**
 * "Learning with others": what students of the same age finished this week.
 *
 * Two parts, both light. First the most popular lesson or book for this age
 * group, as an anonymous count with a Try button. Then a few shares from
 * students whose families turned sharing on, each with a Cheer. Nicknames
 * only, no scores, no comments.
 *
 * Draws nothing when there is nothing to show, so a new or quiet group never
 * sees an empty box.
 */

export interface StudyFeedCardProps {
  learnerId: string;
  /** The lesson's name from the local catalog, or null when this device does not have it. */
  lessonTitle: (skillId: string, lessonId: string) => string | null;
  onTry: (item: { kind: "lesson" | "book"; skillId: string; lessonId: string }) => void;
  className?: string;
}

const soft =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60";

function useStudyFeed(learnerId: string): [StudyFeed | null, (next: StudyFeed) => void] {
  const [feed, setFeed] = useState<StudyFeed | null>(() => cachedFeed(learnerId));
  useEffect(() => {
    setFeed(cachedFeed(learnerId));
    let live = true;
    StudyFeedAPI.get(learnerId)
      .then((next) => live && setFeed(next))
      .catch(() => undefined); // offline: the cached copy stays
    return () => {
      live = false;
    };
  }, [learnerId]);
  return [feed, setFeed];
}

export const StudyFeedCard: React.FC<StudyFeedCardProps> = ({ learnerId, lessonTitle, onTry, className = "" }) => {
  const { t } = useT();
  const [feed, setFeed] = useStudyFeed(learnerId);
  const [busy, setBusy] = useState<string | null>(null);
  if (!feed) return null;

  const titleOf = (item: { kind: string; skillId: string; lessonId: string; title: string | null }) =>
    item.kind === "book" ? item.title : lessonTitle(item.skillId, item.lessonId);

  const popular = feed.popular.find((item) => titleOf(item));
  const items = feed.items.filter((item) => titleOf(item)).slice(0, 3);
  if (!popular && items.length === 0) return null;

  const cheer = async (item: StudyItem) => {
    if (item.cheeredByMe || busy) return;
    setBusy(item.id);
    const patch = (cheers: number, cheeredByMe: boolean) =>
      setFeed({ ...feed, items: feed.items.map((row) => (row.id === item.id ? { ...row, cheers, cheeredByMe } : row)) });
    patch(item.cheers + 1, true);
    try {
      const result = await StudyFeedAPI.cheer(learnerId, item.id);
      patch(result.cheers, result.cheeredByMe);
    } catch {
      patch(item.cheers, false);
    } finally {
      setBusy(null);
    }
  };

  const band = feed.band;
  return (
    <section
      aria-label={t("home.studyFeed.title")}
      className={themeSystem.card("default", `p-4 space-y-3 ${className}`)}
    >
      {popular && <Popular item={popular} title={titleOf(popular) ?? ""} band={band} onTry={() => onTry(popular)} />}

      {items.length > 0 && (
        <div className={popular ? "border-t border-line pt-3" : ""}>
          <h3 className="mb-1 text-sm font-black text-ink">{t("home.studyFeed.friends")}</h3>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-1">
                <UIAvatar name={item.nickname} seed={item.avatarSeed ?? undefined} size="md" decorative />
                <p className="min-w-0 flex-1 text-sm leading-snug text-body">
                  {t(item.kind === "book" ? "home.studyFeed.read" : "home.studyFeed.finished", {
                    name: item.nickname,
                    title: titleOf(item) ?? "",
                  })}
                  {item.cheers > 0 && (
                    <span className="block text-xs text-muted">{t("home.studyFeed.cheers", { count: item.cheers })}</span>
                  )}
                </p>
                <button
                  type="button"
                  className={`${soft} w-11 px-0 ${item.cheeredByMe ? "!bg-indigo-600 !text-white !border-indigo-600" : ""}`}
                  aria-label={t("home.studyFeed.cheerFor", { name: item.nickname })}
                  aria-pressed={item.cheeredByMe}
                  disabled={busy === item.id}
                  onClick={() => void cheer(item)}
                >
                  <Star className="h-5 w-5" fill={item.cheeredByMe ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const Popular: React.FC<{
  item: PopularItem;
  title: string;
  band: [number, number] | null;
  onTry: () => void;
}> = ({ item, title, band, onTry }) => {
  const { t } = useT();
  const Icon = item.kind === "book" ? BookOpen : Sparkles;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300">
        <TrendingUp className="h-4 w-4" aria-hidden="true" />
        {band ? t("home.studyFeed.popularAges", { low: band[0], high: band[1] }) : t("home.studyFeed.popular")}
      </p>
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{title}</p>
          <p className="text-xs text-muted">{t("home.studyFeed.learners", { count: item.learners })}</p>
        </div>
        <button type="button" className={soft} onClick={onTry}>
          {t("home.studyFeed.try")}
        </button>
      </div>
    </div>
  );
};
