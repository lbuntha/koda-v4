/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { CountingQuestion } from "../types";
import { sounds } from "../sound";
import { QuestionAssetProvider } from "../assets/questionAsset";
import { CanvasAudienceProvider } from "./canvases/presentation";
import { CountCanvas } from "./canvases/CountCanvas";
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
import { Button, DotProgressIndicator, Spinner } from "./ui";
import { useZoomLock } from "../hooks/useZoomLock";

interface GameLauncherProps {
  questions: CountingQuestion[];
  activeId: string;
  setActiveId: (id: string) => void;
  /**
   * Called only after the last card has been solved.
   *
   * May return a promise — saving the lesson is several round trips, and the launcher stays
   * on screen showing that it is working until it settles.
   */
  onClose: () => void | Promise<void>;
  /** Leaves an unfinished player without reporting lesson completion. May be async, like `onClose`. */
  onExit?: () => void | Promise<void>;
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

/**
 * How long a way out waits for the outbox before going anyway.
 *
 * Long enough for a slow phone to land the save, short enough that a child is never stuck
 * looking at a spinner because the network stalled. Nothing is lost either way — the events
 * are on disk and retry on the next open.
 */
const SAVE_WAIT_MS = 5000;

/** Ring spinner for coloured buttons, where the brand mark's own palette would disappear. */
const ButtonSpinner: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span
    aria-hidden="true"
    className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none ${className}`}
  />
);

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
  /** Which way out is being saved, so the whole header and footer can wait as one. */
  const [leaving, setLeaving] = useState<"finish" | "exit" | null>(null);
  const [leaveWarning, setLeaveWarning] = useState<string | null>(null);
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
      // Keep curriculum difficulty in its canonical field. Canvas modes such as
      // "guided" or "independent" are presentation details, not mastery bands.
      difficulty: q.difficulty,
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

  /**
   * Hand control back to whoever opened the launcher — but only once the work is saved.
   *
   * Events reach the server through a debounced outbox, so tearing this screen down the instant
   * a child taps Finish or Exit races the last batch out of the buffer. On a phone that race is
   * usually lost: backgrounding freezes the tab and cancels the request in flight, and the
   * lesson looked unsaved when they came back. Flush first, show that it is happening, and cap
   * the wait so a stalled network cannot trap anyone here.
   */
  const leaveWith = async (reason: "finish" | "exit", handoff: () => void | Promise<void>) => {
    if (leaving) return; // a second tap must never run the handoff twice
    setLeaving(reason);
    setLeaveWarning(null);
    try {
      const saved = await analyticsLogger.flushWithin(SAVE_WAIT_MS);
      if (!saved) {
        // Kept on the device and sent on the next open, so this is a delay, not a loss.
        setLeaveWarning("Still saving — this will finish next time you're online.");
      }
      await handoff();
    } catch (cause) {
      setLeaveWarning(cause instanceof Error ? cause.message : "We could not finish saving just now.");
    } finally {
      setLeaving(null);
    }
  };

  const handleNextSlide = async () => {
    if (leaving) return;
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
      // lesson_complete is the event that credits the work, and it was just written this tick —
      // it is exactly the one that used to be lost on the way out.
      await leaveWith("finish", onClose);
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

    const Canvas = CANVAS_BY_TECHNIQUE[activeQuestion.technique] || CountCanvas;
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

  return (
    <div
      // Two fingers on a ten-frame drag read as a pinch; the activity surface is the one
      // place that has to stay put. Everything outside it keeps browser zoom.
      ref={zoomLockRef}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden font-sans select-none transition-colors duration-500 md:p-4 lg:p-5 ${isDark ? "bg-[#070A12]" : "bg-white"}`}
    >
      <div className={`relative flex h-full w-full flex-col overflow-hidden transition-colors duration-500 md:w-[92vw] md:rounded-[2rem] lg:w-[80vw] lg:max-w-[1600px] ${isDark ? "bg-[#0B0F1A]" : "bg-white"}`}>
      {/* ── Ambient glow blobs (dark mode only) ──────────── */}
      {isDark && (
        <>
          <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* ══════════════════ TOP NAVBAR ═══════════════════ */}
      <header className={`relative z-20 flex min-h-[4.5rem] shrink-0 items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 transition-colors duration-300 [-webkit-tap-highlight-color:transparent] sm:px-6 md:min-h-[5.25rem] md:px-8 md:py-4 lg:px-12
        ${isDark ? 'bg-[#0B0F1A]' : 'bg-white'}
      `}>
        {/* Left – branding & title */}
        <div className="flex min-w-0 flex-1 items-center justify-start gap-2 sm:gap-3">
          {(!assessment || onExit) && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => { sounds.playPop(); void leaveWith("exit", onExit ?? onClose); }}
              loading={leaving === "exit"}
              loadingText="Saving…"
              aria-label="Exit activity"
              title="Exit activity"
              className={`h-11 w-11 shrink-0 rounded-2xl border-2 shadow-none ${isDark ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" : "border-[#E1E3EA] bg-white text-[#9CA3AF] hover:border-[#D4D6DF] hover:text-[#707784]"}`}
            >
              <X size={20} />
              <span className="sr-only">Exit</span>
            </Button>
          )}
          {!kidMode && (
            <>
              <div className="relative hidden shrink-0 sm:block">
                <div className="absolute inset-0 rounded-xl bg-indigo-600 opacity-30 blur-sm" />
                <div className="relative rounded-xl bg-indigo-600 p-2 text-white shadow-md">
                  <Gamepad2 size={17} />
                </div>
              </div>
              <div className="hidden min-w-0 flex-1 sm:block">
                {assessment ? (
                  <p className={`mb-0.5 truncate text-[9px] font-bold uppercase leading-none tracking-[0.16em] ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{assessment.eyebrow ?? "Placement check"}</p>
                ) : (
                  <p className={`mb-0.5 truncate font-mono text-[9px] font-bold uppercase leading-none tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Worksheet Game</p>
                )}
                <h1 className={`max-w-[14rem] truncate text-sm font-extrabold leading-tight lg:text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeQuestion?.title || "Learning Time"}</h1>
              </div>
            </>
          )}
        </div>

        {/* Center – dot progress indicators (rendered when there is more than 1 question/level) */}
        <DotProgressIndicator
          current={currentIdx}
          total={questions.length}
          isDark={isDark}
          className="mx-1 min-w-[5rem] max-w-3xl flex-[1.7] sm:mx-4"
        />

        {/* Right – compact mobile controls */}
        <div className="flex items-center justify-end gap-1 sm:gap-1.5 flex-1 min-w-0 shrink-0">
          {!kidMode && !assessment && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setShowAnalyticsModal(true); sounds.playPop(); }}
                className={`hidden rounded-xl sm:inline-flex ${isDark ? "border-indigo-400/30 bg-indigo-400/10 text-indigo-300 hover:bg-indigo-400/20" : "border-[#DDD5FA] bg-[#F7F4FF] text-[#5B48D6] hover:bg-[#EFEAFF]"}`}
                title="View & Export Interactive JSON Logs"
              >
                <Activity size={13} className="animate-pulse text-indigo-400" />
                <span>JSON Logs</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => { toggleTheme(); sounds.playPop(); }}
                className={`hidden h-10 w-10 rounded-xl border-2 shadow-none sm:inline-flex ${isDark ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" : "border-[#E1E3EA] text-[#7D8491]"}`}
                title={isDark ? "Light Mode" : "Dark Mode"}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={resetSlide}
                className={`hidden h-10 w-10 rounded-xl border-2 shadow-none sm:inline-flex ${isDark ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" : "border-[#E1E3EA] text-[#7D8491]"}`}
                title="Reset Challenge"
              >
                <RotateCcw size={14} />
              </Button>
            </>
          )}
          <Button type="button" variant="outline" size="icon" onClick={toggleMute} className={`h-10 w-10 rounded-xl border-2 shadow-none ${isDark ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" : "border-[#E1E3EA] text-[#7D8491]"}`} title="Toggle sound" aria-label="Toggle sound">
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleBrowserFullscreen}
            className={`hidden h-10 w-10 rounded-xl border-2 shadow-none xs:inline-flex ${isDark ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" : "border-[#E1E3EA] text-[#7D8491]"}`}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
        </div>
      </header>

      {/* ══════════════════ MAIN CONTENT AREA ═══════════════════ */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col gap-4 overflow-hidden p-2 sm:p-4 md:flex-row md:p-6 lg:px-10">

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
                      <div className="flex flex-col gap-1.5">
                        <div className={`h-2 overflow-hidden rounded-full ${isDark ? "bg-white/10" : "bg-white/25"}`}>
                          <div className="h-full w-full animate-pulse rounded-full bg-amber-300" />
                        </div>
                        {leaving === "finish" && (
                          <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold">
                            <ButtonSpinner /> Saving your work…
                          </p>
                        )}
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
                          disabled={Boolean(leaving)}
                          aria-busy={leaving === "finish"}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold rounded-2xl transition-all shadow-md cursor-pointer disabled:cursor-wait disabled:opacity-80 ${
                            isDark
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                              : 'bg-yellow-400 hover:bg-yellow-300 text-indigo-950 shadow-yellow-400/20'
                          }`}
                        >
                          {leaving === "finish" ? (
                            <><ButtonSpinner /><span>Saving…</span></>
                          ) : currentIdx < questions.length - 1 ? (
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

            {/* Adult previews can jump between cards. Placement uses only the top
                question counter, so its footer stays clear and non-navigable. */}
            <div className="flex-1 flex items-center justify-center gap-1.5 overflow-hidden">
              {!assessment && (questions.length <= 20 ? (
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
              ))}
            </div>

            {/* Next */}
            <button
                onClick={() => void handleNextSlide()}
                disabled={(assessment && !assessmentAnswered) || assessmentSaving || Boolean(leaving)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-md
                  ${(assessment && !assessmentAnswered) || assessmentSaving || leaving
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
                  {assessmentSaving || leaving === "finish"
                    ? "Saving…"
                    : currentIdx === questions.length - 1
                      ? assessment?.finishLabel ?? "Finish"
                      : "Next"}
                </span>
                {leaving === "finish" ? <ButtonSpinner /> : <ChevronRight size={16} />}
              </button>
          </div>
          )}
          {assessmentError && (
            <div className="-mt-1 text-center text-xs font-semibold text-rose-500" role="alert">
              {assessmentError}
            </div>
          )}
          {/* Survives the curtain: if the handoff failed, the child is still here and needs to
              know the work is kept rather than gone. */}
          {leaveWarning && !leaving && (
            <div className="-mt-1 text-center text-xs font-semibold text-sky-500" role="status">
              {leaveWarning}
            </div>
          )}
        </div>
      </div>

      {/* ── Saving curtain ──
          A phone is where this matters: taps land on the canvas while the save is in flight,
          and without a scrim a child re-solves or re-taps Exit into a screen that is already
          leaving. It also answers "did my work count?" while the round trips finish. */}
      {leaving && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-6 backdrop-blur-[2px] animate-fade-in"
        >
          <div className={`flex flex-col items-center gap-3 rounded-3xl px-7 py-6 text-center shadow-2xl ${
            isDark ? "bg-[#151A2B] text-slate-100 shadow-black/60" : "bg-white text-slate-800"
          }`}>
            <Spinner size="lg" variant="violet" />
            <p className="text-sm font-extrabold">
              {leaving === "finish" ? "Saving your progress…" : "Saving before you go…"}
            </p>
            <p className={`max-w-[16rem] text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {leaveWarning ?? "Keep this open for a moment."}
            </p>
          </div>
        </div>
      )}

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
    </div>
  );
};
