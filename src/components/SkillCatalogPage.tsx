import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { filterSkillCatalog, learnOrder } from "../lib/skillCatalog";
import { useSkillCatalog } from "../lib/useSkillCatalog";
import { useSkillRegistrations } from "../lib/skillRegistrationApi";
import { refreshSkillRegistry } from "../lib/skillRegistryApi";
import { playSound } from "../utils/audio";
import { offlineMessage, useOfflineDownload } from "../lib/offlineSkill";
import { themeSystem } from "../lib/themeSystem";
import { useIsCompact } from "../lib/useBreakpoint";
import { UIBadge, UIButton, UIPageHeader, UISkillCard } from "./ui";
import { subjectForSkill, useSubjects } from "../lib/subjects";
import { refreshSystem } from "../lib/sync/system";

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
/** A phone gets rows; a poster grid needs width to be a grid at all. */
const ROW_LIST = "space-y-2.5";

export const SkillCatalogPage: React.FC<SkillCatalogPageProps> = ({
  activeLevelNumber,
  completedLevels,
  onSelectSkill,
}) => {
  const { skills, viewer } = useSkillCatalog(completedLevels);
  const subjects = useSubjects();
  const { registeredIds, register } = useSkillRegistrations();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const { progress: offline, prepare } = useOfflineDownload();
  const [offlineSkillId, setOfflineSkillId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const categories = useMemo(
    () => subjects.subjects,
    [subjects],
  );
  useEffect(() => {
    if (category !== "all" && !categories.some((subject) => subject.id === category)) {
      setCategory("all");
      setVisibleLimit(PAGE_SIZE);
    }
  }, [categories, category]);
  const visible = useMemo(
    () => filterSkillCatalog(skills, query, "all").filter((skill) => category === "all" || subjectForSkill(subjects, skill.id)?.id === category),
    [category, query, skills, subjects],
  );
  const resume =
    skills.find(
      (skill) =>
        skill.completedLessons > 0 &&
        skill.progressPercent < 100 &&
        skill.lessons.some((lesson) => lesson.levelNumber === activeLevelNumber),
    ) ?? skills.find((skill) => skill.completedLessons > 0 && skill.progressPercent < 100);
  const compact = useIsCompact();
  const unfiltered = !query && category === "all";
  const showResume = unfiltered && Boolean(resume);

  /*
   * One shelf, in the order a learner would put it in themselves.
   *
   * There used to be a "Recommended for you" section above this one. It is
   * gone: the app never fed it the server signals it sorted on, so it was
   * ranking by raw progress under a heading that claimed to know better, and
   * the same cards then appeared again a scroll further down. What is left is
   * an order rather than a claim — what is on the go first, then whatever
   * changed most recently, with finished skills last. See `learnOrder`.
   *
   * Only the resume card is held back, because it is already on screen above.
   * A filtered view is a different question ("show me everything matching"), so
   * it lists everything.
   */
  const browse = learnOrder(unfiltered ? visible.filter((skill) => skill.id !== resume?.id) : visible);
  const shownAbove = new Set(showResume && resume ? [resume.id] : []);
  const visiblePage = browse.slice(0, visibleLimit);

  const open = (skillId: string) => {
    playSound("pop");
    onSelectSkill(skillId);
  };

  /*
   * Adding a skill, then making it work on a train.
   *
   * Two steps rather than one, and the second is the one that used to be
   * invisible: enrolling is a row on the server, and it downloads nothing,
   * because a skill's lessons and artwork are already in the app bundle. Its
   * recorded voice is not — that caches as a child plays — so a skill added at
   * home and opened in the car spoke in the browser's voice with nothing having
   * warned anybody. Now it is a step with a count and an end.
   *
   * The download is not allowed to fail the add. A child is enrolled either
   * way; what a dropped connection costs is Koda's voice, and offering the
   * download again next time is a better answer than refusing the skill.
   */
  const add = async (skillId: string) => {
    setRegistrationError(null);
    setRegisteringId(skillId);
    try {
      await register(skillId);
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : "Could not add this skill.");
      return;
    } finally {
      setRegisteringId(null);
    }
    setOfflineSkillId(skillId);
    await prepare(skillId);
  };

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshSkillRegistry();
      await refreshSystem();
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
          className={themeSystem.field("lg", "w-full rounded-2xl py-3 pl-11 pr-4")}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Skill subjects">
        {[{ id: "all", name: "For you" }, ...categories].map(({ id: value, name }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setCategory(value);
              setVisibleLimit(PAGE_SIZE);
            }}
            aria-pressed={category === value}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-mono font-black border-2 transition pointer-coarse:min-h-11 ${
              category === value
                ? "bg-indigo-600 border-indigo-700 text-white"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-muted hover:border-indigo-300"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {registrationError && <p className={themeSystem.flash("error")}>{registrationError}</p>}

      {/* Said where the skill was added from, so the step belongs to the thing
          the child just tapped rather than appearing as a system message. */}
      {offlineSkillId && offlineMessage(offline) && (
        <p
          aria-live="polite"
          className={themeSystem.flash(offline.state === "incomplete" ? "warning" : "info")}
        >
          {skills.find((skill) => skill.id === offlineSkillId)?.name ?? "This skill"} —{" "}
          {offlineMessage(offline)}
        </p>
      )}

      {/* The same card the grid below uses, one size up — this was thirty-five
          lines of hand-built banner with its own progress bar, which is exactly
          the duplication the size scale exists to remove. */}
      {showResume && resume && (
        <UISkillCard
          size="lg"
          eyebrow="Continue learning"
          title={resume.name}
          tagline={resume.tagline}
          thumbnail={resume.thumbnail}
          fallbackIconName={resume.iconName}
          category={resume.category}
          lessonCount={resume.lessons.length}
          completedLessons={resume.completedLessons}
          progressPercent={resume.progressPercent}
          actionLabel="Open skill"
          onOpen={() => open(resume.id)}
        />
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-black text-lg text-ink">
              {!unfiltered ? "Search results" : shownAbove.size ? "More skills" : "All skills"}
            </h2>
            <p className="text-xs text-muted">
              {browse.length} {browse.length === 1 ? "skill" : "skills"}
            </p>
          </div>
          {skills.every((skill) => skill.progressPercent === 100) && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> All complete
            </span>
          )}
        </div>
        {browse.length ? (
          <div className={compact ? ROW_LIST : CARD_GRID}>
            {visiblePage.map((skill) => (
              <UISkillCard
                key={skill.id}
                size={compact ? "sm" : "md"}
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
        ) : unfiltered ? (
          /* Everything this learner has is already on screen above. Saying "no
             matching skills" under it would read as the library being empty. */
          <p className="text-sm text-muted">
            That is every skill available to this learner.
          </p>
        ) : (
          <div className={`${themeSystem.card("default")} p-8 text-center`}>
            <p className="font-mono font-black text-ink">No matching skills</p>
            <p className="mt-1 text-sm text-muted">Try another search or category.</p>
            <UIButton
              className="mt-3"
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setVisibleLimit(PAGE_SIZE);
              }}
            >
              Clear filters
            </UIButton>
          </div>
        )}
        {browse.length > visiblePage.length && (
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
