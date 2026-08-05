/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { CountingQuestion } from "../types";
import { sounds } from "../sound";
import { QuestionAssetProvider } from "../assets/questionAsset";
import { CanvasAudienceProvider } from "./canvases/presentation";
import { OneToOneCanvas } from "./canvases/OneToOneCanvas";
import { CANVAS_BY_TECHNIQUE } from "./studio/canvasRegistry";
import { LazyBoundary } from "./LazyBoundary";
import {
  Gamepad2,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  X,
  Trophy,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Activity
} from "lucide-react";
import { AnalyticsViewerModal } from "./AnalyticsViewerModal";
import { analyticsLogger } from "../services/analyticsLogger";
import { getTaxonomy, AttemptOutcome } from "../services/logSchema";
import { solvedSelection } from "../student/answerSelection";
import { useThemeMode } from "../theme/appTheme";
import { useZoomLock } from "../hooks/useZoomLock";

interface GameLauncherProps {
  questions: CountingQuestion[];
  activeId: string;
  setActiveId: (id: string) => void;
  /** Called only after the last card has been solved. */
  onClose: () => void;
  /** Leaves an unfinished player without reporting lesson completion. */
  onExit?: () => void;
  /** Simplified, non-skippable practice flow for early learners. */
  kidMode?: boolean;
  learningContext?: {
    releaseId: string;
    curriculumId: string;
    curriculumRevision: number;
    assignmentId?: string;
    recommendationRunId?: string;
    skillId?: string;
  };
  /**
   * Runs the same activity canvas as a diagnostic instead of a lesson.
   * Diagnostic responses are kept local and submitted together; they never
   * emit lesson analytics, completion XP, or mastery events.
   */
  assessment?: {
    eyebrow?: string;
    finishLabel?: string;
    responseId?: (question: CountingQuestion) => string;
    onComplete: (responses: Array<{ questionId: string; selection: string }>) => Promise<void> | void;
  };
}

interface ConfettiParticle {
  id: number;
  left: string;
  color: string;
  delay: string;
  size: string;
}

export const GameLauncher: React.FC<GameLauncherProps> = ({
  questions,
  activeId,
  setActiveId,
  onClose,
  onExit,
  kidMode = false,
  learningContext,
  assessment,
}) => {
  const zoomLockRef = useZoomLock<HTMLDivElement>();
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => !sounds.isEnabled());
  const [theme, toggleTheme] = useThemeMode();
  const isDark = theme === "dark";
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);
  const [assessmentResponses, setAssessmentResponses] = useState<Record<string, string>>({});
  const [assessmentSaving, setAssessmentSaving] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const correctAttemptLogged = useRef(false);

  const activeQuestion = questions.find(q => q.id === activeId) || questions[0];
  const currentIdx = questions.findIndex(q => q.id === activeId);
  const responseIdFor = (question: CountingQuestion) => assessment?.responseId?.(question) ?? question.id;
  const activeResponseId = activeQuestion ? responseIdFor(activeQuestion) : "";
  const assessmentAnswered = Boolean(activeResponseId && assessmentResponses[activeResponseId]);

  const recordAssessmentResponse = (selection: unknown) => {
    if (!assessment || !activeQuestion || selection == null) return;
    const normalized = String(selection);
    if (!normalized) return;
    const responseId = responseIdFor(activeQuestion);
    setAssessmentResponses(current => current[responseId]
      ? current
      : { ...current, [responseId]: normalized });
  };

  /** Builds the slide-context fields every learning event needs — one place, so the taxonomy lookup can't drift between call sites. */
  const slideContext = (q: CountingQuestion, idx: number) => {
    const { subjectArea, skillTags } = getTaxonomy(q.technique);
    return {
      questionId: q.id,
      technique: q.technique,
      subjectArea,
      skillTags,
      // Present only when this question has been assigned to a curriculum
      // skill in the Curriculum Studio — see logSchema.ts's LearningEvent.
      curriculumSkillId: q.skillId,
      curriculumId: learningContext?.curriculumId,
      curriculumRevision: learningContext?.curriculumRevision,
      releaseId: learningContext?.releaseId,
      assignmentId: learningContext?.assignmentId,
      recommendationRunId: learningContext?.recommendationRunId,
      details: {
        objectId: q.objectId,
        ...(q.config?.customSvgAssetId ? { customSvgAssetId: q.config.customSvgAssetId } : {}),
      },
      slideIndex: idx,
      totalSlides: questions.length,
      questionTitle: q.title,
    };
  };

  // Log slide view for the standardized learning log
  useEffect(() => {
    setIsSuccess(false);
    setConfetti([]);
    correctAttemptLogged.current = false;
    if (activeQuestion && !assessment) {
      analyticsLogger.logSlideView(slideContext(activeQuestion, currentIdx));
    }
  }, [activeId]);

  /**
   * Bridges every canvas's existing `onSuccess` into a standardized "correct"
   * attempt — so all 15 canvases get baseline right/wrong-capable logging
   * immediately with zero canvas edits. A canvas that can *also* detect a
   * wrong attempt (see CanvasProps.onAttempt) should call
   * `onAttempt("incorrect", {...})` itself for the diagnostic detail; this
   * bridge only ever reports the eventual correct solve.
   */
  const handleAttempt = (
    outcome: AttemptOutcome,
    detail?: { expected?: unknown; selected?: unknown; details?: Record<string, any> },
  ) => {
    if (!activeQuestion) return;
    if (assessment) {
      // Some arithmetic canvases report intermediate rows. Placement records
      // only the final checked response that the release grader understands.
      const stage = detail?.details?.stage;
      if (!stage || stage === "final") recordAssessmentResponse(detail?.selected);
      return;
    }
    if (outcome === "correct") {
      if (correctAttemptLogged.current) return;
      correctAttemptLogged.current = true;
    }
    analyticsLogger.logAttempt(slideContext(activeQuestion, currentIdx), outcome, detail);
  };

  const handleHint = (details?: Record<string, any>) => {
    if (!activeQuestion) return;
    if (assessment) return;
    analyticsLogger.logHintRequested(slideContext(activeQuestion, currentIdx), details);
  };

  // Fullscreen support
  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    sounds.setEnabled(!nextMute);
    sounds.playPop();
  };

  const handleSuccess = () => {
    if (assessment) {
      recordAssessmentResponse(solvedSelection(activeQuestion));
      return;
    }
    setIsSuccess(true);
    triggerConfetti();
    if (!correctAttemptLogged.current) {
      const selected = solvedSelection(activeQuestion);
      // Canvases that can report the solved state themselves call onAttempt straight
      // after onSuccess, in this same tick. Logging the bridge attempt synchronously
      // would claim the first-writer guard below and discard that richer report —
      // leaving the server with no selection to grade. Yield one microtask so a canvas
      // that has real detail always wins, and only bridge when none arrives.
      queueMicrotask(() => {
        if (correctAttemptLogged.current) return;
        handleAttempt("correct", selected == null ? undefined : { selected });
      });
    }
  };

  const triggerConfetti = () => {
    const colors = [
      "bg-red-400", "bg-amber-400", "bg-pink-400", "bg-emerald-400",
      "bg-indigo-400", "bg-sky-400", "bg-yellow-400", "bg-teal-400",
      "bg-violet-400", "bg-fuchsia-400"
    ];
    const particles: ConfettiParticle[] = Array.from({ length: 80 }).map((_, idx) => ({
      id: Date.now() + idx,
      left: `${Math.random() * 100}%`,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: `${Math.random() * 2}s`,
      size: `${6 + Math.random() * 14}px`
    }));
    setConfetti(particles);
  };

  useEffect(() => {
    if (confetti.length > 0) {
      const timer = setTimeout(() => setConfetti([]), 5000);
      return () => clearTimeout(timer);
    }
  }, [confetti]);

  const resetSlide = () => {
    setIsSuccess(false);
    setConfetti([]);
    sounds.playPop();
    if (activeQuestion && !assessment) {
      analyticsLogger.logSlideReset(slideContext(activeQuestion, currentIdx));
    }
    const currentId = activeId;
    setActiveId("");
    setTimeout(() => setActiveId(currentId), 30);
  };

  const handleNextSlide = async () => {
    if (assessment && !assessmentAnswered) return;
    setIsSuccess(false);
    setAssessmentError(null);
    if (currentIdx < questions.length - 1) {
      setActiveId(questions[currentIdx + 1].id);
      sounds.playPop();
    } else if (assessment) {
      setAssessmentSaving(true);
      try {
        await assessment.onComplete(questions.map(question => {
          const questionId = responseIdFor(question);
          return { questionId, selection: assessmentResponses[questionId] || "" };
        }));
        sounds.playSuccess();
      } catch (cause) {
        setAssessmentError(cause instanceof Error ? cause.message : "Unable to save placement");
      } finally {
        setAssessmentSaving(false);
      }
    } else {
      analyticsLogger.logLessonComplete({
        slideIndex: currentIdx,
        totalSlides: questions.length,
        curriculumId: learningContext?.curriculumId,
        curriculumRevision: learningContext?.curriculumRevision,
        releaseId: learningContext?.releaseId,
        assignmentId: learningContext?.assignmentId,
        recommendationRunId: learningContext?.recommendationRunId,
        curriculumSkillId: learningContext?.skillId ?? activeQuestion?.skillId,
      });
      sounds.playSuccess();
      onClose();
    }
  };

  useEffect(() => {
    if (assessment || !kidMode || !isSuccess) return;
    const timer = window.setTimeout(() => void handleNextSlide(), 1200);
    return () => window.clearTimeout(timer);
  }, [activeId, isSuccess, kidMode, assessment]);

  const handlePrevSlide = () => {
    setIsSuccess(false);
    if (currentIdx > 0) {
      setActiveId(questions[currentIdx - 1].id);
      sounds.playPop();
    }
  };

  const renderCanvas = () => {
    if (!activeQuestion) return null;

    const canvasProps = {
      question: activeQuestion,
      isPlayMode: true,
      showGrid: false,
      isDark,
      onSuccess: handleSuccess,
      onAttempt: handleAttempt,
      onHint: handleHint,
    };

    const Canvas = CANVAS_BY_TECHNIQUE[activeQuestion.technique] || OneToOneCanvas;
    return (
      // Every canvas shares one layout; this tells that layout who is looking, so none of
      // the twenty-six need a prop for it.
      <CanvasAudienceProvider learnerMode={kidMode}>
        {/* Likewise for the artwork this question chose — see `questionAsset.tsx`. */}
        <QuestionAssetProvider asset={activeQuestion.config}>
          <LazyBoundary>
            <Canvas key={activeQuestion.id} {...canvasProps} />
          </LazyBoundary>
        </QuestionAssetProvider>
      </CanvasAudienceProvider>
    );
  };

  const iconBtn = `p-2.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center`;
  const iconBtnDark = `bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white`;
  const iconBtnLight = `bg-black/5 hover:bg-black/10 border-black/10 text-slate-500 hover:text-slate-800`;

  return (
    <div
      // Two fingers on a ten-frame drag read as a pinch; the activity surface is the one
      // place that has to stay put. Everything outside it keeps browser zoom.
      ref={zoomLockRef}
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden font-sans select-none transition-colors duration-500
        ${isDark
          ? 'bg-[#0B0F1A]'
          : 'bg-gradient-to-br from-indigo-50 via-white to-violet-50'
        }
      `}
    >
      {/* ── Ambient glow blobs (dark mode only) ──────────── */}
      {isDark && (
        <>
          <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* ══════════════════ TOP NAVBAR ═══════════════════ */}
      <header className={`flex min-h-[3.75rem] shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 sm:px-5 md:px-6 z-20 border-b transition-colors duration-300 backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)] [-webkit-tap-highlight-color:transparent]
        ${isDark ? 'bg-[#111329]/95 border-white/10' : 'bg-white/95 border-slate-200/70 shadow-sm'}
      `}>
        {/* Left – branding & title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-indigo-600 blur-sm opacity-40" />
            <div className="relative bg-indigo-600 p-1.5 sm:p-2 rounded-xl text-white shadow-md">
              <Gamepad2 size={16} className="sm:w-[17px] sm:h-[17px]" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            {assessment ? (
              <p className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.16em] leading-none mb-0.5 truncate
                ${isDark ? 'text-indigo-400' : 'text-indigo-600'}
              `}>{assessment.eyebrow ?? "Placement check"}</p>
            ) : !kidMode && (
              <p className={`hidden sm:block text-[9px] font-bold uppercase tracking-[0.2em] font-mono leading-none mb-0.5 truncate
                ${isDark ? 'text-slate-500' : 'text-slate-400'}
              `}>Worksheet Game</p>
            )}
            <h1 className={`font-extrabold leading-tight truncate text-xs sm:text-sm md:text-base max-w-[140px] xs:max-w-[220px] sm:max-w-none
              ${isDark ? 'text-white' : 'text-slate-900'}
            `}>{activeQuestion?.title || "Learning Time"}</h1>
          </div>
        </div>

        {/* Center – progress bar / pill (only rendered when there is more than 1 question/level) */}
        {questions.length > 1 && (
          <div className={`flex-1 max-w-[160px] sm:max-w-xs mx-1 sm:mx-4 ${kidMode ? "block" : "hidden md:block"}`}>
            <div className={`flex mb-1 ${kidMode ? "justify-center" : "justify-between"}`}>
              {!kidMode && (
                <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Progress
                </span>
              )}
              <span className={`font-bold ${kidMode ? 'text-xs sm:text-sm' : 'text-[9px] font-mono'} ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {currentIdx + 1} / {questions.length}
              </span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Right – compact mobile controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {!kidMode && !assessment && (
            <>
              <button
                onClick={() => { setShowAnalyticsModal(true); sounds.playPop(); }}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                  isDark
                    ? "bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/40 text-indigo-300"
                    : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 shadow-sm"
                }`}
                title="View & Export Interactive JSON Logs"
              >
                <Activity size={13} className="animate-pulse text-indigo-400" />
                <span>JSON Logs</span>
              </button>
              <button
                onClick={() => { toggleTheme(); sounds.playPop(); }}
                className={`${iconBtn} h-8 w-8 sm:h-9 sm:w-9 active:scale-95 ${isDark ? iconBtnDark : iconBtnLight}`}
                title={isDark ? "Light Mode" : "Dark Mode"}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <button
                onClick={resetSlide}
                className={`${iconBtn} h-8 w-8 sm:h-9 sm:w-9 active:scale-95 ${isDark ? iconBtnDark : iconBtnLight}`}
                title="Reset Challenge"
              >
                <RotateCcw size={14} />
              </button>
            </>
          )}
          <button onClick={toggleMute} className={`${iconBtn} h-8 w-8 sm:h-9 sm:w-9 active:scale-95 ${isDark ? iconBtnDark : iconBtnLight}`} title="Toggle sound">
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            onClick={toggleBrowserFullscreen}
            className={`${iconBtn} hidden xs:flex h-8 w-8 sm:h-9 sm:w-9 active:scale-95 ${isDark ? iconBtnDark : iconBtnLight}`}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {(!assessment || onExit) && (
            <>
              <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
              <button
                onClick={() => { (onExit ?? onClose)(); sounds.playPop(); }}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-rose-500 hover:bg-rose-400 active:scale-95 text-white rounded-xl text-[11px] font-bold transition-all shadow-sm shadow-rose-500/20 cursor-pointer shrink-0"
              >
                <X size={14} />
                <span className="inline">Exit</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* ══════════════════ MAIN CONTENT AREA ═══════════════════ */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-5 min-h-0 overflow-hidden">

        {/* ── CENTER: main canvas stage ── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 gap-3">

          {/* Canvas card */}
          <div className="relative flex-1 min-h-0 rounded-3xl border-0 overflow-hidden shadow-none bg-transparent transition-all duration-500">
            {/* Subtle grid texture in dark mode */}
            {isDark && (
              <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
                style={{
                  backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                  backgroundSize: "40px 40px"
                }}
              />
            )}

            {/* Canvas content */}
            <div className={`absolute inset-0 ${isDark ? 'canvas-dark' : 'canvas-light'}`}>
              {renderCanvas()}
            </div>

            {/* ── Success overlay ── */}
            {isSuccess && !assessment && (
              <div className="absolute inset-0 flex items-end justify-center pb-6 z-30 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-md mx-4">
                  <div className={`p-5 rounded-3xl flex flex-col gap-4 animate-scale-in border shadow-2xl transition-all duration-300 ${
                    isDark
                      ? 'bg-slate-900/95 border-emerald-500/30 text-emerald-100 shadow-black/80 backdrop-blur-xl'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400/40 shadow-emerald-500/25'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-2xl flex-shrink-0 transition-colors ${
                        isDark ? 'bg-emerald-950/80 border border-emerald-500/30 text-amber-300' : 'bg-white/20 text-amber-100'
                      }`}>
                        <Trophy size={22} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base leading-tight">
                          {kidMode ? "Great job! 🎉" : "Breathtaking! Correct! 🎉"}
                        </h3>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-emerald-100'}`}>
                          {kidMode
                            ? currentIdx < questions.length - 1
                              ? "Next question coming up…"
                              : "You finished this practice!"
                            : "You solved the counting challenge!"}
                        </p>
                      </div>
                    </div>
                    {/* Why it was the answer — authored per question, and shown only here,
                        after it has been solved, so it teaches without giving it away. */}
                    {activeQuestion?.config?.explanation && (
                      <p className={`rounded-2xl px-3 py-2 text-xs font-semibold leading-snug ${
                        isDark ? "bg-slate-800/70 text-slate-200" : "bg-white/20 text-white"
                      }`}>
                        {activeQuestion.config.explanation}
                      </p>
                    )}
                    {kidMode ? (
                      <div className={`h-2 overflow-hidden rounded-full ${isDark ? "bg-white/10" : "bg-white/25"}`}>
                        <div className="h-full w-full animate-pulse rounded-full bg-amber-300" />
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={resetSlide}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-2xl transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                              : 'bg-white/20 hover:bg-white/30 text-white'
                          }`}
                        >
                          <RotateCcw size={12} />
                          Play Again
                        </button>
                        <button
                          onClick={() => void handleNextSlide()}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold rounded-2xl transition-all shadow-md cursor-pointer ${
                            isDark
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                              : 'bg-yellow-400 hover:bg-yellow-300 text-indigo-950 shadow-yellow-400/20'
                          }`}
                        >
                          {currentIdx < questions.length - 1 ? (
                            <><span>Next Card</span><ArrowRight size={13} /></>
                          ) : (
                            <span>Finish Lesson 🎊</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom navigation bar ──
              Back and Next are both adult-only, and the dots are inert for a learner, so in
              kid mode this whole strip was a full-width band of decoration repeating the
              progress already shown in the header. Dropping it gives the canvas the height
              back — which is what the child is actually looking at. */}
          {(!kidMode || assessment) && (
          <div className="flex-shrink-0 flex items-center gap-3">
            {/* Prev */}
            <button
                onClick={handlePrevSlide}
                disabled={currentIdx === 0}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer border
                  ${currentIdx === 0
                    ? isDark
                      ? 'bg-white/[0.03] border-white/[0.05] text-slate-600 cursor-not-allowed'
                      : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                    : isDark
                      ? 'bg-white/[0.07] border-white/[0.1] text-slate-300 hover:bg-white/10 hover:text-white hover:scale-105'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:scale-105 shadow-sm'
                  }
                `}
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Back</span>
              </button>

            {/* Progress dots */}
            <div className="flex-1 flex items-center justify-center gap-1.5 overflow-hidden">
              {questions.length <= 20 ? (
                questions.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    aria-label={`Question ${idx + 1}${idx === currentIdx ? ", current" : ""}`}
                    disabled={Boolean(assessment)}
                    onClick={() => {
                      if (assessment) return;
                      setActiveId(q.id);
                      setIsSuccess(false);
                      sounds.playPop();
                    }}
                    className={`rounded-full transition-all duration-300
                      ${idx === currentIdx
                        ? 'w-6 h-2.5 bg-indigo-500'
                        : isDark
                          ? `w-2 h-2 bg-white/15 ${assessment ? "cursor-default" : "cursor-pointer hover:bg-white/30"}`
                          : `w-2 h-2 bg-black/15 ${assessment ? "cursor-default" : "cursor-pointer hover:bg-black/30"}`
                      }
                    `}
                  />
                ))
              ) : (
                <span className={`text-xs font-mono font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {currentIdx + 1} / {questions.length}
                </span>
              )}
            </div>

            {/* Next */}
            <button
                onClick={() => void handleNextSlide()}
                disabled={(assessment && !assessmentAnswered) || assessmentSaving}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-md
                  ${(assessment && !assessmentAnswered) || assessmentSaving
                    ? isDark
                      ? 'cursor-not-allowed border border-white/5 bg-white/[0.04] text-slate-600 shadow-none'
                      : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-300 shadow-none'
                    : currentIdx === questions.length - 1
                    ? 'bg-emerald-500 hover:bg-emerald-400 border border-emerald-400/30 text-white shadow-emerald-500/20 hover:scale-105'
                    : 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 text-white shadow-indigo-600/20 hover:scale-105'
                  }
                `}
              >
                <span className="hidden sm:inline">
                  {assessmentSaving
                    ? "Saving…"
                    : currentIdx === questions.length - 1
                      ? assessment?.finishLabel ?? "Finish"
                      : "Next"}
                </span>
                <ChevronRight size={16} />
              </button>
          </div>
          )}
          {assessment && (
            <div className={`-mt-1 text-center text-xs font-semibold ${
              assessmentError
                ? "text-rose-500"
                : assessmentAnswered
                  ? "text-emerald-500"
                  : isDark ? "text-slate-500" : "text-slate-400"
            }`} role={assessmentError ? "alert" : "status"}>
              {assessmentError ?? (assessmentAnswered
                ? "Response recorded"
                : kidMode ? "Have a go to keep moving" : "Check an answer to continue")}
            </div>
          )}
        </div>
      </div>

      {/* ── Interactive Logs / JSON Analytics Modal ── */}
      {!kidMode && !assessment && (
        <AnalyticsViewerModal
          isOpen={showAnalyticsModal}
          onClose={() => setShowAnalyticsModal(false)}
          isDark={isDark}
        />
      )}
      {/* ── Confetti Particles ──────────────────────────── */}
      {confetti.map(p => (
        <div
          key={p.id}
          style={{ left: p.left, animationDelay: p.delay, width: p.size, height: p.size }}
          className={`fixed -top-10 rounded-full opacity-0 animate-confetti z-[9999] pointer-events-none ${p.color}`}
        />
      ))}
    </div>
  );
};
