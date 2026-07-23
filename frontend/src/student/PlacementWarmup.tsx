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
import { placementApi, PlacementQuiz, PlacementResult } from "../api/placement";
import { CanvasPreview } from "../components/studio/CanvasPreview";
import { Button } from "../components/ui";
import { sounds } from "../sound";
import type { CountingQuestion } from "../types";

interface Props {
  quiz: PlacementQuiz;
  onComplete: () => void;
}

const COUNTING = new Set([
  "ONE_TO_ONE", "MOVE_AND_COUNT", "LINE_UP_AND_COUNT", "GROUP_IN_TENS",
  "COUNT_ON", "COUNT_BACK", "DIFFERENT_ARRANGEMENTS", "COUNT_MAGNETS", "SUBITIZE",
]);

/** Resolve the same derived numeric key the server recomputes after submit. */
const expectedSelection = (question: CountingQuestion): string => {
  const config = question.config ?? {};
  if (COUNTING.has(question.technique)) {
    if (question.targetCount != null) return String(question.targetCount);
    if (config.baseCount != null && config.extraCount != null) return String(config.baseCount + config.extraCount);
    if (config.totalCount != null && config.removeCount != null) return String(config.totalCount - config.removeCount);
    if (config.totalCount != null) return String(config.totalCount);
  }

  switch (question.technique) {
    case "ADDITION_SANDBOX": return String((config.addend1 ?? 0) + (config.addend2 ?? 0));
    case "ADDITION_TUTOR":
    case "ADDITION_COLUMN": return String((config.num1 ?? 0) + (config.num2 ?? 0));
    case "ADDITION_COLUMN_MULTI": return String((config.num1 ?? 0) + (config.num2 ?? 0) + (config.num3 ?? 0));
    case "SUBTRACTION_SANDBOX":
    case "SUBTRACTION_COLUMN": return String((config.minuend ?? 0) - (config.subtrahend ?? 0));
    case "SUBTRACTION_COLUMN_MULTI": return String((config.minuend ?? 0) - (config.subtrahend ?? 0) - (config.subtrahend2 ?? 0));
    case "MULTIPLICATION_COLUMN": return String((config.multiplicand ?? 0) * (config.multiplier ?? 0));
    case "MULTIPLICATION_ARRAY": return String((config.rows ?? 0) * (config.cols ?? 0));
    default: return "";
  }
};

export const PlacementWarmup: React.FC<Props> = ({ quiz, onComplete }) => {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [isMuted, setIsMuted] = useState(() => !sounds.isEnabled());
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const item = quiz.items[index];
  const progress = ((index + 1) / Math.max(quiz.items.length, 1)) * 100;

  const question = useMemo(() => item ? ({
    ...item,
    objectId: item.objectId || ((item.config as Record<string, unknown>)?.object as string) || "apple",
    targetCount: item.targetCount ?? 0,
    instruction: item.instruction || "Solve this challenge to continue.",
  } as CountingQuestion) : null, [item]);

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
    detail?: { expected?: string; selected?: string; details?: Record<string, any> },
  ) => {
    // Multi-stage multiplication reports each partial row. Only its final row
    // represents the selection the release grader expects.
    const stage = detail?.details?.stage;
    if (stage && stage !== "final") return;
    if (outcome === "incorrect" && detail?.selected) record(detail.selected);
  };

  const handleSuccess = () => {
    if (!question) return;
    record(expectedSelection(question));
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
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0B0F1A] p-5 text-white">
        <div className="pointer-events-none absolute left-1/3 top-0 h-[420px] w-[520px] rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/90 p-7 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400"><CheckCircle2 size={32} /></span>
          <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">Placement complete</p>
          <h1 className="mt-2 text-2xl font-extrabold">Your starting point is ready</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
            We’ll begin with <strong className="text-white">{frontierItem?.title || "your assigned skill"}</strong>. Placement chooses where practice starts; mastery is earned during lessons.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Skills checked</p><p className="mt-1 text-xl font-extrabold">{new Set(quiz.items.map(entry => entry.skillId)).size}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ready to continue</p><p className="mt-1 text-xl font-extrabold">{result.eligibleSkillIds.length}</p></div>
          </div>
          <Button className="mt-6 w-full" onClick={onComplete}>Start practice <ChevronRight size={16} /></Button>
        </div>
      </div>
    );
  }

  if (!item || !question) return null;

  const iconButton = `flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
    isDark
      ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
  }`;
  const answered = Boolean(answers[item.placementItemId]);

  return (
    <div className={`fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden transition-colors ${isDark ? "bg-[#0B0F1A] text-white" : "bg-[#FBFAFF] text-slate-900"}`}>
      {isDark && (
        <>
          <div className="pointer-events-none absolute left-1/3 top-0 h-[420px] w-[520px] rounded-full bg-indigo-600/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 h-[320px] w-[420px] rounded-full bg-violet-600/10 blur-3xl" />
        </>
      )}

      <header className={`relative z-20 flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-6 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-slate-200 bg-white/80"}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"><Gamepad2 size={18} /></span>
          <div>
            <p className={`font-mono text-[9px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Quick placement</p>
            <h1 className="text-sm font-extrabold">{item.title}</h1>
          </div>
        </div>

        <div className="mx-8 hidden max-w-md flex-1 md:block">
          <div className="mb-1 flex justify-between font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500"><span>Progress</span><span className="text-indigo-400">{index + 1} / {quiz.items.length}</span></div>
          <div className={`h-1.5 overflow-hidden rounded-full ${isDark ? "bg-white/10" : "bg-slate-200"}`}><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${progress}%` }} /></div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className={iconButton} onClick={() => { setIsDark(value => !value); sounds.playPop(); }} aria-label={isDark ? "Use light mode" : "Use dark mode"}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button type="button" className={iconButton} onClick={toggleMute} aria-label="Toggle sound">{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
          <button type="button" className={iconButton} onClick={toggleFullscreen} aria-label="Toggle fullscreen">{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col p-3 md:p-5">
        <div className="mb-2 flex shrink-0 items-center justify-center gap-2 text-center">
          <BookOpen size={14} className="text-indigo-400" />
          <span className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>{item.instruction || "Solve the challenge. Your first checked answer is used for placement."}</span>
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${isDark ? "bg-white/10 text-indigo-300" : "bg-indigo-50 text-indigo-700"}`}>{item.difficulty}</span>
        </div>

        <CanvasPreview
          key={item.placementItemId}
          question={question}
          isDark={isDark}
          onSuccess={handleSuccess}
          onAttempt={handleAttempt}
          className={`min-h-0 flex-1 overflow-hidden rounded-3xl border-0 bg-transparent ${isDark ? "canvas-dark" : "canvas-light"}`}
        />

        {error && <p className="mx-auto mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-400">{error}</p>}

        <nav className="mt-3 flex shrink-0 items-center justify-between gap-4">
          <Button variant="secondary" onClick={previous} disabled={index === 0}><ChevronLeft size={16} /> Back</Button>
          <span className={`hidden text-xs font-semibold sm:block ${answered ? "text-emerald-400" : isDark ? "text-slate-500" : "text-slate-400"}`}>
            {answered ? <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Response recorded</span> : "Complete or check the activity to continue"}
          </span>
          <Button onClick={() => void next()} loading={saving} loadingText="Saving..." disabled={!answered}>
            {index === quiz.items.length - 1 ? "Finish placement" : "Next"} <ChevronRight size={16} />
          </Button>
        </nav>
      </main>
    </div>
  );
};
