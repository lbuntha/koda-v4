import React, { useMemo, useState } from "react";
import { BookOpen, Lightbulb, Play, Puzzle, X } from "lucide-react";
import { useT } from "../lib/i18n";
import { closeItems, closedKeys, fitsAge, itemKey, showing, useWhatsNew, type NewItem } from "../lib/whatsNew";
import type { SkillCatalogEntry } from "../lib/skillCatalog";
import { themeSystem } from "../lib/themeSystem";
import { SvgAsset } from "../assets/svg";
import { UIButton, UISkillThumbnail } from "./ui";

const ICON = { skill: Lightbulb, book: BookOpen, rebus: Puzzle } as const;

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
 * "New on Koda" — a hero card on Home for a skill, a book or a Rebus release
 * an admin published in the last few days.
 *
 * It stays up for those days whether or not the learner has opened the new
 * thing, so a child who taps past it on Monday still finds it on Tuesday. The
 * close button hides what is on it for this learner; anything published after
 * that brings the card back.
 *
 * The newest item is the hero; the others are a row of chips under it.
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

  const [hero, ...others] = fresh;
  const entry = hero.kind === "skill" ? skills.get(hero.id) : undefined;

  const name = (item: NewItem) =>
    item.kind === "rebus"
      ? t("whatsNew.rebus", { count: item.count ?? 0 })
      : item.kind === "skill"
        ? skills.get(item.id)?.name ?? item.title
        : item.title;

  const open = (item: NewItem) => {
    if (item.kind === "skill") onOpenSkill(item.id);
    else if (item.kind === "book") onOpenBook?.(item.id);
    else onOpenRebus?.();
  };

  const close = () => {
    closeItems(who, fresh, items);
    setClosedAt(Date.now());
  };

  const HeroIcon = ICON[hero.kind];
  const art = entry ? (
    <UISkillThumbnail thumbnail={entry.thumbnail} fallbackIconName={entry.iconName} category={entry.category} size="lg" fill />
  ) : hero.kind === "book" && hero.picture ? (
    <SvgAsset id={hero.picture} size="100%" fallback={<HeroIcon className="h-12 w-12 text-indigo-600" aria-hidden="true" />} />
  ) : (
    <span className="grid h-full w-full place-items-center bg-white/90">
      <HeroIcon className="h-12 w-12 text-indigo-600" aria-hidden="true" />
    </span>
  );

  return (
    <section
      aria-label={t("whatsNew.title")}
      className={`relative isolate overflow-hidden rounded-3xl ${themeSystem.heroGradient} text-white`}
    >
      <button
        type="button"
        onClick={close}
        aria-label={t("whatsNew.dismiss")}
        className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-4 p-5 pr-14 sm:gap-6 sm:p-6 sm:pr-16">
        <span
          aria-hidden="true"
          className="block h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-white shadow-lg ring-4 ring-white/50 sm:h-32 sm:w-32"
        >
          {art}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest">
            {t(`whatsNew.kind.${hero.kind}`)}
          </span>
          <h2 className="line-clamp-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{name(hero)}</h2>
          {entry?.tagline && <p className="line-clamp-2 text-sm font-medium text-white/90 sm:text-base">{entry.tagline}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-center sm:px-6 sm:pb-6">
        <UIButton
          variant="light"
          className="w-full sm:w-auto"
          icon={<Play className="fill-current" aria-hidden="true" />}
          onClick={() => open(hero)}
        >
          {t(`whatsNew.action.${hero.kind}`)}
        </UIButton>

        {others.length > 0 && (
          <ul className="flex min-w-0 flex-wrap gap-2" aria-label={t("whatsNew.alsoNew")}>
            {others.slice(0, 3).map((item) => {
              const Icon = ICON[item.kind];
              return (
                <li key={itemKey(item)} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => open(item)}
                    aria-label={t(`whatsNew.open.${item.kind}`, { name: name(item) })}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{name(item)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
