import React from "react";
import { ArrowRight, BookOpen, Flame, Star, Target, Zap } from "lucide-react";
import { getCourseLessons, isUnlocked, satisfiedConcepts } from "../curriculum";
import type { SkillCatalogEntry } from "../lib/skillCatalog";
import { buildCatalog } from "../skills/catalog";
import { recommendNow, type TodayPick } from "../lib/learning/recommend";
import { useSkillRegistrations } from "../lib/skillRegistrationApi";
import { useSkillCatalog } from "../lib/useSkillCatalog";
import { themeSystem } from "../lib/themeSystem";
import { useStreak } from "../lib/streak";
import { BADGE_METRICS, nextBadge, useBadges } from "../lib/badges";
import { levelFromXp, levelProgress, xpToNextLevel } from "../lib/level";
import { BadgeIcon } from "./account/BadgeVisuals";
import type { UserProgress } from "../types";
import { playSound } from "../utils/audio";
import { UIButton, UILessonCard, UISubjectRow } from "./ui";
import { SvgAsset } from "../assets/svg";

interface HomeProps {
  userProgress: UserProgress;
  completedLevels: Record<number, number>;
  onOpenSkill(skillId: string): void;
  onStartLesson(levelNumber: number): void;
  onBrowseSkills(): void;
}

/** Beyond this many subjects the list folds, so Home stays about one screen. */
const SUBJECTS_SHOWN = 6;

/** One line of the progress card: an icon well, a label and its number. */
const RailStat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3">
    <span className="w-12 h-12 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 [&>svg]:w-9 [&>svg]:h-9">
      {icon}
    </span>
    <span className="text-sm font-bold text-muted flex-1 min-w-0 truncate">{label}</span>
    <span className="font-mono font-black text-sm text-ink shrink-0">{value}</span>
  </div>
);

/**
 * The third column: everything that is *about* the learner rather than the
 * lesson they are on.
 *
 * It stacks under the path below `lg` rather than being hidden, so a phone
 * still shows the streak — it only stops being a column, not content.
 */
/**
 * The badge the learner is closest to, and how far off it is.
 *
 * The one borrowed idea from every app that keeps a child coming back: what
 * pulls somebody into another round is not the badges they have, it is seeing
 * that the next one is four stars away. Nothing here is new state — it is the
 * family's rules read against figures the rail is already printing.
 */
const NextBadge: React.FC<{ userProgress: UserProgress; starsEarned: number }> = ({
  userProgress,
  starsEarned,
}) => {
  const rules = useBadges();
  const next = nextBadge(rules, {
    xp: userProgress.xp,
    longestStreak: userProgress.longestStreak,
    starsEarned,
  });

  // Every badge won is a real state, not an empty one — so the rail says so
  // rather than printing a bar at 100% forever.
  if (!next) return null;

  const unit = BADGE_METRICS.find((m) => m.id === next.rule.metric)?.unit ?? "";
  const toGo = Math.max(0, next.rule.threshold - next.standing);

  return (
    <section className={`${themeSystem.card("default")} ${themeSystem.spacing.card}`}>
      <h2 className="font-mono font-black text-xs uppercase tracking-widest text-muted">
        Next badge
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl border border-line bg-surface-muted text-amber-500 flex items-center justify-center shrink-0">
          <BadgeIcon icon={next.rule.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-ink truncate">{next.rule.label}</p>
          <p className="text-xs text-muted">
            {toGo} {unit} to go
          </p>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-surface-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400 transition-all"
          style={{ width: `${Math.round(next.progress * 100)}%` }}
        />
      </div>
    </section>
  );
};

const HomeRail: React.FC<{
  userProgress: UserProgress;
  totalMastered: number;
  totalLessons: number;
  starsEarned: number;
}> = ({ userProgress, totalMastered, totalLessons, starsEarned }) => {
  // Read through the streak rule, not off the record: `dailySolved` belongs to
  // the day it was counted for, so an app opened the next morning shows today's
  // empty goal and a streak that has lapsed, without anything having run
  // overnight to reset them.
  const streak = useStreak(userProgress);
  const goal = Math.max(1, userProgress.dailyGoal);
  const percent = Math.min(100, Math.round((streak.solvedToday / goal) * 100));

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <section className={`${themeSystem.card("default")} ${themeSystem.spacing.card}`}>
        <h2 className="font-mono font-black text-xs uppercase tracking-widest text-muted">
          Your progress
        </h2>
        <div className="mt-3 space-y-3">
          {/* Hidden outright when a parent has switched streaks off — a flame
              frozen at zero is a broken feature, not a disabled one. */}
          {streak.config.enabled && (
            <RailStat
              icon={
                <SvgAsset
                  id="streak"
                  size={50}
                  title="Learning streak"
                  fallback={<Flame className="fill-current" />}
                />
              }
              label="Learning streak"
              /* The unit follows the cadence the view was produced with — a run
                 of three weeks printed as "3 days" is the whole reason the view
                 carries it. */
              value={`${streak.days} ${
                streak.cadence === "weekly"
                  ? streak.days === 1
                    ? "week"
                    : "weeks"
                  : streak.days === 1
                    ? "day"
                    : "days"
              }`}
            />
          )}
          <RailStat
            icon={
              <SvgAsset
                id="points"
                size={50}
                title="Total points"
                fallback={<Zap className="fill-current" />}
              />
            }
            label="Total points"
            value={`${userProgress.xp} XP`}
          />
          {/*
            * What the XP is for.
            *
            * Every hundred is another level, so the bar refills and the number
            * climbs for as long as a learner keeps playing — no last rung to
            * reach and no admin having to add one. It sits directly under the
            * XP it reads, because the two are one fact shown twice.
            */}
          <div className="pl-[3.75rem] -mt-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-muted">
                Level {levelFromXp(userProgress.xp)}
              </span>
              <span className="font-mono text-[0.6875rem] tabular-nums text-muted">
                {xpToNextLevel(userProgress.xp)} XP to level {levelFromXp(userProgress.xp) + 1}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.round(levelProgress(userProgress.xp) * 100)}%` }}
              />
            </div>
          </div>
          <RailStat
            icon={
              <SvgAsset
                id="star"
                size={50}
                title="Lessons mastered"
                fallback={<Star className="fill-current" />}
              />
            }
            label="Lessons mastered"
            value={`${totalMastered} / ${totalLessons}`}
          />
        </div>
      </section>

      <section className={`${themeSystem.card("default")} ${themeSystem.spacing.card}`}>
        <h2 className="font-mono font-black text-xs uppercase tracking-widest text-muted">
          Daily goal
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="w-11 h-11 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <SvgAsset
              id="daily-goal"
              size={50}
              title="Daily goal"
              fallback={<Target className="w-8 h-8" />}
            />
          </span>
          <p className="font-mono font-black text-lg text-ink">
            {streak.solvedToday} / {goal}
          </p>
          <p className="text-xs text-muted flex-1 min-w-0">
            {percent >= 100 ? "Goal met today" : "lessons today"}
          </p>
        </div>
        <div className="mt-3 h-2 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>

      <NextBadge userProgress={userProgress} starsEarned={starsEarned} />
    </aside>
  );
};

export const Home: React.FC<HomeProps> = ({
  userProgress,
  completedLevels,
  onOpenSkill,
  onStartLesson,
  onBrowseSkills,
}) => {
  const { skills, viewer } = useSkillCatalog(completedLevels);
  const { registrations } = useSkillRegistrations();
  const [showAllSubjects, setShowAllSubjects] = React.useState(false);

  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const registered = registrations
    .map((registration) => byId.get(registration.skillId))
    .filter((skill): skill is SkillCatalogEntry => Boolean(skill));

  const totalLessons = skills.reduce((total, skill) => total + skill.lessons.length, 0);
  const totalMastered = Object.values(completedLevels).filter((stars) => stars > 0).length;

  const lessons = getCourseLessons(viewer);
  const byRef = new Map(lessons.map((lesson) => [`${lesson.skillId}/${lesson.id}`, lesson]));
  const registeredIds = new Set(registered.map((skill) => skill.id));

  const completedRefs = new Set(
    lessons
      .filter((lesson) => (completedLevels[lesson.levelNumber] ?? 0) > 0)
      .map((lesson) => `${lesson.skillId}/${lesson.id}`),
  );

  /*
   * Today and the padlocks have to agree, so both are asked the same question.
   * `satisfiedConcepts` is the completion bar the learning path draws with, and
   * handing it to the recommender stops Today offering two lessons while the
   * map shows four open — or the reverse, which is worse.
   */
  const satisfied = satisfiedConcepts(completedLevels, viewer);
  const catalog = buildCatalog(viewer);
  const today: TodayPick[] = recommendNow(
    { ...catalog, lessons: catalog.lessons.filter((l) => registeredIds.has(l.skillId)) },
    {
      limit: 3,
      completed: completedRefs,
      isSatisfied: (conceptKey) => satisfied.has(conceptKey),
    },
  );

  const readyCountFor = (skillId: string): number =>
    lessons.filter(
      (lesson) =>
        lesson.skillId === skillId &&
        (completedLevels[lesson.levelNumber] ?? 0) === 0 &&
        isUnlocked(lesson, completedLevels, viewer),
    ).length;

  /* Something to do first, then whatever changed most recently. A subject with
     nothing open still appears — it is the learner's, not a suggestion. */
  const subjects = registered
    .map((skill) => ({ skill, ready: readyCountFor(skill.id) }))
    .sort((a, b) => b.ready - a.ready || (b.skill.modified ?? 0) - (a.skill.modified ?? 0));
  const visibleSubjects = showAllSubjects ? subjects : subjects.slice(0, SUBJECTS_SHOWN);

  if (!skills.length) {
    return (
      <div className="w-full flex-1 min-h-[50vh] flex items-center justify-center text-center">
        <div className="max-w-sm">
          <BookOpen className="w-10 h-10 mx-auto text-indigo-500" />
          <p className="mt-3 font-mono font-black text-ink">No skills available</p>
          <p className="mt-1 text-sm text-muted">
            No published, enabled skills currently match this learner.
          </p>
        </div>
      </div>
    );
  }

  const start = (ref: string) => {
    const lesson = byRef.get(ref);
    if (!lesson) return;
    playSound("pop");
    onStartLesson(lesson.levelNumber);
  };

  const open = (skillId: string) => {
    playSound("pop");
    onOpenSkill(skillId);
  };

  return (
    /* Column 1 is the app shell's sidebar; this is columns 2 and 3. Neither
       band grows with the lesson count — Today is capped, and the subject list
       grows with the number of skills, which is a small number. */
    <div className="w-full animate-fadeIn pb-6 grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className={themeSystem.spacing.section}>
        {registered.length ? (
          <>
            <section>
              <h1 className="font-mono font-black uppercase tracking-widest text-xs text-indigo-600">
                Today
              </h1>

              {today.length ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {today.map((pick) => {
                    const lesson = byRef.get(pick.lesson.ref);
                    return (
                      <UILessonCard
                        key={pick.lesson.ref}
                        title={pick.lesson.title}
                        subject={byId.get(pick.lesson.skillId)?.name ?? pick.lesson.skillId}
                        message={pick.kidMessage}
                        iconName={lesson?.iconName}
                        iconTone={lesson?.iconTone}
                        tone={pick.kind}
                        onClick={() => start(pick.lesson.ref)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p
                  className={`mt-3 ${themeSystem.card("default")} ${themeSystem.spacing.card} text-sm text-muted`}
                >
                  Everything open right now is finished. Pick a subject below to play it
                  again, or add another skill.
                </p>
              )}
            </section>

            <section>
              <h2 className="font-mono font-black uppercase tracking-widest text-xs text-muted">
                Your subjects
              </h2>

              <div className="mt-3 space-y-2.5">
                {visibleSubjects.map(({ skill, ready }) => (
                  <UISubjectRow
                    key={skill.id}
                    name={skill.name}
                    thumbnail={skill.thumbnail}
                    fallbackIconName={skill.iconName}
                    category={skill.category}
                    completedLessons={skill.completedLessons}
                    totalLessons={skill.lessons.length}
                    readyCount={ready}
                    onClick={() => open(skill.id)}
                  />
                ))}
              </div>

              {subjects.length > SUBJECTS_SHOWN && (
                <UIButton
                  className="mt-3"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAllSubjects((shown) => !shown)}
                >
                  {showAllSubjects ? "Show fewer" : `Show all ${subjects.length} subjects`}
                </UIButton>
              )}
            </section>
          </>
        ) : (
          <div className={`${themeSystem.card("default")} p-6 sm:p-8 text-center`}>
            <BookOpen className="w-11 h-11 mx-auto text-indigo-500" />
            <h1 className="mt-3 font-mono font-black text-lg text-ink">Build your learning list</h1>
            <p className="mt-1 text-sm text-muted max-w-md mx-auto">
              Browse the skill catalog and add the skills you want to learn. What to do next
              appears here.
            </p>
            <UIButton className="mt-4" iconRight={<ArrowRight />} onClick={onBrowseSkills}>
              Browse skills
            </UIButton>
          </div>
        )}
      </div>

      <HomeRail
        userProgress={userProgress}
        starsEarned={Object.values(completedLevels).reduce((total, stars) => total + stars, 0)}
        totalMastered={totalMastered}
        totalLessons={totalLessons}
      />
    </div>
  );
};
