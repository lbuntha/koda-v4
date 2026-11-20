import React, { useMemo, useState } from "react";
import { BookOpen, ChevronRight, Lightbulb, Puzzle, Sparkles, X } from "lucide-react";
import { useT } from "../lib/i18n";
import { closeItems, closedKeys, fitsAge, itemKey, showing, useWhatsNew, type NewItem } from "../lib/whatsNew";
import type { SkillCatalogEntry } from "../lib/skillCatalog";
import { SvgAsset } from "../assets/svg";
import { UIButton, UISkillThumbnail } from "./ui";

const ICON = { skill: Lightbulb, book: BookOpen, rebus: Puzzle } as const;
const DAY = 24 * 60 * 60 * 1000;

/** Rows under the lead item; more than this and the card stops being news. */
const MORE_SHOWN = 3;

interface WhatsNewProps {
  /** Whose "closed" list this is: the learner, or the signed-in adult. */
  who: string | null;
  age: number;
  /** Admins see everything, whatever the age. */
  allAges?: boolean;
  /** Skills this viewer can open, by id; a skill not here is left off the card. */
  skills: ReadonlyMap<string, SkillCatalogEntry>;
  onOpenSkill(id: string): void;
  onOpenBook?(id: string): void;
  onOpenRebus?(): void;
}

/**
 * "New on Koda" — a card on Home for a skill, a book or a Rebus release an
 * admin published in the last few days.
 *
 * Drawn as a plain surface card, like the rest of Home, so it reads as part of
 * the page rather than an advert over it: the newest item leads with its art,
 * name, one line about it and a single button; anything else new is a short
 * list of rows underneath.
 *
 * It stays up for those days whether or not the learner has opened the new
 * thing. The close button hides what is on it for this learner; anything
 * published after that brings the card back.
 */
export const WhatsNew: React.FC<WhatsNewProps> = ({ who, age, allAges = false, skills, onOpenSkill, onOpenBook, onOpenRebus }) => {
  const { t } = useT();
  const items = useWhatsNew(Boolean(who));
  const [closedAt, setClosedAt] = useState(0);

  const fresh = useMemo(() => {
    if (!who) return [];
    return showing(items, closedKeys(who)).filter((item) => {
      if (item.kind === "skill") return skills.has(item.id);
      if (item.kind === "book") return Boolean(onOpenBook) && (allAges || fitsAge(item, age));
      return Boolean(onOpenRebus);
    });
    // `closedAt` re-reads the closed list after the close button.
  }, [items, who, age, allAges, skills, onOpenBook, onOpenRebus, closedAt]);

  if (!who || fresh.length === 0) return null;

  const [lead, ...others] = fresh;
  const entry = lead.kind === "skill" ? skills.get(lead.id) : undefined;

  const name = (item: NewItem) =>
    item.kind === "rebus"
      ? t("whatsNew.rebus", { count: item.count ?? 0 })
      : item.kind === "skill"
        ? skills.get(item.id)?.name ?? item.title
        : item.title;

  const when = (item: NewItem) => {
    const days = Math.floor((Date.now() - item.publishedAt) / DAY);
    return days <= 0 ? t("whatsNew.today") : days === 1 ? t("whatsNew.yesterday") : t("whatsNew.daysAgo", { count: days });
  };

  /** One line under the name: the skill's own tagline, else what kind of thing it is. */
  const about = (item: NewItem) =>
    (item.kind === "skill" && skills.get(item.id)?.tagline) || t(`whatsNew.about.${item.kind}`);

  const open = (item: NewItem) => {
    if (item.kind === "skill") onOpenSkill(item.id);
    else if (item.kind === "book") onOpenBook?.(item.id);
    else onOpenRebus?.();
  };

  const close = () => {
    closeItems(who, fresh, items);
    setClosedAt(Date.now());
  };

  const LeadIcon = ICON[lead.kind];
  const glyph = <LeadIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />;
  const art = entry ? (
    <UISkillThumbnail thumbnail={entry.thumbnail} fallbackIconName={entry.iconName} category={entry.category} size="lg" fill cover />
  ) : lead.kind === "book" && lead.picture ? (
    <SvgAsset id={lead.picture} size="100%" fallback={<span className="grid h-full w-full place-items-center">{glyph}</span>} />
  ) : (
    <span className="grid h-full w-full place-items-center">{glyph}</span>
  );

  return (
    <section aria-label={t("whatsNew.title")} className="overflow-hidden rounded-2xl border-2 border-line bg-surface">
      <header className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-5">
        <h2 className="inline-flex items-center gap-1.5 font-mono text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {t("whatsNew.title")}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label={t("whatsNew.dismiss")}
          className="-mr-1.5 grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-surface-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-4 pt-2 sm:flex-row sm:items-center sm:px-5 sm:pb-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span
            aria-hidden="true"
            className="block h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-line bg-indigo-50 dark:bg-indigo-500/10 sm:h-24 sm:w-24"
          >
            {art}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted">
              <span className="text-indigo-600 dark:text-indigo-300">{t(`whatsNew.kind.${lead.kind}`)}</span>
              <span aria-hidden="true"> · </span>
              {when(lead)}
            </p>
            <h3 className="mt-0.5 line-clamp-2 text-lg font-extrabold leading-snug text-ink sm:text-xl">{name(lead)}</h3>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{about(lead)}</p>
          </div>
        </div>
        <UIButton variant="primary" className="w-full shrink-0 sm:w-auto" onClick={() => open(lead)}>
          {t(`whatsNew.action.${lead.kind}`)}
        </UIButton>
      </div>

      {others.length > 0 && (
        <ul className="border-t-2 border-line" aria-label={t("whatsNew.alsoNew")}>
          {others.slice(0, MORE_SHOWN).map((item) => {
            const Icon = ICON[item.kind];
            return (
              <li key={itemKey(item)} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => open(item)}
                  aria-label={t(`whatsNew.open.${item.kind}`, { name: name(item) })}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-muted focus:outline-none focus-visible:bg-surface-muted sm:px-5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{name(item)}</span>
                    <span className="block text-xs text-muted">
                      {t(`whatsNew.kind.${item.kind}`)} · {when(item)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
