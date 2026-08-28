import React, { useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, RefreshCw, Search, Sparkles } from "lucide-react";
import {
  filterSkillCatalog,
  recommendedSkills,
} from "../lib/skillCatalog";
import { useSkillCatalog } from "../lib/useSkillCatalog";
import { useSkillRegistrations } from "../lib/skillRegistrationApi";
import { refreshSkillRegistry } from "../lib/skillRegistryApi";
import { playSound } from "../utils/audio";
import { themeSystem } from "../lib/themeSystem";
import { UIBadge, UIButton, UIPageHeader, UISkillCard, UISkillThumbnail, skillArtFor } from "./ui";

export interface SkillCatalogPageProps {
  activeLevelNumber: number;
  completedLevels: Record<number, number>;
  onSelectSkill(skillId: string): void;
}

const PAGE_SIZE = 12;

/**
 * One shape for both shelves, so a card is the same size wherever it appears.
 *
 * Wider columns than a square-ish card would need: the artwork is 16:9, and at
 * five columns a landscape picture is too small to read the title inside it.
 */
const CARD_GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";
const labelForCategory = (category: string) => skillArtFor(category).label;

export const SkillCatalogPage: React.FC<SkillCatalogPageProps> = ({
  activeLevelNumber,
  completedLevels,
  onSelectSkill,
}) => {
  const { skills, viewer } = useSkillCatalog(completedLevels);
  const { registeredIds, register } = useSkillRegistrations();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(skills.map((skill) => skill.category))].sort(),
    [skills],
  );
  const visible = useMemo(
    () => filterSkillCatalog(skills, query, category),
    [category, query, skills],
  );
  const resume =
    skills.find(
      (skill) =>
        skill.completedLessons > 0 &&
        skill.progressPercent < 100 &&
        skill.lessons.some((lesson) => lesson.levelNumber === activeLevelNumber),
    ) ?? skills.find((skill) => skill.completedLessons > 0 && skill.progressPercent < 100);
  const recommended = recommendedSkills(skills)
    .filter((skill) => skill.id !== resume?.id)
    .slice(0, 4);
  const visiblePage = visible.slice(0, visibleLimit);

  const open = (skillId: string) => {
    playSound("pop");
    onSelectSkill(skillId);
  };

  const add = async (skillId: string) => {
    setRegistrationError(null);
    setRegisteringId(skillId);
    try {
      await register(skillId);
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : "Could not add this skill.");
    } finally {
      setRegisteringId(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshSkillRegistry();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "The skill library could not be refreshed.");
    } finally {
      setRefreshing(false);
    }
  };

  if (!skills.length) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <BookOpen className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-black tracking-tight text-ink">
            No skills available yet
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            {viewer.showAllSkills
              ? "Publish a skill with at least one lesson from Skills Manager to make it appear here."
              : `No published skills currently match age ${viewer.age}. New age-matched skills will appear here automatically.`}
          </p>

          <div className="mt-5 flex flex-col items-center gap-2">
            <UIButton
              variant="secondary"
              icon={<RefreshCw />}
              isLoading={refreshing}
              onClick={() => void refresh()}
            >
              Refresh skill library
            </UIButton>
            {refreshError && <p className={themeSystem.flash("error")}>{refreshError}</p>}
            {!viewer.showAllSkills && <p className="text-xs text-muted">Ask an adult to check the learner age and published skills.</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={themeSystem.spacing.section}>
      {/* The title goes on a phone — the toolbar says "Learn" already. The badge
          stays: it is the only thing here explaining why unreleased skills are
          on screen. */}
      <UIPageHeader
        eyebrow="Skill library"
        title="Learn"
        subtitle={
          viewer.showAllSkills
            ? `${skills.length} skills · admin catalog includes every age and release state.`
            : `Skills selected for age ${viewer.age}. Choose one to open its learning path.`
        }
        action={viewer.showAllSkills ? <UIBadge variant="primary">Admin · all skills</UIBadge> : undefined}
      />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisibleLimit(PAGE_SIZE);
          }}
          placeholder="Search skills"
          aria-label="Search skills"
          className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 pl-11 pr-4 text-sm text-ink outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Skill categories">
        {["all", ...categories].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setCategory(value);
              setVisibleLimit(PAGE_SIZE);
            }}
            aria-pressed={category === value}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-mono font-black border-2 transition ${
              category === value
                ? "bg-indigo-600 border-indigo-700 text-white"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-muted hover:border-indigo-300"
            }`}
          >
            {value === "all" ? "For you" : labelForCategory(value)}
          </button>
        ))}
      </div>

      {registrationError && <p className={themeSystem.flash("error")}>{registrationError}</p>}

      {!query && category === "all" && resume && (
        <section className={`${themeSystem.card("default")} p-4 sm:p-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <UISkillThumbnail
              thumbnail={resume.thumbnail}
              fallbackIconName={resume.iconName}
              category={resume.category}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono font-black uppercase tracking-widest text-indigo-600">
                Continue learning
              </p>
              <h2 className="mt-1 text-xl sm:text-2xl font-black text-ink">{resume.name}</h2>
              <p className="mt-1 text-sm text-muted">{resume.tagline}</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 rounded-full bg-surface-muted overflow-hidden flex-1 max-w-md">
                  <div
                    className="h-full rounded-full bg-indigo-600"
                    style={{ width: `${resume.progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-muted">
                  {resume.completedLessons}/{resume.lessons.length}
                </span>
              </div>
            </div>
            <UIButton iconRight={<ArrowRight />} onClick={() => open(resume.id)}>
              Open skill
            </UIButton>
          </div>
        </section>
      )}

      {!query && category === "all" && recommended.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-black text-lg text-ink">Recommended for you</h2>
              <p className="text-xs text-muted">Age-fit skills, ready to start or continue.</p>
            </div>
          </div>
          <div className={CARD_GRID}>
            {recommended.map((skill) => (
              <UISkillCard
                key={skill.id}
                title={skill.name}
                tagline={skill.tagline}
                thumbnail={skill.thumbnail}
                fallbackIconName={skill.iconName}
                category={skill.category}
                ages={skill.ages}
                lessonCount={skill.lessons.length}
                completedLessons={skill.completedLessons}
                progressPercent={skill.progressPercent}
                status={skill.status}
                registered={viewer.showAllSkills || registeredIds.has(skill.id)}
                registering={registeringId === skill.id}
                onOpen={() => open(skill.id)}
                onRegister={() => void add(skill.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-black text-lg text-ink">
              {query || category !== "all" ? "Search results" : "Browse all skills"}
            </h2>
            <p className="text-xs text-muted">
              {visible.length} {visible.length === 1 ? "skill" : "skills"}
            </p>
          </div>
          {skills.every((skill) => skill.progressPercent === 100) && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> All complete
            </span>
          )}
        </div>
        {visible.length ? (
          <div className={CARD_GRID}>
            {visiblePage.map((skill) => (
              <UISkillCard
                key={skill.id}
                title={skill.name}
                tagline={skill.tagline}
                thumbnail={skill.thumbnail}
                fallbackIconName={skill.iconName}
                category={skill.category}
                ages={skill.ages}
                lessonCount={skill.lessons.length}
                completedLessons={skill.completedLessons}
                progressPercent={skill.progressPercent}
                status={skill.status}
                registered={viewer.showAllSkills || registeredIds.has(skill.id)}
                registering={registeringId === skill.id}
                onOpen={() => open(skill.id)}
                onRegister={() => void add(skill.id)}
              />
            ))}
          </div>
        ) : (
          <div className={`${themeSystem.card("default")} p-8 text-center`}>
            <p className="font-mono font-black text-ink">No matching skills</p>
            <p className="mt-1 text-sm text-muted">Try another search or category.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setVisibleLimit(PAGE_SIZE);
              }}
              className="mt-3 text-sm font-bold text-indigo-600 hover:text-indigo-500"
            >
              Clear filters
            </button>
          </div>
        )}
        {visible.length > visiblePage.length && (
          <div className="mt-4 flex justify-center">
            <UIButton
              type="button"
              variant="secondary"
              onClick={() => setVisibleLimit((current) => current + PAGE_SIZE)}
            >
              Show more skills
            </UIButton>
          </div>
        )}
      </section>
    </div>
  );
};
