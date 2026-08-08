import React from "react";
import { Sparkles } from "lucide-react";
import { authApi } from "../../api/auth";
import { useAuth } from "../../auth/AuthContext";
import { apiFileUrl } from "../../api/client";
import type { CompletedCourseItem, CourseQueueItem } from "../../api/course";
import { FreePlaySwitch } from "./FreePlaySwitch";
import {
  activityDifficulty,
  activityUnitLabel,
  buildUnitCards,
  kidLastScore,
  kidReason,
  kidSkillMastery,
  kidStats,
  pickKidHero,
} from "./kidHomeModel";
import { LevelUpDialog } from "./LevelUpDialog";
import { StudentFooter } from "./StudentFooter";
import {
  CurriculumCompletionCard,
  RecommendationCard,
  SectionHeader,
  type RecommendationTone,
} from "./shared";
import { useThemeMode } from "../../theme/appTheme";
import type { StudentHomeProps } from "./types";
import { useLearnerSubject } from "../subject/LearnerSubjectContext";
import {
  KidHomeToolbar,
  LearningPathSection,
  QuestSection,
  SkillsExplorerSection,
  WelcomeMissionSection,
  type KidHomeDestination,
} from "./sections";

/**
 * The skill's own artwork and nothing else — no label guessing, no technique default, no
 * mascot. If this returns undefined the curriculum did not send a thumbnail for the skill,
 * and the card shows that plainly instead of drawing something convincing in its place.
 */
const activityThumbnail = (
  item: CourseQueueItem | CompletedCourseItem,
): string | undefined => apiFileUrl(item.thumbnailUrl) ?? undefined;

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
  paths,
  replayItems,
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
  const { subjects, activeSubjectId, switching, onChange } = useLearnerSubject();
  const { refreshSession } = useAuth();
  const [theme, toggleTheme] = useThemeMode();
  const [activeDestination, setActiveDestination] = React.useState<KidHomeDestination>(() => {
    if (typeof window === "undefined") return "home";
    return window.location.hash === "#skills" ? "skills" : window.location.hash === "#quests" ? "quests" : "home";
  });
  const { hero, rest } = pickKidHero(course.queue);
  const canSkip = course.mode === "scheduled" && Boolean(course.recommendationRunId);
  const completedItems = course.completedItems ?? [];
  const stats = kidStats(progress, activitySignal?.currentStreakDays ?? 0);
  const isFirstVisit = completedItems.length === 0
    && stats.activitiesDone === 0
    && stats.totalXp === 0
    && !course.queue.some(item => item.status === "in_progress")
    && !(progress?.skills.some(skill => skill.plays > 0) ?? false);
  const hasActivities = rest.length + completedItems.length > 0;
  const pathThumbnailBySkillId = new Map(
    [...course.queue, ...replayItems].map(item => [item.skillId, activityThumbnail(item)] as const),
  );
  const playableItems = [...course.queue, ...replayItems];
  const playableSkillIds = new Set(playableItems.filter(item => item.questions.length > 0).map(item => item.skillId));
  // One assigned grade is the normal case; several assignments simply lay their roads end to end.
  const unitCards = buildUnitCards(paths, progress);
  const roadNextSkillId = paths.find(path => path.nextSkill)?.nextSkill?.skillId ?? null;
  const roadTotals = paths.reduce(
    (sum, path) => ({
      done: sum.done + path.counts.completed,
      total: sum.total + path.counts.total,
      overdue: sum.overdue + path.counts.overdue,
    }),
    { done: 0, total: 0, overdue: 0 },
  );
  const roadSubtitle = [
    `${roadTotals.done} of ${roadTotals.total} skills done`,
    roadTotals.overdue > 0 ? `${roadTotals.overdue} to practise again` : null,
  ].filter(Boolean).join(" · ");
  const subjectComplete = paths.length > 0 && paths.every(path => path.complete);
  const activeSubjectName = subjects.find(subject => subject.id === activeSubjectId)?.name ?? "Learning";
  const completedGradeName = paths.flatMap(path => path.units).find(unit => unit.gradeLabel)?.gradeLabel;

  React.useEffect(() => {
    const syncFromHash = () => {
      setActiveDestination(
        window.location.hash === "#skills" ? "skills" : window.location.hash === "#quests" ? "quests" : "home",
      );
    };
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeDestination]);

  const navigate = (destination: KidHomeDestination) => {
    if (activeDestination === destination) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setActiveDestination(destination);
    const hash = `#${destination}`;
    if (window.location.hash === hash) return;
    window.location.hash = hash;
  };

  return (
    <div
      className={`flex min-h-screen w-full flex-col bg-white text-[#1C2B4A] dark:bg-[#0E1020] dark:text-[#EDE9FF] ${
        theme === "dark" ? "dark" : ""
      }`}
      data-band="kid"
    >
      <KidHomeToolbar
        stats={stats}
        studentAvatar={studentAvatar}
        theme={theme}
        showSkills={unitCards.length > 0}
        activeDestination={activeDestination}
        onNavigate={navigate}
        onToggleTheme={toggleTheme}
        onAvatarChange={async avatar => {
          await authApi.updateStudentAvatar(avatar);
          await refreshSession();
        }}
        onExit={onExit}
        subjects={subjects}
        activeSubjectId={activeSubjectId}
        switchingSubject={switching}
        onSubjectChange={onChange}
      />

      {activeDestination === "skills" ? (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 sm:px-6 md:pb-8">
          <SkillsExplorerSection
            paths={paths}
            subjectName={subjects.find(subject => subject.id === activeSubjectId)?.name ?? "Learning"}
            playableSkillIds={playableSkillIds}
            thumbnailBySkillId={pathThumbnailBySkillId}
            onStartSkill={skillId => {
              const item = playableItems.find(candidate => candidate.skillId === skillId);
              if (item) onStart(item);
            }}
          />
        </main>
      ) : activeDestination === "quests" ? (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 sm:px-6 md:pb-8">
          <QuestSection
            quest={course.quest}
            activities={course.queue}
            subjectName={subjects.find(subject => subject.id === activeSubjectId)?.name ?? "Learning"}
            onStart={onStart}
          />
        </main>
      ) : (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 sm:px-6 md:pb-8">
        {subjectComplete ? (
          <CurriculumCompletionCard
            subjectName={activeSubjectName}
            gradeName={completedGradeName}
            skillsMastered={roadTotals.done}
          />
        ) : (
          <WelcomeMissionSection
            mode={course.mode}
            studentName={studentName}
            isFirstVisit={isFirstVisit}
            hero={hero}
            artUrl={hero ? activityThumbnail(hero) : undefined}
            badge={hero ? kidReason(hero) : undefined}
            difficulty={hero ? activityDifficulty(hero) ?? undefined : undefined}
            mastery={hero ? kidSkillMastery(progress, hero) : undefined}
            canSkip={canSkip}
            skipping={Boolean(hero && skippingSkillId === hero.skillId)}
            onStart={onStart}
            onSkip={onSkip}
          />
        )}

        {/* Activities */}
        {hasActivities && (
          <section id="kid-activities" className="mt-6 scroll-mt-4">
            <SectionHeader
              icon={Sparkles}
              title="More activities"
              subtitle="New lessons, practice, and activities you can replay"
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map(item => (
                <RecommendationCard
                  key={`${item.assignmentId}:${item.skillId}`}
                  tone={(item.accent ?? "purple") as RecommendationTone}
                  title={item.skillLabel}
                  subtitle={activityUnitLabel(progress, item)}
                  artUrl={activityThumbnail(item)}
                  reason={kidReason(item)}
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
                  <RecommendationCard
                    key={`done:${item.assignmentId}:${item.skillId}`}
                    status="completed"
                    artUrl={activityThumbnail(item)}
                    title={item.skillLabel}
                    subtitle={activityUnitLabel(progress, item)}
                    lastScore={kidLastScore(progress, item)}
                    xp={item.xpEarned}
                    onStart={() => replay && onStart(replay)}
                  />
                );
              })}
            </div>
          </section>
        )}

        <LearningPathSection
          units={unitCards}
          subtitle={roadSubtitle}
          subjectId={activeSubjectId}
          subjectName={activeSubjectName}
          thumbnailBySkillId={pathThumbnailBySkillId}
          nextSkillId={roadNextSkillId}
          onStartSkill={skillId => {
            const item = [...course.queue, ...replayItems].find(queued => queued.skillId === skillId);
            if (item) onStart(item);
          }}
          onViewAll={() => navigate("skills")}
        />

        <div className="mt-6 flex justify-center">
          <FreePlaySwitch mode={course.mode} loading={loadingMode !== null} onModeChange={onModeChange} />
        </div>
      </main>
      )}

      <StudentFooter
        links={[
          ...(activeDestination === "skills"
            ? [{ label: "Skills", targetId: "kid-skills" }]
            : activeDestination === "quests"
              ? [{ label: "Quests", targetId: "kid-quests" }]
            : [
                { label: "Home", targetId: "kid-home" },
                ...(hasActivities ? [{ label: "Activities", targetId: "kid-activities" }] : []),
                ...(unitCards.length > 0 ? [{ label: "Progress", targetId: "kid-paths" }] : []),
              ]),
        ]}
        tagline="Making learning fun through meaningful practice."
      />
      <LevelUpDialog levelUp={levelUp} onDismiss={onDismissLevelUp} />
    </div>
  );
};
