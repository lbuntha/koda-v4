import React, { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, Play, Sparkles } from "lucide-react";
import { getCourseUnits, getSkillLessons, isUnlocked, resumeLesson } from "../curriculum";
import { SkillRegistryAPI } from "../lib/skillRegistryApi";
import { useSkillRegistrations } from "../lib/skillRegistrationApi";
import { useInstalledSkills } from "../lib/skillStore";
import { getSkill } from "../skills/registry";
import { useAudienceViewer } from "../skills/viewer";
import { playSound } from "../utils/audio";
import { themeSystem } from "../lib/themeSystem";
import {
  UIBadge,
  UIButton,
  UISkillPath,
  UISkillThumbnail,
  UIUnitHeader,
  skillArtFor,
  unitColor,
  type UISkillPathItem,
} from "./ui";

export interface LearnPageProps {
  skillId: string;
  /** Star counts for the whole course, keyed by level — not just this skill. */
  completedLevels: Record<number, number>;
  onBack(): void;
  onStartLesson(levelNumber: number): void;
}

/**
 * The course names its units "Unit 1: Subitizing & Dot Matrix". The eyebrow
 * above the title already says which unit this is, so the prefix would be the
 * same words twice on two consecutive lines.
 */
const unitTitle = (title: string): string => title.replace(/^Unit\s*\d+\s*[:.\-\u2013]\s*/i, "");

export const LearnPage: React.FC<LearnPageProps> = ({
  skillId,
  completedLevels,
  onBack,
  onStartLesson,
}) => {
  const viewer = useAudienceViewer();
  const installed = useInstalledSkills();
  const { registeredIds, register } = useSkillRegistrations();
  const [registering, setRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const skill = getSkill(skillId);
  const lessons = useMemo(() => getSkillLessons(skillId, viewer), [skillId, viewer]);
  /*
   * Units come from the course, not the skill: `course.json` owns sequencing and
   * a unit may mix lessons from several skills, so each one is narrowed to what
   * this skill teaches and any left empty is dropped.
   */
  const units = useMemo(
    () =>
      getCourseUnits(viewer)
        .map((unit) => ({
          ...unit,
          lessons: unit.lessons.filter((lesson) => lesson.skillId === skillId),
        }))
        .filter((unit) => unit.lessons.length > 0),
    [skillId, viewer],
  );

  if (!skill || !lessons.length) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center text-center">
        <div>
          <BookOpen className="w-10 h-10 mx-auto text-indigo-500" />
          <h1 className="mt-3 font-mono font-black text-xl text-ink">Skill unavailable</h1>
          <p className="mt-1 text-sm text-muted">
            This skill is no longer available for the current learner.
          </p>
          <UIButton className="mt-4" variant="secondary" icon={<ArrowLeft />} onClick={onBack}>
            All skills
          </UIButton>
        </div>
      </div>
    );
  }

  const listing = installed.find((entry) => entry.id === skillId);
  const server = SkillRegistryAPI.get(skillId);
  const starsFor = (lesson: { levelNumber: number }) => completedLevels[lesson.levelNumber] ?? 0;
  const done = lessons.filter((lesson) => starsFor(lesson) > 0).length;
  const percent = Math.round((done / lessons.length) * 100);
  const finished = done === lessons.length;

  /*
   * Where "Continue" goes — and, on the path below, which stone wears the
   * bubble. Both used to read the app's `activeLevelNumber`, which is the level
   * the Learn tab last opened and starts life at 1. On a page for a skill the
   * learner is eight lessons into, and on every page for a skill that is not
   * the one they last played, that pointed the bubble at lesson 1: "Continue"
   * on something already finished. A learner with several skills on the go got
   * that on all but one of them.
   *
   * Answered from this skill's own progress instead — `resumeLesson` states the
   * rule, and shares it with anything else that has to ask.
   */
  const next = resumeLesson(lessons, completedLevels, viewer);
  /* The button always has somewhere to go, even when the path has nothing left
     to unlock: a finished skill reopens its last lesson as revision. */
  const resume = next ?? lessons[lessons.length - 1];
  const category = skill.manifest.audience.category;
  const art = skillArtFor(category);
  const registered = viewer.showAllSkills || registeredIds.has(skillId);

  const start = (levelNumber: number) => {
    if (!registered) return;
    playSound("pop");
    onStartLesson(levelNumber);
  };

  const add = async () => {
    setRegistering(true);
    setRegistrationError(null);
    try {
      await register(skillId);
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : "Could not register this skill.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className={themeSystem.spacing.section}>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-indigo-600 transition"
      >
        <ArrowLeft className="w-4 h-4" /> All skills
      </button>

      <section className={`${themeSystem.card("default")} overflow-hidden`}>
        <div className="p-5 sm:p-7 flex flex-col md:flex-row md:items-center gap-5">
          <UISkillThumbnail
            thumbnail={listing?.thumbnail ?? skill.manifest.thumbnail}
            fallbackIconName={skill.manifest.iconName}
            category={category}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <UIBadge variant="primary">{art.label}</UIBadge>
              <UIBadge variant="neutral">
                Ages {skill.manifest.audience.ages[0]}–{skill.manifest.audience.ages[1]}
              </UIBadge>
              {server?.status === "draft" && <UIBadge variant="warning">Draft preview</UIBadge>}
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-ink">
              {skill.manifest.name}
            </h1>
            <p className="mt-2 text-base text-muted max-w-2xl">
              {listing?.tagline ?? skill.manifest.tagline ?? skill.manifest.description}
            </p>
            <p className="mt-2 text-xs font-mono font-bold text-muted">
              by {skill.manifest.author} · v{skill.manifest.version} · {lessons.length} lessons
            </p>

            <div className="mt-5 max-w-xl">
              <div className="flex justify-between text-xs font-mono font-bold text-muted mb-1.5">
                <span>{done ? `${done} of ${lessons.length} lessons complete` : "Ready to begin"}</span>
                <span>{percent}%</span>
              </div>
              <div
                className="h-2 rounded-full bg-surface-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${skill.manifest.name} progress`}
              >
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {/* Which lesson the button opens. "Continue" on its own says
                  nothing, and a learner juggling several skills cannot tell
                  from the label alone where any one of them left off. */}
              {registered && (
                <p className="mt-2 text-xs text-muted">
                  {next ? (
                    <>
                      Up next: <span className="font-bold text-ink">{next.title}</span>
                    </>
                  ) : (
                    <>Every lesson complete — play any of them again.</>
                  )}
                </p>
              )}
            </div>
          </div>
          <UIButton
            size="lg"
            icon={<Play />}
            isLoading={registering}
            onClick={registered ? () => start(resume.levelNumber) : () => void add()}
          >
            {!registered
              ? "Register skill"
              : finished
                ? "Review"
                : done
                  ? "Continue"
                  : "Start learning"}
          </UIButton>
        </div>
      </section>

      {registrationError && <p className={themeSystem.flash("error")}>{registrationError}</p>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
        <section className={`${themeSystem.card("default")} p-5 sm:p-6`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-ink">Learning path</h2>
              <p className="mt-0.5 text-sm text-muted">
                Finish each lesson to unlock the next challenge.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-6">
            {units.map((unit) => {
              const unitDone = unit.lessons.filter((lesson) => starsFor(lesson) > 0).length;
              const items: UISkillPathItem[] = unit.lessons.map((lesson) => {
                const stars = starsFor(lesson);
                const locked = !registered || !isUnlocked(lesson, completedLevels, viewer);
                return {
                  id: lesson.ref,
                  title: lesson.title,
                  icon: lesson.icon,
                  stars,
                  state: locked
                    ? "locked"
                    : lesson.ref === next?.ref
                      ? "current"
                      : stars > 0
                        ? "completed"
                        : "available",
                };
              });

              return (
                <section key={unit.id}>
                  {/* The count rides in the eyebrow rather than as a badge on
                      the right: it is the same fact the bar at the top of the
                      page states, and a second pill on every unit is clutter
                      once a course runs to four or five of them. Units are
                      counted over this skill's lessons only — a unit may also
                      hold lessons from skills the learner has not registered,
                      and those are not this page's to report on. */}
                  <UIUnitHeader
                    eyebrow={`Unit ${unit.unitNumber} · ${unitDone}/${unit.lessons.length} done`}
                    title={unitTitle(unit.title)}
                    color={unitColor(unit.unitNumber)}
                  />
                  <UISkillPath
                    items={items}
                    startLabel={done ? "Continue" : "Start"}
                    onSelect={(ref) => {
                      const lesson = unit.lessons.find((l) => l.ref === ref);
                      if (lesson) start(lesson.levelNumber);
                    }}
                  />
                </section>
              );
            })}
          </div>
        </section>

        <aside className={`${themeSystem.card("default")} p-5`}>
          <h2 className="font-mono font-black text-sm text-ink">What you’ll learn</h2>
          <p className="mt-2 text-sm text-muted leading-relaxed">{skill.manifest.description}</p>
          <ul className="mt-4 space-y-2.5">
            {lessons.slice(0, 5).map((lesson) => (
              <li key={lesson.ref} className="flex items-start gap-2 text-xs text-muted">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{lesson.concept}</span>
              </li>
            ))}
          </ul>
          {lessons.length > 5 && (
            <p className="mt-3 text-xs font-mono font-bold text-indigo-600">
              +{lessons.length - 5} more outcomes
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};
