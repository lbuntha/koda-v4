/**
 * "Start here": the first-day shelf, for a learner with nothing added yet.
 *
 * Shared by Home and Learn so the two cannot recommend different things. Each
 * pick is one tap from playing: the tap adds the skill (queued locally, so it
 * works offline) and opens its first lesson. Nothing here is a choice the
 * child has to understand first — no "Add", no catalogue, no settings.
 *
 * One shape per amount of room, CSS only (a container query, see below):
 * - under 672px wide: full-width rows, picture left, a Start button right;
 * - 672px and up: three picture cards side by side.
 */

import React, { useState } from "react";
import { Play, Sparkles } from "lucide-react";
import { isUnlocked } from "../../curriculum";
import type { SkillCatalogEntry } from "../../lib/skillCatalog";
import { starterSkills } from "../../lib/starterSkills";
import { premiumLocked } from "../../lib/premiumLessons";
import { useSkillRegistrations } from "../../lib/skillRegistrationApi";
import { themeSystem } from "../../lib/themeSystem";
import { useT } from "../../lib/i18n";
import { playSound } from "../../utils/audio";
import { UISkillThumbnail } from "../ui";
import type { Viewer } from "../../skills/viewer";

export interface StarterPicksProps {
  skills: SkillCatalogEntry[];
  viewer: Viewer;
  completedLevels: Record<number, number>;
  /** Opens a lesson by its level number — the same door every Play uses. */
  onStartLesson(levelNumber: number): void;
  className?: string;
}

export const StarterPicks: React.FC<StarterPicksProps> = ({
  skills,
  viewer,
  completedLevels,
  onStartLesson,
  className = "",
}) => {
  const { t } = useT();
  const { register } = useSkillRegistrations();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const picks = starterSkills(skills, {
    age: viewer.age,
    canStart: (skill) =>
      Boolean(skill.nextLesson) &&
      isUnlocked(skill.nextLesson, completedLevels, viewer) &&
      !premiumLocked({ skillId: skill.id, levelNumber: skill.nextLesson.levelNumber }),
  });
  if (!picks.length) return null;

  const start = async (skill: SkillCatalogEntry) => {
    if (busyId) return;
    setError(null);
    setBusyId(skill.id);
    playSound("pop");
    try {
      await register(skill.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("catalog.error.add"));
      setBusyId(null);
      return;
    }
    setBusyId(null);
    onStartLesson(skill.nextLesson.levelNumber);
  };

  return (
    /* `@container`: the switch from rows to cards follows the room this
       section actually has, not the screen. A 768px tablet with the sidebar
       open and a laptop with the progress rail both leave ~400px here, where
       three cards would squeeze the titles to "Observa…". */
    <section className={`@container ${className}`} aria-labelledby="starter-picks-title">
      <h2 id="starter-picks-title" className="text-lg font-black text-ink sm:text-xl">
        {t("starter.title")}
      </h2>
      <p className="mt-0.5 text-sm text-muted">{t("starter.subtitle")}</p>

      <ul className="mt-3 grid gap-3 @2xl:grid-cols-3 @2xl:gap-4">
        {picks.map((skill, index) => {
          const busy = busyId === skill.id;
          const first = index === 0;
          return (
            <li key={skill.id} className="min-w-0">
              <button
                type="button"
                onClick={() => void start(skill)}
                disabled={Boolean(busyId)}
                aria-label={t("starter.startSkill", { title: skill.name })}
                className={`${themeSystem.card("interactive")} relative flex h-full w-full items-center gap-3 overflow-hidden p-3 text-left @2xl:flex-col @2xl:items-stretch @2xl:gap-0 @2xl:p-0 ${
                  first ? "ring-2 ring-violet-300 dark:ring-violet-700" : ""
                } ${busyId && !busy ? "opacity-60" : ""}`}
              >
                {/* The picture: a fixed frame on a phone row, 16:9 on a card. */}
                <span className="relative block h-16 w-24 shrink-0 overflow-hidden rounded-xl @2xl:aspect-[16/9] @2xl:h-auto @2xl:w-full @2xl:rounded-none">
                  <UISkillThumbnail
                    thumbnail={skill.thumbnail}
                    fallbackIconName={skill.iconName}
                    category={skill.category}
                    size="sm"
                    fill
                    cover
                  />
                  {first && (
                    <span className="absolute left-2 top-2 hidden items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-black text-white shadow @2xl:inline-flex">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      {t("starter.best")}
                    </span>
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col @2xl:p-4 @2xl:pb-0">
                  {/* On a phone the "best pick" word rides above the title. */}
                  {first && (
                    <span className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-black text-violet-700 dark:text-violet-300 @2xl:hidden">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      {t("starter.best")}
                    </span>
                  )}
                  <span className="truncate text-base font-black leading-tight text-ink @2xl:text-lg">{skill.name}</span>
                  {skill.subjectName && <span className="text-xs font-bold text-muted">{skill.subjectName}</span>}
                  {skill.tagline && (
                    <span className="mt-0.5 hidden text-sm leading-snug text-muted @2xl:line-clamp-2">
                      {skill.tagline}
                    </span>
                  )}
                </span>

                {/* A span, not a nested button: the whole card is the control. */}
                <span className="shrink-0 @2xl:mt-auto @2xl:p-4">
                  <span
                    className={`${themeSystem.button("primary", "sm")} pointer-events-none min-h-11 @2xl:w-full`}
                  >
                    <Play className="fill-current" aria-hidden="true" />
                    {busy ? t("starter.starting") : t("starter.start")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className={`mt-3 ${themeSystem.flash("error")}`}>{error}</p>}
    </section>
  );
};
