import React, { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { GradeBand } from "../api/auth";
import { placementApi, PlacementQuiz, PlacementResult } from "../api/placement";
import { GameLauncher } from "../components/GameLauncher";
import { Button } from "../components/ui";
import { useThemeMode } from "../theme/appTheme";
import type { CountingQuestion } from "../types";
import { placementBandPresentation } from "./placementBand";
import { CelebrationEffects } from "./home/shared";

interface Props {
  quiz: PlacementQuiz;
  band: GradeBand;
  onComplete: () => void;
  /** Leave without submitting; the same server placement resumes next time. */
  onExit: () => void;
}

/**
 * Placement is an assessment configuration for GameLauncher, not a second
 * activity player. The released questions keep their normal canvas and input
 * behaviour; this adapter only maps their first responses to placement ids and
 * shows the server-computed starting point when submission completes.
 */
export const PlacementWarmup: React.FC<Props> = ({ quiz, band, onComplete, onExit }) => {
  const presentation = placementBandPresentation(band);
  const [theme] = useThemeMode();
  const isDark = theme === "dark";
  const isKid = band === "kid";
  const [result, setResult] = useState<PlacementResult | null>(null);

  const questions = useMemo(() => quiz.items.map(item => ({
    ...item,
    objectId: item.objectId || ((item.config as Record<string, unknown>)?.object as string) || "apple",
    targetCount: item.targetCount ?? 0,
    instruction: item.instruction || presentation.fallbackInstruction,
  } as CountingQuestion)), [quiz.items, presentation.fallbackInstruction]);
  const [activeId, setActiveId] = useState(() => questions[0]?.id || "");
  const placementIdByQuestionId = useMemo(
    () => new Map(quiz.items.map(item => [item.id, item.placementItemId])),
    [quiz.items],
  );

  const submit = async (responses: Array<{ questionId: string; selection: string }>) => {
    if (!quiz.placementId) throw new Error("Placement is not available");
    setResult(await placementApi.submit(quiz.placementId, responses));
  };

  if (result) {
    const frontierItem = quiz.items.find(entry => entry.skillId === result.frontierSkillId)
      ?? quiz.items[quiz.items.length - 1];
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-5 ${
        isDark
          ? "bg-[#0B0F1A] text-white"
          : isKid
            ? "bg-[linear-gradient(145deg,#F8F3FF,#FFF8FC,#EFF5FF)] text-[#21183D]"
            : "bg-[#F6F5FA] text-[#1B2130]"
      }`} data-band={band}>
        <CelebrationEffects tone="party" className="fixed inset-0" />
        <div className={`pointer-events-none absolute left-1/3 top-0 h-[420px] w-[520px] rounded-full blur-3xl ${
          isDark ? "bg-indigo-600/15" : "bg-violet-300/25"
        }`} />
        <div className={`koda-celebration-card relative w-full text-center backdrop-blur-xl ${
          isKid
            ? "max-w-xl rounded-[2.5rem] border-2 border-white bg-white/80 p-8 shadow-[0_28px_80px_-35px_rgba(86,62,162,0.5)] sm:p-10"
            : isDark
              ? "max-w-lg rounded-3xl border border-white/10 bg-slate-900/90 p-7 shadow-2xl shadow-black/50"
              : "max-w-lg rounded-3xl border border-[#E1DDF0] bg-white/90 p-7 shadow-xl shadow-violet-200/30"
        }`}>
          <span className={`koda-celebration-icon mx-auto flex items-center justify-center ${
            isKid
              ? "h-24 w-24 rounded-[2rem] bg-amber-100 text-5xl"
              : "h-16 w-16 rounded-2xl bg-emerald-500/15 text-emerald-500"
          }`}>
            {isKid ? <span className="koda-celebration-icon-art">🎉</span> : <CheckCircle2 className="koda-celebration-icon-art" size={32} />}
          </span>
          <div className="koda-celebration-copy">
            <p className={`mt-5 text-[10px] font-bold uppercase tracking-[0.18em] ${
              isDark ? "text-indigo-400" : isKid ? "text-[#7059C8]" : "text-[#6B57D8]"
            }`}>{presentation.completionEyebrow}</p>
            <h1 className={isKid ? "mt-2 text-3xl font-black" : "mt-2 text-2xl font-extrabold"}>
              {presentation.completionTitle}
            </h1>
            <p className={`mx-auto mt-3 max-w-sm text-sm leading-relaxed ${isDark ? "text-slate-400" : "text-[#766D88]"}`}>
              {presentation.completionBody}{" "}
              {!isKid && (
                <>We’ll begin with <strong className={isDark ? "text-white" : "text-[#21183D]"}>{frontierItem?.title || "your assigned skill"}</strong>.</>
              )}
            </p>
          </div>
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
            className={`koda-celebration-cta mt-6 w-full ${isKid ? "h-15 rounded-full text-lg font-black" : ""}`}
            onClick={onComplete}
          >
            {presentation.continueLabel} <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  if (!questions.length || !activeId) return null;

  return (
    <GameLauncher
      questions={questions}
      activeId={activeId}
      setActiveId={setActiveId}
      onClose={() => undefined}
      onExit={onExit}
      kidMode={isKid}
      assessment={{
        eyebrow: presentation.eyebrow,
        finishLabel: isKid ? "All done" : "Finish placement",
        responseId: question => placementIdByQuestionId.get(question.id) ?? question.id,
        onComplete: submit,
      }}
    />
  );
};
