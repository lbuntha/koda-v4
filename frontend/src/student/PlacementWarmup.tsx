import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { GradeBand } from "../api/auth";
import { placementApi, PlacementQuiz, PlacementResult } from "../api/placement";
import { CanvasPreview } from "../components/studio/CanvasPreview";
import { Button } from "../components/ui";
import { sounds } from "../sound";
import type { CountingQuestion } from "../types";
import { solvedSelection } from "./answerSelection";
import { placementBandPresentation } from "./placementBand";

interface Props {
  quiz: PlacementQuiz;
  band: GradeBand;
  onComplete: () => void;
}

export const PlacementWarmup: React.FC<Props> = ({ quiz, band, onComplete }) => {
  const presentation = placementBandPresentation(band);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => presentation.defaultDark);
  const [isMuted, setIsMuted] = useState(() => !sounds.isEnabled());
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const item = quiz.items[index];
  const isKid = band === "kid";
  const isFocus = band === "focus";

  const question = useMemo(() => item ? ({
    ...item,
    objectId: item.objectId || ((item.config as Record<string, unknown>)?.object as string) || "apple",
    targetCount: item.targetCount ?? 0,
    instruction: item.instruction || presentation.fallbackInstruction,
  } as CountingQuestion) : null, [item, presentation.fallbackInstruction]);

  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const record = (selection: string) => {
    if (!item || !selection) return;
    setAnswers(current => current[item.placementItemId]
      ? current
      : { ...current, [item.placementItemId]: selection });
  };

  const handleAttempt = (
    outcome: "correct" | "incorrect" | "partial",
    detail?: { expected?: unknown; selected?: unknown; details?: Record<string, any> },
  ) => {
    // Multi-stage multiplication reports each partial row. Only its final row
    // represents the selection the release grader expects.
    const stage = detail?.details?.stage;
    if (stage && stage !== "final") return;
    if (outcome === "incorrect" && detail?.selected != null) record(String(detail.selected));
  };

  const handleSuccess = () => {
    if (!question) return;
    record(solvedSelection(question) ?? "");
  };

  const next = async () => {
    if (!item || !answers[item.placementItemId]) return;
    sounds.playPop();
    if (index < quiz.items.length - 1) {
      setIndex(value => value + 1);
      return;
    }
    if (!quiz.placementId) return;
    setSaving(true);
    setError(null);
    try {
      const completed = await placementApi.submit(quiz.placementId, quiz.items.map(entry => ({
        questionId: entry.placementItemId,
        selection: answers[entry.placementItemId] || "",
      })));
      sounds.playSuccess();
      setResult(completed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save placement");
    } finally {
      setSaving(false);
    }
  };

  const previous = () => {
    if (index > 0) {
      sounds.playPop();
      setIndex(value => value - 1);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    sounds.setEnabled(!nextMuted);
    if (!nextMuted) sounds.playPop();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  if (result) {
    const frontierItem = quiz.items.find(entry => entry.skillId === result.frontierSkillId)
      ?? quiz.items[quiz.items.length - 1];
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-5 ${
        isDark ? "bg-[#0B0F1A] text-white" : isKid ? "bg-[#F8F3FF] bg-[image:linear-gradient(145deg,#F8F3FF,#FFF8FC,#EFF5FF)] text-[#21183D]" : "bg-[#F6F5FA] text-[#1B2130]"
      }`} data-band={band}>
        <div className={`pointer-events-none absolute left-1/3 top-0 h-[420px] w-[520px] rounded-full blur-3xl ${
          isDark ? "bg-indigo-600/15" : "bg-violet-300/25"
        }`} />
        <div className={`relative w-full text-center backdrop-blur-xl ${
          isKid
            ? "max-w-xl rounded-[2.5rem] border-2 border-white bg-white/80 p-8 shadow-[0_28px_80px_-35px_rgba(86,62,162,0.5)] sm:p-10"
            : isDark
              ? "max-w-lg rounded-3xl border border-white/10 bg-slate-900/90 p-7 shadow-2xl shadow-black/50"
              : "max-w-lg rounded-3xl border border-[#E1DDF0] bg-white/90 p-7 shadow-xl shadow-violet-200/30"
        }`}>
          <span className={`mx-auto flex items-center justify-center ${
            isKid
              ? "h-24 w-24 rounded-[2rem] bg-amber-100 text-5xl"
              : "h-16 w-16 rounded-2xl bg-emerald-500/15 text-emerald-500"
          }`}>
            {isKid ? "🎉" : <CheckCircle2 size={32} />}
          </span>
          <p className={`mt-5 text-[10px] font-bold uppercase tracking-[0.18em] ${
            isDark ? "text-indigo-400" : isKid ? "text-[#806DD2]" : "text-[#6B57D8]"
          }`}>
            {presentation.completionEyebrow}
          </p>
          <h1 className={`${isKid ? "mt-2 text-3xl font-black" : "mt-2 text-2xl font-extrabold"}`}>
            {presentation.completionTitle}
          </h1>
          <p className={`mx-auto mt-3 max-w-sm text-sm leading-relaxed ${
            isDark ? "text-slate-400" : "text-[#766D88]"
          }`}>
            {presentation.completionBody}{" "}
            {!isKid && (
              <>We’ll begin with <strong className={isDark ? "text-white" : "text-[#21183D]"}>{frontierItem?.title || "your assigned skill"}</strong>.</>
            )}
          </p>
          {presentation.showCompletionMetrics && (
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-[#E1DDF0] bg-[#F8F7FC]"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-[#817895]"}`}>Skills checked</p>
                <p className="mt-1 text-xl font-extrabold">{new Set(quiz.items.map(entry => entry.skillId)).size}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-[#E1DDF0] bg-[#F8F7FC]"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-[#817895]"}`}>Ready to continue</p>
                <p className="mt-1 text-xl font-extrabold">{result.eligibleSkillIds.length}</p>
              </div>
            </div>
          )}
          <Button
            size={isKid ? "lg" : "md"}
            className={`mt-6 w-full ${isKid ? "h-15 rounded-full text-lg font-black" : ""}`}
            onClick={onComplete}
          >
            {presentation.continueLabel} <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  if (!item || !question) return null;

  const iconButton = `flex items-center justify-center border transition-colors ${
    isKid ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl"
  } ${
    isDark
      ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
  }`;
  const answered = Boolean(answers[item.placementItemId]);

  return (
    <div
      className={`fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden transition-colors ${
        isDark
          ? "bg-[#0B0F1A] text-white"
          : isKid
            ? "bg-[#F8F3FF] bg-[image:linear-gradient(145deg,#F8F3FF_0%,#FFF8FC_48%,#EFF5FF_100%)] text-[#21183D]"
            : "bg-[#FBFAFF] text-slate-900"
      }`}
      data-band={band}
    >
      {isDark && (
        <>
          <div className="pointer-events-none absolute left-1/3 top-0 h-[420px] w-[520px] rounded-full bg-indigo-600/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 h-[320px] w-[420px] rounded-full bg-violet-600/10 blur-3xl" />
        </>
      )}

      <header className={`relative z-20 flex shrink-0 items-center justify-between border-b px-4 md:px-6 ${
        isKid ? "h-20" : "h-16"
      } ${isDark ? "border-white/[0.06] bg-white/[0.03]" : isKid ? "border-white bg-white/65" : "border-slate-200 bg-white/80"}`}>
        <div className="flex items-center gap-3">
          <span className={`flex items-center justify-center overflow-hidden text-white shadow-lg ${
            isKid
              ? "h-13 w-13 rounded-2xl border-2 border-white bg-white p-1 shadow-violet-200"
              : "h-10 w-10 rounded-xl bg-indigo-600 shadow-indigo-600/25"
          }`}>
            {isKid ? <img src="/assets/owl-mascot.svg" alt="" className="h-full w-full object-contain" /> : <Gamepad2 size={18} />}
          </span>
          <div>
            <p className={`text-[9px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-500" : isKid ? "text-[#806DD2]" : "text-slate-400"}`}>{presentation.eyebrow}</p>
            <h1 className={isKid ? "text-base font-black" : "text-sm font-extrabold"}>{item.title}</h1>
          </div>
        </div>

        <div className="mx-8 hidden max-w-md flex-1 md:block">
          <div className="mb-1.5 flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
            <span>{isKid ? "Your adventure" : "Progress"}</span>
            <span className={isKid ? "text-[#806DD2]" : "text-indigo-400"}>{index + 1} / {quiz.items.length}</span>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {quiz.items.map((entry, step) => (
              <span
                key={entry.placementItemId}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  step <= index
                    ? isKid ? "bg-[#806DD2]" : "bg-indigo-500"
                    : isDark ? "bg-white/10" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {presentation.allowThemeToggle && (
            <Button type="button" variant="ghost" size="icon" className={iconButton} onClick={() => { setIsDark(value => !value); sounds.playPop(); }} aria-label={isDark ? "Use light mode" : "Use dark mode"}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className={iconButton} onClick={toggleMute} aria-label="Toggle sound">
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className={iconButton} onClick={toggleFullscreen} aria-label="Toggle fullscreen">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
        </div>
      </header>

      <main className={`relative z-10 flex min-h-0 flex-1 flex-col ${isKid ? "p-3 md:p-6" : isFocus ? "p-3 md:p-4" : "p-3 md:p-5"}`}>
        <div className={`mb-2 flex shrink-0 items-center justify-center gap-2 text-center ${isKid ? "min-h-10" : ""}`}>
          <BookOpen size={isKid ? 17 : 14} className={isKid ? "text-[#806DD2]" : "text-indigo-400"} />
          <span className={`${isKid ? "text-sm font-bold" : "text-xs font-semibold"} ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            {item.instruction || presentation.fallbackInstruction}
          </span>
          {!isKid && (
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${isDark ? "bg-white/10 text-indigo-300" : "bg-indigo-50 text-indigo-700"}`}>{item.difficulty}</span>
          )}
        </div>

        <CanvasPreview
          key={item.placementItemId}
          question={question}
          isDark={isDark}
          onSuccess={handleSuccess}
          onAttempt={handleAttempt}
          className={`min-h-0 flex-1 overflow-hidden border-0 bg-transparent ${
            isKid ? "rounded-[2.5rem]" : isFocus ? "rounded-2xl" : "rounded-3xl"
          } ${isDark ? "canvas-dark" : "canvas-light"}`}
        />

        {error && <p className="mx-auto mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-400">{error}</p>}

        <nav className={`mt-3 flex shrink-0 items-center justify-between gap-4 ${isKid ? "pb-1" : ""}`}>
          <Button size={isKid ? "lg" : "md"} variant="secondary" className={isKid ? "rounded-full font-black" : ""} onClick={previous} disabled={index === 0}><ChevronLeft size={16} /> Back</Button>
          <span className={`hidden text-xs font-semibold sm:block ${answered ? "text-emerald-400" : isDark ? "text-slate-500" : "text-slate-400"}`}>
            {answered
              ? <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> {isKid ? "Nice work!" : "Response recorded"}</span>
              : isKid ? "Have a go to keep moving" : "Complete or check the activity to continue"}
          </span>
          <Button size={isKid ? "lg" : "md"} className={isKid ? "rounded-full font-black" : ""} onClick={() => void next()} loading={saving} loadingText="Saving..." disabled={!answered}>
            {index === quiz.items.length - 1 ? (isKid ? "All done" : "Finish placement") : "Next"} <ChevronRight size={16} />
          </Button>
        </nav>
      </main>
    </div>
  );
};
