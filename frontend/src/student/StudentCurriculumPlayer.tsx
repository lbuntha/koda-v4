import React, { useEffect, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { GameLauncher } from "../components/GameLauncher";
import { Button } from "../components/ui";
import { analyticsLogger } from "../services/analyticsLogger";
import { sounds } from "../sound";
import { placementApi, PlacementQuiz } from "../api/placement";
import {
  CourseMode,
  CourseQueueItem,
  courseApi,
  MasteryLevel,
  StudentActivitySignal,
  StudentProgress,
  TodayCourse,
} from "../api/course";
import { PlacementWarmup } from "./PlacementWarmup";
import { StudentTodayHome } from "./StudentTodayHome";
import { useThemeMode } from "../theme/appTheme";

export const StudentCurriculumPlayer: React.FC = () => {
  // These surfaces render outside the band layout, so they carry the theme class themselves.
  const [theme] = useThemeMode();
  const dark = theme === "dark" ? "dark" : "";
  const { account, playSession, endChildPlay, logout } = useAuth();
  const [placement, setPlacement] = useState<PlacementQuiz | null>(null);
  const [course, setCourse] = useState<TodayCourse | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [activitySignal, setActivitySignal] = useState<StudentActivitySignal | null>(null);
  const [replayItems, setReplayItems] = useState<CourseQueueItem[]>([]);
  const [levelUp, setLevelUp] = useState<{
    skillLabel: string;
    previousLevel: MasteryLevel;
    level: MasteryLevel;
  } | null>(null);
  const [selected, setSelected] = useState<CourseQueueItem | null>(null);
  const [activeId, setActiveId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<CourseMode | null>("scheduled");
  const [skippingSkillId, setSkippingSkillId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCourse = async (mode: CourseMode) => {
    setLoadingMode(mode);
    setError(null);
    try {
      const shouldLoadKidCatalog = account?.gradeBand === "kid" && mode === "scheduled";
      // Kid and focus bands both surface the day streak; it comes from the same signal.
      const shouldLoadFocusSignal = account?.gradeBand === "focus" || account?.gradeBand === "kid";
      const [nextCourse, nextProgress, kidCatalog, nextActivitySignal] = await Promise.all([
        courseApi.today(mode),
        account?.id ? courseApi.progress(account.id) : Promise.resolve(null),
        shouldLoadKidCatalog
          ? courseApi.today("free").catch(() => null)
          : Promise.resolve(null),
        account?.id && shouldLoadFocusSignal
          ? courseApi.activitySignal(account.id).catch(() => null)
          : Promise.resolve(null),
      ]);
      setCourse(nextCourse);
      if (nextProgress) setProgress(nextProgress);
      if (mode === "free") setReplayItems(nextCourse.queue);
      else if (kidCatalog) setReplayItems(kidCatalog.queue);
      if (nextActivitySignal) setActivitySignal(nextActivitySignal);
      return nextCourse;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load today’s learning plan");
      return null;
    } finally {
      setLoadingMode(null);
    }
  };

  useEffect(() => {
    if (!account?.id) return;
    let cancelled = false;
    analyticsLogger.enableServerSync(account.id);
    void (async () => {
      try {
        const session = await courseApi.startSession(playSession ? "parent_launch" : "independent");
        if (cancelled) return;
        setSessionId(session.sessionId);
        analyticsLogger.setSessionId(session.sessionId);
        const quiz = await placementApi.quiz();
        if (cancelled) return;
        if (quiz.status === "pending" && quiz.items.length > 0) {
          setPlacement(quiz);
          setLoadingMode(null);
        } else {
          await loadCourse("scheduled");
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Unable to start learning session");
          setLoadingMode(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      analyticsLogger.disableServerSync();
    };
  }, [account?.id]);

  const finishPlacement = () => {
    setPlacement(null);
    void loadCourse("scheduled");
  };

  const startItem = (item: CourseQueueItem) => {
    if (!item.questions.length) return;
    setSelected(item);
    setActiveId(item.questions[0].id);
  };

  const finishLesson = async () => {
    const completed = selected;
    const previous = progress?.skills.find(skill =>
      skill.curriculumId === completed?.curriculumId
      && skill.skillId === completed?.skillId
    );
    await analyticsLogger.flush();
    setSelected(null);
    setActiveId("");
    if (account?.id && completed) {
      try {
        const nextProgress = await courseApi.progress(account.id);
        const current = nextProgress.skills.find(skill =>
          skill.curriculumId === completed.curriculumId
          && skill.skillId === completed.skillId
        );
        const levels: MasteryLevel[] = ["not_started", "beginner", "developing", "proficient", "master"];
        if (
          current
          && levels.indexOf(current.level) > levels.indexOf(previous?.level ?? "not_started")
        ) {
          setLevelUp({
            skillLabel: current.skillLabel,
            previousLevel: previous?.level ?? "not_started",
            level: current.level,
          });
          sounds.playLevelUp();
        }
        setProgress(nextProgress);
      } catch {
        // loadCourse below is the recovery path if this immediate refresh fails.
      }
    }
    const nextCourse = await loadCourse(course?.mode ?? "scheduled");
    if (
      completed
      && nextCourse
      && !(nextCourse.completedItems ?? []).some(item =>
        item.assignmentId === completed.assignmentId
        && item.skillId === completed.skillId
      )
    ) {
      setError("This activity is not completed yet because the server could not verify every answer.");
    }
  };

  const skip = async (item: CourseQueueItem) => {
    if (!course?.recommendationRunId) return;
    setSkippingSkillId(item.skillId);
    setError(null);
    try {
      await courseApi.skip(course.recommendationRunId, item);
      await loadCourse("scheduled");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to skip this recommendation");
    } finally {
      setSkippingSkillId(null);
    }
  };

  const exit = async () => {
    await analyticsLogger.flush();
    if (sessionId) {
      try { await courseApi.endSession(sessionId); } catch { /* exit must remain available offline */ }
    }
    if (playSession) await endChildPlay();
    else logout();
  };

  if (placement) {
    return (
      <PlacementWarmup
        quiz={placement}
        band={account?.gradeBand ?? "student"}
        onComplete={finishPlacement}
      />
    );
  }

  if (selected && activeId) {
    return (
      <GameLauncher
        questions={selected.questions}
        activeId={activeId}
        setActiveId={setActiveId}
        onClose={() => void finishLesson()}
        onExit={() => void exit()}
        kidMode={account?.gradeBand === "kid"}
        learningContext={{
          assignmentId: selected.assignmentId,
          releaseId: selected.releaseId,
          curriculumId: selected.curriculumId,
          curriculumRevision: selected.curriculumRevision,
          recommendationRunId: course?.recommendationRunId ?? undefined,
          skillId: selected.skillId,
        }}
      />
    );
  }

  if (error && !course) {
    return (
      <div className={`flex min-h-screen items-center justify-center bg-[#FBFAFF] p-5 dark:bg-[#0E0A20] ${dark}`}>
        <div className="max-w-sm rounded-3xl border border-[#E7E3F6] bg-white p-7 text-center shadow-sm dark:border-white/10 dark:bg-[#191338] dark:shadow-none">
          <BookOpen className="mx-auto text-[#534AB7] dark:text-[#B6A6FF]" />
          <h1 className="mt-3 text-base font-semibold text-[#0E0B55] dark:text-[#EDE9FF]">No learning plan available</h1>
          <p className="mt-1 text-xs leading-relaxed text-[#6D6997] dark:text-[#A79FC4]">{error}</p>
          <Button className="mt-4" onClick={() => void exit()}>Back</Button>
        </div>
      </div>
    );
  }

  if (!course || loadingMode && !course) {
    return (
      <div className={`flex min-h-screen items-center justify-center bg-[#FBFAFF] dark:bg-[#0E0A20] ${dark}`}>
        <Loader2 className="animate-spin text-[#534AB7] dark:text-[#B6A6FF]" />
      </div>
    );
  }

  return (
    <>
      <StudentTodayHome
        course={course}
        progress={progress}
        activitySignal={activitySignal}
        replayItems={replayItems}
        levelUp={levelUp}
        studentName={account?.name || "Learner"}
        studentAvatar={account?.avatar}
        band={account?.gradeBand ?? "student"}
        loadingMode={loadingMode}
        skippingSkillId={skippingSkillId}
        onModeChange={mode => void loadCourse(mode)}
        onStart={startItem}
        onSkip={item => void skip(item)}
        onDismissLevelUp={() => setLevelUp(null)}
        onExit={() => void exit()}
      />
      {error && (
        <div className={dark}>
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-lg dark:border-rose-400/25 dark:bg-[#2A1620] dark:text-rose-300">
            {error}
          </div>
        </div>
      )}
    </>
  );
};
