import React, { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { GradeBand } from "../api/auth";
import { placementApi, PlacementQuiz, PlacementResult } from "../api/placement";
import { GameLauncher } from "../components/GameLauncher";
import { Button } from "../components/ui";
import { useThemeMode } from "../theme/appTheme";
import {
  bodyTextClass,
  eyebrowTextClass,
  insetPanelClass,
  overlayCardClass,
  overlayCardPadding,
  type SurfaceScale
} from "../theme/surfaces";
import { accentIconClass } from "../components/canvases/canvasTheme";
import type { CountingQuestion } from "../types";
import { placementBandPresentation } from "./placementBand";
import { CelebrationEffects } from "./home/shared";

interface Props {
  quiz: PlacementQuiz;
  band: GradeBand;
  onComplete: () => void | Promise<void>;
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
  /** Grade-band ramp for the finish card — Koda runs from grade 1 to 12. */
  const scale: SurfaceScale = isKid ? "kid" : "standard";
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

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

  const continuePlacement = async () => {
    setContinuing(true);
    setContinueError(null);
    try {
      await onComplete();
    } catch (reason) {
      setContinueError(reason instanceof Error ? reason.message : "Could not load the next subject yet.");
    } finally {
      setContinuing(false);
    }
  };

  const subjectProgress = quiz.subjectPosition && quiz.subjectTotal
    ? `Subject ${quiz.subjectPosition} of ${quiz.subjectTotal}`
    : null;

  if (result) {
    const frontierItem = quiz.items.find(entry => entry.skillId === result.frontierSkillId)
      ?? quiz.items[quiz.items.length - 1];
    return (
      /*
        One card, two ramps. This used to be four hand-written variants — kid/adult
        crossed with light/dark — each with its own radius, border weight and shadow,
        and an amber tile that broke the no-yellow rule. The band now picks a `scale`
        and everything steps along it; the surface itself comes from the shared
        tokens the success card and saving curtain use, so the end of a placement
        and the end of a lesson read as the same product.
      */
      <div className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto
        px-4 py-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 ${
        isDark
          ? "bg-[#0B0F1A] text-white"
          : isKid
            ? "bg-[linear-gradient(145deg,#F8F3FF,#FFF8FC,#EFF5FF)] text-[#21183D]"
            : "bg-[#F6F5FA] text-[#1B2130]"
      }`} data-band={band}>
        <CelebrationEffects tone="party" className="fixed inset-0" />
        <div className={`pointer-events-none absolute left-1/3 top-0 h-[420px] w-[520px] max-w-full rounded-full blur-3xl ${
          isDark ? "bg-indigo-600/15" : "bg-violet-300/25"
        }`} />
        <div className={`koda-celebration-card relative flex w-full flex-col text-center
          ${scale === "kid" ? "max-w-xl" : "max-w-lg"}
          ${overlayCardClass(isDark, "primary")} ${overlayCardPadding(scale)}`}>
          {/* One tile, sized by band — the brand primary, same as the trim and the CTA. */}
          <span className={`koda-celebration-icon mx-auto flex items-center justify-center rounded-[1.75rem]
            ${accentIconClass("violet", isDark)} ${
              scale === "kid"
                ? "h-20 w-20 text-4xl sm:h-24 sm:w-24 sm:text-5xl"
                : "h-14 w-14 sm:h-16 sm:w-16"
            }`}>
            {isKid
              ? <span className="koda-celebration-icon-art">🎉</span>
              : <CheckCircle2 className="koda-celebration-icon-art h-7 w-7 sm:h-8 sm:w-8" />}
          </span>
          <div className="koda-celebration-copy">
            <p className={eyebrowTextClass(isDark)}>
              {[presentation.completionEyebrow, quiz.subjectName, subjectProgress].filter(Boolean).join(" · ")}
            </p>
            <h1 className={`mt-2 ${
              scale === "kid"
                ? "text-2xl font-black sm:text-3xl"
                : "text-xl font-extrabold sm:text-2xl"
            } ${isDark ? "text-white" : "text-slate-900"}`}>
              {presentation.completionTitle}
            </h1>
            <p className={`mx-auto mt-3 max-w-sm leading-relaxed ${bodyTextClass(isDark, scale)}`}>
              {presentation.completionBody}{" "}
              {!isKid && (
                <>We’ll begin with <strong className={isDark ? "text-white" : "text-slate-900"}>{frontierItem?.title || "your assigned skill"}</strong>.</>
              )}
            </p>
          </div>
          {presentation.showCompletionMetrics && (
            /* Two up from the narrowest phone: the labels are short and the numbers
               are the point, so they never need to stack. */
            <div className="grid grid-cols-2 gap-2.5 text-left sm:gap-3">
              <div className={`p-3 sm:p-4 ${insetPanelClass(isDark)}`}>
                <p className={eyebrowTextClass(isDark)}>Skills checked</p>
                <p className={`mt-1 text-lg font-extrabold sm:text-xl ${isDark ? "text-white" : "text-slate-900"}`}>
                  {new Set(quiz.items.map(entry => entry.skillId)).size}
                </p>
              </div>
              <div className={`p-3 sm:p-4 ${insetPanelClass(isDark)}`}>
                <p className={eyebrowTextClass(isDark)}>Ready to continue</p>
                <p className={`mt-1 text-lg font-extrabold sm:text-xl ${isDark ? "text-white" : "text-slate-900"}`}>
                  {result.eligibleSkillIds.length}
                </p>
              </div>
            </div>
          )}
          {continueError && (
            <p role="alert" className={`text-xs font-semibold ${isDark ? "text-rose-300" : "text-rose-600"}`}>
              {continueError}
            </p>
          )}
          <Button
            size={isKid ? "lg" : "md"}
            className={`koda-celebration-cta w-full ${isKid ? "rounded-full text-base font-black sm:text-lg" : ""}`}
            onClick={() => void continuePlacement()}
            loading={continuing}
            loadingText="Finding what’s next..."
          >
            <span className="truncate">{presentation.continueLabel}</span>
            <ChevronRight size={16} className="shrink-0" />
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
        eyebrow: [presentation.eyebrow, quiz.subjectName, subjectProgress].filter(Boolean).join(" · "),
        finishLabel: isKid ? "All done" : "Finish placement",
        responseId: question => placementIdByQuestionId.get(question.id) ?? question.id,
        onComplete: submit,
      }}
    />
  );
};
