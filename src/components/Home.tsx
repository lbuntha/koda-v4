import React from "react";
import { ArrowRight, BookOpen, Flame, Star, Target, Zap } from "lucide-react";
import { getCourseLessons, isUnlocked, practiceTitle, satisfiedConcepts } from "../curriculum";
import type { SkillCatalogEntry } from "../lib/skillCatalog";
import { buildCatalog } from "../skills/catalog";
import { recommendNow, type TodayPick } from "../lib/learning/recommend";
import { PracticeProgressAPI } from "../lib/practiceProgress";
import { useSkillRegistrations } from "../lib/skillRegistrationApi";
import { useSkillCatalog } from "../lib/useSkillCatalog";
import { themeSystem } from "../lib/themeSystem";
import { useStreak } from "../lib/streak";
import { BADGE_METRICS, nextBadge, useBadges } from "../lib/badges";
import { levelFromXp, levelProgress, xpToNextLevel } from "../lib/level";
import { BadgeIcon } from "./account/BadgeVisuals";
import type { UserProgress } from "../types";
import { playSound } from "../utils/audio";
import { UIButton, UILessonCard, UISkillCard } from "./ui";
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
/**
 * The rail's icon slot: a drawn mark at 48px, standing on nothing.
 *
 * Shared by the stats and the next badge so the two cannot drift apart — they
 * sit one above the other in the same column, and a badge in a bordered tile
 * beside a bare streak flame read as two designs stacked rather than one rail.
 * The `[&>svg]` sizes are for the lucide fallbacks; the drawn artwork takes its
 * own `size`.
 */
const RAIL_ICON =
  "w-12 h-12 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 [&>svg]:w-9 [&>svg]:h-9";

const RailStat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3">
    <span className={RAIL_ICON}>
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
        {/* No tile, and the mark at the same 50px the streak and the points
            wear directly above it. It was a 20px glyph adrift in a bordered
            44px box: the badge is the reason to look at this card and it was
            the smallest thing on it, while the box itself was packaging no
            other row in the rail has. */}
        <span className={RAIL_ICON}>
          <BadgeIcon icon={next.rule.icon} size={50} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-ink truncate">{next.rule.label}</p>
          <p className="text-xs text-muted">
            {toGo} {unit} to go
          </p>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-surface-muted overflow-hidden">
        {/* Indigo, like the level bar it sits under. Amber was the only one of
            its colour in the column, which made "how close am I" look like two
            unrelated measures rather than one rail. */}
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
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
          <span className="w-11 h-11 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
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
        {/* Indigo, for the reason the badge bar below already gives: amber was
            the only one of its colour in this column, which made "how close am
            I" look like two unrelated measures rather than one rail. That fix
            reached the badge bar and stopped there. */}
        <div className="mt-3 h-2 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
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
      /* The band holds three. An unfinished run takes one of those places
         rather than adding a fourth, so Today stays a short list of choices
         instead of growing every time a round is interrupted. */
      limit: 3,
      completed: completedRefs,
      isSatisfied: (conceptKey) => satisfied.has(conceptKey),
    },
  );

  /*
   * A practice run the child walked away from part-way.
   *
   * Not routed through the recommender: the ladder decides what a child should
   * do next from what they have mastered, and this is not that question. It is
   * work the child started and the app is holding for them, which outranks any
   * suggestion — so it is offered first, and it is the only practice that
   * appears on this band at all.
   *
   * Read on every render rather than memoised: it changes while the child is
   * inside a lesson, and this page is what they come back to.
   */
  const byLevel = new Map(lessons.map((lesson) => [lesson.levelNumber, lesson]));
  const interrupted = PracticeProgressAPI.all()
    .map((saved) => ({ saved, lesson: byLevel.get(saved.levelNumber) }))
    .find(
      (entry): entry is { saved: (typeof entry)["saved"]; lesson: NonNullable<(typeof entry)["lesson"]> } =>
        /* A skill the learner has since un-registered, or one now out of their
           age band, leaves a saved position with no lesson behind it. */
        entry.lesson !== undefined && registeredIds.has(entry.lesson.skillId),
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

  /*
   * The same concept, offered twice.
   *
   * A half-finished practice round and the lesson that teaches the concept it
   * practises are two different lessons with, after the word "Practice" comes
   * off, the same name — so the band read "Number Bonds … Number Bonds" with
   * two different reasons attached. The unfinished round wins: it is work the
   * child started, and the suggestion was going to be about the same thing.
   */
  const suggestions = interrupted
    ? today.filter((pick) => pick.lesson.conceptKey !== interrupted.lesson.conceptKey)
    : today;

  /* Wide enough to fill the top row where three cards would otherwise leave an
     orphan, and back to one column where all three fit in a row. */
  const leadSpan = "sm:col-span-2 xl:col-span-1";

  /*
   * What leads the band.
   *
   * The child's own unfinished round if there is one — that is not a suggestion
   * and outranks every suggestion. Otherwise the recommender's own first pick:
   * `recommendNow` returns repair, then finish-what-is-started, then something
   * new, so first is already an answer to "what now?" rather than an arbitrary
   * card. Only the lead carries the progress bar, because it is the only one
   * with progress to report.
   */
  const leadPick = interrupted ? undefined : suggestions[0];
  const leadLesson = leadPick ? byRef.get(leadPick.lesson.ref) : undefined;

  const lead = interrupted ? (
    <UILessonCard
      key={`resume-${interrupted.saved.levelNumber}`}
      className={leadSpan}
      title={practiceTitle(interrupted.lesson.title)}
      subject={byId.get(interrupted.lesson.skillId)?.name ?? interrupted.lesson.skillId}
      progress={{ answered: interrupted.saved.answered, total: interrupted.saved.total }}
      iconName={interrupted.lesson.iconName}
      iconTone={interrupted.lesson.iconTone}
      tone="resume"
      actionLabel="Carry on"
      onClick={() => {
        playSound("pop");
        onStartLesson(interrupted.lesson.levelNumber);
      }}
    />
  ) : leadPick ? (
    <UILessonCard
      key={leadPick.lesson.ref}
      className={leadSpan}
      title={leadPick.lesson.title}
      subject={byId.get(leadPick.lesson.skillId)?.name ?? leadPick.lesson.skillId}
      message={leadPick.kidMessage}
      iconName={leadLesson?.iconName}
      iconTone={leadLesson?.iconTone}
      tone={leadPick.kind}
      onClick={() => start(leadPick.lesson.ref)}
    />
  ) : null;

  /* Two, so the band is three things whichever way it was filled. A single
     lead with nothing beside it is left as it is: one thing to do is a clearer
     message than one thing plus filler. */
  const rest = (interrupted ? suggestions : suggestions.slice(1)).slice(0, 2);

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

              {today.length || interrupted ? (
                /*
                 * One first thing, then the alternatives.
                 *
                 * The band has a first item — the child's own unfinished round,
                 * or, failing that, whatever `recommendNow` ranked first, which
                 * is already an order (repair, then finish, then something new).
                 * Drawing all three identically hid that, and on a phone it cost
                 * the whole screen: three full-width purple buttons, the same
                 * loudness three times, with the subject list pushed off the
                 * bottom. The lead card keeps the full treatment; the rest go
                 * `compact`, which is a row below 640px and the same card above
                 * it.
                 *
                 * `sm:col-span-2 xl:col-span-1` is the middle width's fix: three
                 * cards into two columns leaves a 2+1 orphan with a hole beside
                 * it, so the lead fills the top row instead. At three columns
                 * they are back to an even row and nothing spans anything.
                 */
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {lead}
                  {rest.map((pick) => {
                    const lesson = byRef.get(pick.lesson.ref);
                    return (
                      <UILessonCard
                        key={pick.lesson.ref}
                        variant="compact"
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
                  <UISkillCard
                    key={skill.id}
                    size="sm"
                    title={skill.name}
                    thumbnail={skill.thumbnail}
                    fallbackIconName={skill.iconName}
                    category={skill.category}
                    completedLessons={skill.completedLessons}
                    lessonCount={skill.lessons.length}
                    readyCount={ready}
                    onOpen={() => open(skill.id)}
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
