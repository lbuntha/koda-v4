import React, { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, Repeat, Sparkles } from "lucide-react";
import {
  type CourseUnit,
  type ResolvedLesson,
  getCourseUnits,
  getSkillLessons,
  isPracticeLesson,
  isUnlocked,
  practiceTitle,
  resumeLesson,
} from "../curriculum";
import { SkillRegistryAPI } from "../lib/skillRegistryApi";
import { useSkillRegistrations } from "../lib/skillRegistrationApi";
import { skillTitle, useInstalledSkills } from "../lib/skillStore";
import { getSkill } from "../skills/registry";
import { useAudienceViewer } from "../skills/viewer";
import { playSound } from "../utils/audio";
import { themeSystem } from "../lib/themeSystem";
import { offlineMessage, useOfflineDownload } from "../lib/offlineSkill";
import {
  UIBadge,
  UIButton,
  UISkillCard,
  UISkillPath,
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

/** The icon-and-two-lines heading that opens each section of the path. */
const SectionIntro: React.FC<{
  icon: React.ReactNode;
  /** Background and text utilities for the icon tile. */
  tint: string;
  title: string;
  blurb: string;
}> = ({ icon, tint, title, blurb }) => (
  <div className="flex items-start gap-3">
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${tint}`}>
      {icon}
    </div>
    <div>
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{blurb}</p>
    </div>
  </div>
);

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
  const { progress: offline, prepare } = useOfflineDownload();
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

  /*
   * Teaching and practice are two different offers, so they are two sections.
   *
   * A practice lesson is not the next step after the one above it — it is the
   * whole engine again with the hints, the voice and the explanations removed,
   * for a child who already has the technique. Left in the one column it read
   * as four more units at the end of the path, which invites a learner to grind
   * through them in order, and buries the thing a returning child is actually
   * looking for at the bottom of eighteen units of scrolling.
   *
   * Split per lesson rather than per unit: today every practice unit is wholly
   * practice, and a unit that later mixes the two still lands on the right side
   * instead of being classified by its majority.
   *
   * The practice half is flattened. The course files it under four units purely
   * because the course is one flat list and units are the only container it
   * has — but "Unit 18: Practice — Counting and Frames" is not a stage anybody
   * works through, and numbering them implies an order that does not exist.
   * They are one set covering every technique, so they are shown as one.
   */
  const { teaching, practice } = useMemo(() => {
    const teaching: CourseUnit[] = [];
    const practice: ResolvedLesson[] = [];
    for (const unit of units) {
      const taught = unit.lessons.filter((lesson) => !isPracticeLesson(lesson));
      if (taught.length) teaching.push({ ...unit, lessons: taught });
      practice.push(...unit.lessons.filter(isPracticeLesson));
    }
    return { teaching, practice };
  }, [units]);

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
  const finished = done === lessons.length;
  const practiceDone = practice.filter((lesson) => starsFor(lesson) > 0).length;

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
     to unlock: a finished skill reopens its last lesson as revision. Its last
     *teaching* lesson — the fallback used to be the last lesson in the list,
     which is practice, so a learner who finished the path was handed practice
     by the one control on the page that is not asking them to choose. */
  const taught = teaching.flatMap((unit) => unit.lessons);
  const resume = next ?? taught[taught.length - 1] ?? lessons[lessons.length - 1];
  const category = skill.manifest.audience.category;
  const art = skillArtFor(category);
  const registered = viewer.showAllSkills || registeredIds.has(skillId);

  const start = (levelNumber: number) => {
    if (!registered) return;
    playSound("pop");
    onStartLesson(levelNumber);
  };

  /*
   * One unit as a headed path. Shared by both sections so the stones, the
   * locking and the star badges cannot drift apart between them — the only
   * difference is the wording above them.
   */
  const pathFor = (group: ResolvedLesson[], opts: { practice?: boolean } = {}) => {
    const items: UISkillPathItem[] = group.map((lesson) => {
      const stars = starsFor(lesson);
      const locked = !registered || !isUnlocked(lesson, completedLevels, viewer);
      return {
        id: lesson.ref,
        title: opts.practice ? practiceTitle(lesson.title) : lesson.title,
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
      <UISkillPath
        items={items}
        startLabel={done ? "Continue" : "Start"}
        onSelect={(ref) => {
          const lesson = group.find((l) => l.ref === ref);
          if (lesson) start(lesson.levelNumber);
        }}
      />
    );
  };

  const unitPath = (unit: CourseUnit) => {
    const unitDone = unit.lessons.filter((lesson) => starsFor(lesson) > 0).length;

    return (
      <section key={unit.id}>
        {/* The count rides in the eyebrow rather than as a badge on the right:
            it is the same fact the bar at the top of the page states, and a
            second pill on every unit is clutter once a course runs to four or
            five of them. Units are counted over this skill's lessons only — a
            unit may also hold lessons from skills the learner has not
            registered, and those are not this page's to report on. */}
        <UIUnitHeader
          eyebrow={`Unit ${unit.unitNumber} · ${unitDone}/${unit.lessons.length} done`}
          title={unitTitle(unit.title)}
          color={unitColor(unit.unitNumber)}
        />
        {pathFor(unit.lessons)}
      </section>
    );
  };

  /* Enrol, then put the skill's voice on the device. See the note in
     `SkillCatalogPage`: the lesson is already offline, the voice is not, and a
     failed download must not cost the child the skill. */
  const add = async () => {
    setRegistering(true);
    setRegistrationError(null);
    try {
      await register(skillId);
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : "Could not register this skill.");
      return;
    } finally {
      setRegistering(false);
    }
    await prepare(skillId);
  };

  return (
    <div className={themeSystem.spacing.section}>
      {/* The shared button, not a hand-rolled text link. It used to be an
          `inline-flex` with no padding at all: about 20px high, which is fine
          under a mouse and not a target a thumb can hit. `ghost` keeps the
          light look it had; the size token brings the padding, the focus ring
          and the touch floor with it. */}
      <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
        All skills
      </UIButton>

      {/*
        * The shared skill card at `lg`, not a fifth hand-built header.
        *
        * What is genuinely this page's own — the age band, the author and
        * version line, and which lesson Continue opens — arrives through the
        * card's slots. Everything the four surfaces had in common, and had each
        * rebuilt slightly differently, now comes from one place: the artwork
        * frame, the title scale, the progress bar and the action button.
        */}
      <UISkillCard
        size="lg"
        title={skillTitle(skill.manifest.name, listing)}
        tagline={listing?.tagline ?? skill.manifest.tagline ?? skill.manifest.description}
        thumbnail={listing?.thumbnail ?? skill.manifest.thumbnail}
        fallbackIconName={skill.manifest.iconName}
        category={category}
        lessonCount={lessons.length}
        completedLessons={done}
        registered={registered}
        registering={registering}
        badges={
          <>
            <UIBadge variant="primary">{art.label}</UIBadge>
            <UIBadge variant="neutral">
              Ages {skill.manifest.audience.ages[0]}–{skill.manifest.audience.ages[1]}
            </UIBadge>
            {server?.status === "draft" && <UIBadge variant="warning">Draft preview</UIBadge>}
          </>
        }
        meta={`by ${skill.manifest.author} · v${skill.manifest.version} · ${lessons.length} lessons`}
        footnote={
          registered ? (
            next ? (
              <>
                Up next: <span className="font-bold text-ink">{next.title}</span>
              </>
            ) : practice.length > practiceDone ? (
              /* The teaching is done and practice is not. Said as an invitation
                 rather than as the next step, because that is what practice is:
                 nothing above points a learner into it, so this is where they
                 find out it is there. */
              <>Every lesson complete — practice is open below whenever you want it.</>
            ) : (
              <>Every lesson complete — play any of them again.</>
            )
          ) : undefined
        }
        actionLabel={
          !registered ? "Register skill" : finished ? "Review" : done ? "Continue" : "Start learning"
        }
        onOpen={() => start(resume.levelNumber)}
        onRegister={() => void add()}
      />

      {registrationError && <p className={themeSystem.flash("error")}>{registrationError}</p>}

      {offlineMessage(offline) && (
        <p
          aria-live="polite"
          className={themeSystem.flash(offline.state === "incomplete" ? "warning" : "info")}
        >
          {offlineMessage(offline)}
        </p>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
        <section className={`${themeSystem.card("default")} p-5 sm:p-6`}>
          <SectionIntro
            icon={<Sparkles className="w-5 h-5" />}
            tint="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600"
            title="Learning path"
            blurb="Finish each lesson to unlock the next challenge."
          />

          <div className="mt-4 space-y-6">{teaching.map((unit) => unitPath(unit))}</div>

          {practice.length > 0 && (
            /* Its own heading behind a rule, inside the same card: practice is a
               second way into this skill, not a second skill. The rule is what
               stops the path reading as if it simply carries on. */
            <div className="mt-8 pt-6 border-t border-line">
              <SectionIntro
                icon={<Repeat className="w-5 h-5" />}
                tint="bg-violet-50 dark:bg-violet-950/50 text-violet-600"
                title="Practice"
                blurb="The same activities with the hints, voice and explanations taken away — for when you already know the technique. Open any of them, in any order."
              />

              <div className="mt-4">
                <UIUnitHeader
                  eyebrow={`Practice · ${practiceDone}/${practice.length} done`}
                  title="All techniques"
                  color="bg-violet-600"
                />
                {pathFor(practice, { practice: true })}
              </div>
            </div>
          )}
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
