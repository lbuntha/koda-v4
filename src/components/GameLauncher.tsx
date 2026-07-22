/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { CountingQuestion, CUSTOM_SVG_OBJECT_PLACEHOLDER } from "../types";
import { sounds } from "../sound";
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

interface GameLauncherProps {
  questions: CountingQuestion[];
  activeId: string;
  setActiveId: (id: string) => void;
  onClose: () => void;
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
  onClose
}) => {
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => !sounds.isEnabled());
  const [isDark, setIsDark] = useState<boolean>(true);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);

  const activeQuestion = questions.find(q => q.id === activeId) || questions[0];
  const currentIdx = questions.findIndex(q => q.id === activeId);

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
      slideIndex: idx,
      totalSlides: questions.length,
      questionTitle: q.title,
    };
  };

  // Log slide view for the standardized learning log
  useEffect(() => {
    setIsSuccess(false);
    setConfetti([]);
    if (activeQuestion) {
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
  const handleAttempt = (outcome: AttemptOutcome, detail?: { expected?: string; selected?: string }) => {
    if (!activeQuestion) return;
    analyticsLogger.logAttempt(slideContext(activeQuestion, currentIdx), outcome, detail);
  };

  // Synchronize dynamic CUSTOM_SVG_OBJECT_PLACEHOLDER for the slide player canvas
  useEffect(() => {
    if (activeQuestion?.config?.assetType === "custom_svg") {
      CUSTOM_SVG_OBJECT_PLACEHOLDER.emoji = activeQuestion.config.customSvgMarkup || "";
      CUSTOM_SVG_OBJECT_PLACEHOLDER.label = activeQuestion.config.customSvgLabel || "Custom Shape";
    }
  }, [activeId, activeQuestion?.config?.assetType, activeQuestion?.config?.customSvgMarkup, activeQuestion?.config?.customSvgLabel]);

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
    setIsSuccess(true);
    triggerConfetti();
    handleAttempt("correct");
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
    if (activeQuestion) {
      analyticsLogger.logSlideReset(slideContext(activeQuestion, currentIdx));
    }
    const currentId = activeId;
    setActiveId("");
    setTimeout(() => setActiveId(currentId), 30);
  };

  const handleNextSlide = () => {
    setIsSuccess(false);
    if (currentIdx < questions.length - 1) {
      setActiveId(questions[currentIdx + 1].id);
      sounds.playPop();
    } else {
      analyticsLogger.logLessonComplete({ slideIndex: currentIdx, totalSlides: questions.length });
      sounds.playSuccess();
      onClose();
    }
  };

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
      onAttempt: handleAttempt
    };

    const Canvas = CANVAS_BY_TECHNIQUE[activeQuestion.technique] || OneToOneCanvas;
    return (
      <LazyBoundary>
        <Canvas key={activeQuestion.id} {...canvasProps} />
      </LazyBoundary>
    );
  };

  const iconBtn = `p-2.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center`;
  const iconBtnDark = `bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white`;
  const iconBtnLight = `bg-black/5 hover:bg-black/10 border-black/10 text-slate-500 hover:text-slate-800`;

  return (
    <div
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
      <div className={`flex-shrink-0 flex items-center justify-between px-4 md:px-6 h-14 border-b z-20 transition-colors duration-500
        ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white/60 border-black/[0.06] backdrop-blur-md'}
      `}>
        {/* Left – branding */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-indigo-600 blur-sm opacity-40" />
            <div className="relative bg-indigo-600 p-2 rounded-xl text-white shadow-md">
              <Gamepad2 size={17} />
            </div>
          </div>
          <div className="hidden sm:block">
            <p className={`text-[9px] font-bold uppercase tracking-[0.2em] font-mono leading-none mb-0.5
              ${isDark ? 'text-slate-500' : 'text-slate-400'}
            `}>Worksheet Game</p>
            <h1 className={`text-sm font-extrabold leading-none
              ${isDark ? 'text-white' : 'text-slate-800'}
            `}>{activeQuestion?.title || "Learning Time"}</h1>
          </div>
        </div>

        {/* Center – progress bar */}
        <div className="flex-1 max-w-xs mx-6 hidden md:block">
          <div className="flex justify-between mb-1">
            <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Progress
            </span>
            <span className={`text-[9px] font-mono font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
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

        {/* Right – controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setShowAnalyticsModal(true); sounds.playPop(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
              isDark
                ? "bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/40 text-indigo-300"
                : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 shadow-sm"
            }`}
            title="View & Export Interactive JSON Logs (FastAPI ready)"
          >
            <Activity size={13} className="animate-pulse text-indigo-400" />
            <span className="hidden sm:inline">JSON Logs</span>
          </button>
          <button
            onClick={() => { setIsDark(d => !d); sounds.playPop(); }}
            className={`${iconBtn} ${isDark ? iconBtnDark : iconBtnLight}`}
            title={isDark ? "Light Mode" : "Dark Mode"}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={resetSlide}
            className={`${iconBtn} ${isDark ? iconBtnDark : iconBtnLight}`}
            title="Reset Challenge"
          >
            <RotateCcw size={15} />
          </button>
          <button onClick={toggleMute} className={`${iconBtn} ${isDark ? iconBtnDark : iconBtnLight}`} title="Toggle sound">
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button onClick={toggleBrowserFullscreen} className={`${iconBtn} ${isDark ? iconBtnDark : iconBtnLight}`}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
          <button
            onClick={() => { onClose(); sounds.playPop(); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-[11px] font-bold transition-all shadow-md shadow-rose-500/20 cursor-pointer"
          >
            <X size={13} />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>

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
            {isSuccess && (
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
                        <h3 className="font-extrabold text-base leading-tight">Breathtaking! Correct! 🎉</h3>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-emerald-100'}`}>You solved the counting challenge!</p>
                      </div>
                    </div>
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
                        onClick={handleNextSlide}
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
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom navigation bar ── */}
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
                    onClick={() => { setActiveId(q.id); setIsSuccess(false); sounds.playPop(); }}
                    className={`rounded-full transition-all duration-300 cursor-pointer
                      ${idx === currentIdx
                        ? 'w-6 h-2.5 bg-indigo-500'
                        : isDark
                          ? 'w-2 h-2 bg-white/15 hover:bg-white/30'
                          : 'w-2 h-2 bg-black/15 hover:bg-black/30'
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
              onClick={handleNextSlide}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer shadow-md
                ${currentIdx === questions.length - 1
                  ? 'bg-emerald-500 hover:bg-emerald-400 border border-emerald-400/30 text-white shadow-emerald-500/20 hover:scale-105'
                  : 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 text-white shadow-indigo-600/20 hover:scale-105'
                }
              `}
            >
              <span className="hidden sm:inline">
                {currentIdx === questions.length - 1 ? "Finish" : "Next"}
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Interactive Logs / JSON Analytics Modal ── */}
      <AnalyticsViewerModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        isDark={isDark}
      />
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
