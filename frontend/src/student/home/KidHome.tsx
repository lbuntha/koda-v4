import React from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Flame,
  Home,
  LogOut,
  Sparkles,
  Star,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../../components/ui";
import { resolveTechniqueThumbnail } from "../../techniques";
import type { CompletedCourseItem, CourseQueueItem } from "../../api/course";
import { FreePlaySwitch } from "./FreePlaySwitch";
import {
  activityDifficulty,
  activityUnitLabel,
  buildKidSkillPaths,
  kidSkillMastery,
  kidStats,
  questDotProgress,
  skillPathGlyph,
} from "./kidHomeModel";
import { LevelUpDialog } from "./LevelUpDialog";
import { StudentFooter } from "./StudentFooter";
import {
  AppToolbar,
  HERO_MASCOT,
  MedallionCard,
  NextUpCard,
  RecommendationCard,
  SectionHeader,
  SkillPathCard,
  StatTile,
  StreakChip,
  type MedallionTone,
  type RecommendationTone,
} from "./shared";
import { ThemeToggle } from "../../theme/ThemeToggle";
import { useThemeMode } from "../../theme/appTheme";
import type { StudentHomeProps } from "./types";

const activityThumbnail = (item: CourseQueueItem | CompletedCourseItem): string =>
  resolveTechniqueThumbnail(
    item.thumbnailUrl,
    "questions" in item ? item.questions[0]?.technique : undefined,
  ).url;

/** Queue kind → the pill a learner sees. `reinforce`/`review` are the "try this again" cases. */
const BADGE: Record<CourseQueueItem["kind"], { icon: LucideIcon; label: string }> = {
  reinforce: { icon: Target, label: "Practice" },
  review: { icon: Target, label: "Practice" },
  new: { icon: Sparkles, label: "New for you" },
  stretch: { icon: Star, label: "Stretch" },
  free: { icon: Sparkles, label: "Free play" },
};

/** Number pills for a queue item: only what the curriculum actually authored. */
const metaPills = (item: CourseQueueItem, lastScore?: number): string[] => [
  ...(typeof item.estimatedMinutes === "number" ? [`${item.estimatedMinutes} min`] : []),
  ...(typeof item.xpAvailable === "number" ? [`${item.xpAvailable} XP`] : []),
  ...(typeof lastScore === "number" ? [`Last ${Math.round(lastScore * 10)}/10`] : []),
];

const SECTIONS = [
  { label: "Home", icon: Home, target: "kid-home" },
  { label: "Learn", icon: BookOpen, target: "kid-activities" },
  { label: "Progress", icon: BarChart3, target: "kid-paths" },
] as const;

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Band A — Kid (grades 1–6). A full-bleed dashboard: welcome band with real headline numbers,
 * one "next up" card, the rest of the queue as activity cards, and mastery per learning path.
 *
 * Every reading comes from the course/progress contracts — see docs/kid-home-redesign.md for
 * the mapping, the mock panel left out for want of a contract (game collections), and the one
 * relabelled (activity progress → skill mastery).
 */
export const KidHome: React.FC<StudentHomeProps> = ({
  course,
  progress,
  activitySignal,
  levelUp,
  studentName,
  studentAvatar,
  loadingMode,
  skippingSkillId,
  onModeChange,
  onStart,
  onSkip,
  onDismissLevelUp,
  onExit,
}) => {
  const [theme, toggleTheme] = useThemeMode();
  const [hero, ...rest] = course.queue;
  const canSkip = course.mode === "scheduled" && Boolean(course.recommendationRunId);
  const completedItems = course.completedItems ?? [];
  const stats = kidStats(progress, activitySignal?.currentStreakDays ?? 0);
  const skillPaths = buildKidSkillPaths(progress);
  const quest = course.quest;
  const questProgress = quest && quest.target > 0
    ? questDotProgress(quest.completed, quest.target)
    : null;
  const hasActivities = rest.length + completedItems.length > 0;

  return (
    <div
      className={`flex min-h-screen w-full flex-col bg-[#F7F4FF] bg-[image:radial-gradient(circle_at_18%_8%,#DDF7FF_0%,transparent_38%),radial-gradient(circle_at_88%_72%,#FFE3F3_0%,transparent_38%)] text-[#21183D] dark:bg-[#0E0A20] dark:bg-[image:radial-gradient(circle_at_18%_8%,#1D2A52_0%,transparent_40%),radial-gradient(circle_at_88%_72%,#3A1B44_0%,transparent_40%)] dark:text-[#EDE9FF] ${
        theme === "dark" ? "dark" : ""
      }`}
      data-band="kid"
    >
      <AppToolbar
        wide
        title={`Hi, ${studentName}!`}
        subtitle={course.mode === "free" ? "Free play" : "Today’s learning"}
        nav={SECTIONS.map((section, index) => (
          <Button
            key={section.target}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => scrollTo(section.target)}
            className={`rounded-full px-4 font-extrabold ${
              index === 0
                ? "bg-[#F0EBFF] text-[#5C46DF] hover:bg-[#E8E0FF] dark:bg-white/10 dark:text-[#CDBEFF]"
                : "text-[#6E6480] hover:bg-[#F0EBFF] hover:text-[#5C46DF] dark:text-[#A79FC4] dark:hover:bg-white/10"
            }`}
          >
            <section.icon size={15} /> {section.label}
          </Button>
        ))}
        actions={
          <>
            <StreakChip days={stats.streakDays} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} variant="round" />
            <Button
              type="button"
              variant="ghost"
              onClick={onExit}
              className="gap-2 px-2 text-sm font-extrabold text-[#6551BD] hover:bg-white/70 sm:px-3 dark:text-[#CDBEFF] dark:hover:bg-white/10"
            >
              <LogOut size={18} /> <span className="hidden sm:inline">Exit</span>
            </Button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 sm:px-8">
        {/* Welcome band */}
        <section id="kid-home" className="scroll-mt-4">
          <div className="grid items-stretch gap-5 lg:grid-cols-[1.05fr_1fr] lg:gap-7">
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl font-black leading-tight tracking-tight text-[#21183D] sm:text-3xl lg:text-4xl dark:text-[#F2EEFF]">
                    {course.mode === "free" ? `Pick and play, ${studentName}!` : `Ready to learn, ${studentName}?`}
                  </h1>
                  <p className="mt-1.5 text-sm font-bold text-[#6B6280] sm:text-base dark:text-[#A79FC4]">
                    {hero ? "Your next adventure is ready." : "You’re all caught up — nice work!"}
                  </p>
                  {questProgress && (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-black text-[#5C46DF] dark:bg-white/10 dark:text-[#C3B4FF]">
                      <Star size={12} className="fill-current" />
                      {quest?.label || "Today’s quest"} · {questProgress.done} / {quest?.target} done
                    </p>
                  )}
                </div>
                {studentAvatar && (
                  <span
                    className={`hidden shrink-0 items-center justify-center text-6xl sm:flex ${HERO_MASCOT}`}
                    aria-hidden
                  >
                    {studentAvatar}
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:mt-auto">
                <StatTile icon={Flame} tone="amber" value={stats.streakDays} label="day streak" />
                <StatTile icon={Zap} tone="violet" value={stats.totalXp} label="XP earned" />
                <StatTile icon={Star} tone="emerald" value={stats.mastered} label="skills mastered" />
                <StatTile icon={CheckCircle2} tone="sky" value={stats.activitiesDone} label="activities done" />
              </div>
            </div>

            {hero && (
              <NextUpCard
                title={hero.skillLabel}
                description={hero.description}
                artUrl={activityThumbnail(hero)}
                minutes={hero.estimatedMinutes}
                questionCount={hero.questions.length}
                xp={hero.xpAvailable}
                progress={kidSkillMastery(progress, hero)}
                progressLabel="mastered"
                inProgress={hero.status === "in_progress"}
                onStart={() => onStart(hero)}
              />
            )}
          </div>

          {hero && canSkip && (
            <div className="mt-3 flex lg:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={skippingSkillId === hero.skillId}
                loadingText="Finding another…"
                onClick={() => onSkip(hero)}
                className="rounded-full px-3 text-xs font-extrabold text-[#6C6480] hover:bg-white/70 dark:text-[#A79FC4] dark:hover:bg-white/10"
              >
                Show me another
              </Button>
            </div>
          )}
        </section>

        {/* Activities */}
        {hasActivities && (
          <section id="kid-activities" className="mt-9 scroll-mt-4">
            <SectionHeader
              icon={Sparkles}
              title="Your next activities"
              subtitle="A mix of new, practice, and finished activities"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map(item => (
                <RecommendationCard
                  key={`${item.assignmentId}:${item.skillId}`}
                  tone={(item.accent ?? "purple") as RecommendationTone}
                  title={item.skillLabel}
                  subtitle={activityUnitLabel(progress, item)}
                  artUrl={activityThumbnail(item)}
                  reason={item.reason}
                  difficulty={activityDifficulty(item) ?? undefined}
                  minutes={item.estimatedMinutes}
                  xp={item.xpAvailable}
                  onStart={() => onStart(item)}
                />
              ))}
              {completedItems.map(item => {
                const replay = course.queue.find(
                  queued => queued.assignmentId === item.assignmentId && queued.skillId === item.skillId,
                );
                return (
                  <MedallionCard
                    key={`done:${item.assignmentId}:${item.skillId}`}
                    tone="green"
                    artUrl={activityThumbnail(item)}
                    title={item.skillLabel}
                    badge={{ icon: CheckCircle2, label: "Completed" }}
                    meta={typeof item.xpEarned === "number" ? `+${item.xpEarned} XP earned` : undefined}
                    actionLabel={replay ? `Play ${item.skillLabel} again` : item.skillLabel}
                    onClick={() => replay && onStart(replay)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Skill paths */}
        {skillPaths.length > 0 && (
          <section id="kid-paths" className="mt-9 scroll-mt-4">
            <SectionHeader
              icon={BarChart3}
              tone="emerald"
              title="Your skill paths"
              subtitle="How far you’ve come in each part of the curriculum"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {skillPaths.map((path, index) => (
                <SkillPathCard
                  key={path.id}
                  title={path.title}
                  glyph={skillPathGlyph(path.title)}
                  mastered={path.mastered}
                  total={path.total}
                  duePractice={path.duePractice}
                  milestone={path.milestone}
                  tone={(["violet", "emerald", "amber", "rose"] as const)[index % 4]}
                />
              ))}
            </div>
          </section>
        )}

        <div className="mt-9 flex justify-center">
          <FreePlaySwitch mode={course.mode} loading={loadingMode !== null} onModeChange={onModeChange} />
        </div>
      </main>

      <StudentFooter
        links={[
          { label: "Home", targetId: "kid-home" },
          ...(hasActivities ? [{ label: "Learn", targetId: "kid-activities" }] : []),
          ...(skillPaths.length > 0 ? [{ label: "Progress", targetId: "kid-paths" }] : []),
        ]}
        tagline="Making math fun through meaningful practice."
      />
      <LevelUpDialog levelUp={levelUp} onDismiss={onDismissLevelUp} />
    </div>
  );
};
