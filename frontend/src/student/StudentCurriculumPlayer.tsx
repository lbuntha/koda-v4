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
  CurriculumPath,
  courseApi,
  LearnerSubject,
  MasteryLevel,
  StudentActivitySignal,
  StudentProgress,
  TodayCourse,
} from "../api/course";
import { PlacementWarmup } from "./PlacementWarmup";
import { StudentTodayHome } from "./StudentTodayHome";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useThemeMode } from "../theme/appTheme";
import { LearnerSubjectProvider } from "./subject/LearnerSubjectContext";

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
  const [paths, setPaths] = useState<CurriculumPath[]>([]);
  const [subjects, setSubjects] = useState<LearnerSubject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [switchingSubject, setSwitchingSubject] = useState(false);
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

  const loadCourse = async (mode: CourseMode, subjectId: string | null = activeSubjectId) => {
    setLoadingMode(mode);
    setError(null);
    try {
      const shouldLoadKidCatalog = account?.gradeBand === "kid" && mode === "scheduled";
      // Kid and focus bands both surface the day streak; it comes from the same signal.
      const shouldLoadFocusSignal = account?.gradeBand === "focus" || account?.gradeBand === "kid";
      // The first two are required — if they fail the outer catch shows the error screen.
      // The rest are enrichments (a browse catalog, the streak chip, the path map): a learner
      // with a working lesson should not be blocked from it because a chip couldn't load, so
      // these degrade to null and the components render without them.
      const [nextCourse, nextProgress, kidCatalog, nextActivitySignal, nextPaths] = await Promise.all([
        courseApi.today(mode, subjectId),
        account?.id ? courseApi.progress(account.id) : Promise.resolve(null),
        shouldLoadKidCatalog
          ? courseApi.today("free", subjectId).catch(() => null)
          : Promise.resolve(null),
        account?.id && shouldLoadFocusSignal
          ? courseApi.activitySignal(account.id).catch(() => null)
          : Promise.resolve(null),
        courseApi.path(subjectId).catch(() => null),
      ]);
      setCourse(nextCourse);
      if (nextCourse.subjectId) setActiveSubjectId(nextCourse.subjectId);
      if (nextPaths) setPaths(nextPaths.paths);
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

  const loadSubjectsAndCourse = async () => {
    const response = await courseApi.subjects();
    setSubjects(response.subjects);
    const subjectId = response.currentSubjectId ?? response.subjects.find(subject => subject.ready)?.id ?? null;
    setActiveSubjectId(subjectId);
    return loadCourse("scheduled", subjectId);
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
          await loadSubjectsAndCourse();
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

  const finishPlacement = async () => {
    setError(null);
    try {
      const nextPlacement = await placementApi.quiz();
      if (nextPlacement.status === "pending" && nextPlacement.items.length > 0) {
        setPlacement(nextPlacement);
        return;
      }
      setPlacement(null);
      await loadSubjectsAndCourse();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to continue placement";
      setError(message);
      throw reason instanceof Error ? reason : new Error(message);
    }
  };

  const changeSubject = async (subjectId: string) => {
    if (subjectId === activeSubjectId || switchingSubject) return;
    const previousSubjectId = activeSubjectId;
    setSwitchingSubject(true);
    setError(null);
    setActiveSubjectId(subjectId);
    setSelected(null);
    setActiveId("");
    try {
      await courseApi.selectSubject(subjectId);
      await loadCourse(course?.mode ?? "scheduled", subjectId);
    } catch (reason) {
      setActiveSubjectId(previousSubjectId);
      setError(reason instanceof Error ? reason.message : "Unable to change subject");
    } finally {
      setSwitchingSubject(false);
    }
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
    const nextCourse = await loadCourse(course?.mode ?? "scheduled", activeSubjectId);
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
      await loadCourse("scheduled", activeSubjectId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to skip this recommendation");
    } finally {
      setSkippingSkillId(null);
    }
  };

  /**
   * Leave Koda entirely: back to the guardian who launched the session, or signed out.
   *
   * Only the home screen offers this. From inside an activity the same word means something
   * much smaller — see `leaveActivity`.
   */
  const exit = async () => {
    await analyticsLogger.flush();
    if (sessionId) {
      try { await courseApi.endSession(sessionId); } catch { /* exit must remain available offline */ }
    }
    if (playSession) await endChildPlay();
    else logout();
  };

  /**
   * Leave the activity and go back to the learner's home.
   *
   * This used to call `exit`, so a child who wanted out of one activity was signed out or
   * handed back to their parent — the session ended and everything else on their home
   * became unreachable. Nothing about stopping an activity implies leaving the app.
   *
   * Answers already given are kept: they were logged as they happened, and the flush makes
   * sure the last of them has left the buffer before the screen changes.
   */
  const leaveActivity = async () => {
    await analyticsLogger.flush();
    setSelected(null);
    setActiveId("");
    if (account?.id) {
      // The home screen shows progress and the streak, both of which may have moved during
      // the activity. Failing here only means slightly stale tiles, so it stays quiet.
      try {
        setProgress(await courseApi.progress(account.id));
      } catch { /* home renders from the previous snapshot */ }
    }
  };

  if (placement) {
    return (
      <PlacementWarmup
        key={placement.placementId ?? "placement"}
        quiz={placement}
        band={account?.gradeBand ?? "student"}
        onComplete={finishPlacement}
        onExit={() => void exit()}
      />
    );
  }

  if (selected && activeId) {
    return (
      // A single malformed question must not take down the learner's whole session — the
      // boundary keeps the failure to the activity and offers a way back.
      <ErrorBoundary surface="game-launcher">
      <GameLauncher
        questions={selected.questions}
        activeId={activeId}
        setActiveId={setActiveId}
        onClose={() => void finishLesson()}
        onExit={() => void leaveActivity()}
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
      </ErrorBoundary>
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
      <LearnerSubjectProvider value={{
        subjects,
        activeSubjectId,
        switching: switchingSubject,
        onChange: subjectId => void changeSubject(subjectId),
      }}>
        <StudentTodayHome
          course={course}
          progress={progress}
          activitySignal={activitySignal}
          replayItems={replayItems}
          paths={paths}
          levelUp={levelUp}
          studentName={account?.name || "Learner"}
          studentAvatar={account?.avatar}
          band={account?.gradeBand ?? "student"}
          loadingMode={loadingMode}
          skippingSkillId={skippingSkillId}
          onModeChange={mode => void loadCourse(mode, activeSubjectId)}
          onStart={startItem}
          onSkip={item => void skip(item)}
          onDismissLevelUp={() => setLevelUp(null)}
          onExit={() => void exit()}
        />
      </LearnerSubjectProvider>
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
