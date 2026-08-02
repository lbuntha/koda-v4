import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { sounds } from "../../sound";
import { CanvasProps } from "./types";
import { KodaActor, KodaMood, useKodaVoice } from "./KodaActor";
import { NumberPad } from "./NumberPad";
import {
  buildColumnMultiplicationModel,
  describeMultiplicationMode,
  diagnoseMultiplicationError,
  multiplicationStepNarration,
  type MultiplicationStage,
} from "./columnMultiplicationModel";

const CELL = "flex h-9 w-8 shrink-0 items-center justify-center font-mono font-black sm:h-11 sm:w-10";
const OP_CELL = "flex w-7 shrink-0 items-center justify-center";
const PLACE_LABELS = ["1s", "10s", "100s", "1K", "10K", "100K", "1M", "10M"];

export const ColumnMultiplicationCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  onSuccess,
  onAttempt,
  onHint,
}) => {
  const reduce = useReducedMotion();
  const voice = useKodaVoice("koda_column_multiplication_muted");
  const mutedRef = useRef(voice.muted);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const model = useMemo(
    () => buildColumnMultiplicationModel(
      question.config?.multiplicand ?? 234,
      question.config?.multiplier ?? 56,
    ),
    [question.config?.multiplicand, question.config?.multiplier],
  );
  const { multiplicand, multiplier, product, partialRows, stages, maxAnswerDigits } = model;
  const [stageIndex, setStageIndex] = useState(0);
  const [stageAnswers, setStageAnswers] = useState<string[][]>(
    () => stages.map(stage => stage.answerDigits.map(() => "")),
  );
  const [wrongCells, setWrongCells] = useState<boolean[]>(() => stages[0].answerDigits.map(() => false));
  const [focusedPlace, setFocusedPlace] = useState(0);
  const [fails, setFails] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [stuckPlace, setStuckPlace] = useState<number | null>(null);
  const [phase, setPhase] = useState<"solve" | "guide" | "solved">("solve");
  const [guideIndex, setGuideIndex] = useState(0);
  const [guidePlaying, setGuidePlaying] = useState(false);
  const [guideUsed, setGuideUsed] = useState(false);
  const [guideStartStageIndex, setGuideStartStageIndex] = useState(0);

  useEffect(() => { mutedRef.current = voice.muted; }, [voice.muted]);

  const stage = stages[stageIndex];
  const answers = stageAnswers[stageIndex] ?? [];
  const partial = stage.kind === "partial" && stage.partialIndex !== undefined
    ? partialRows[stage.partialIndex]
    : null;
  const guideSteps = useMemo(() => {
    if (!partial) return [{ kind: "final" as const, stepIndex: 0 }];
    return partial.steps.flatMap((_, stepIndex) => [
      { kind: "multiply" as const, stepIndex },
      { kind: "write" as const, stepIndex },
    ]);
  }, [partial]);
  const guideStep = guideSteps[Math.min(guideIndex, guideSteps.length - 1)];
  const guideDone = phase === "guide" && guideIndex >= guideSteps.length;
  const allFilled = answers.every(answer => answer.trim());

  useEffect(() => {
    setStageIndex(0);
    setStageAnswers(stages.map(item => item.answerDigits.map(() => "")));
    setWrongCells(stages[0].answerDigits.map(() => false));
    setFocusedPlace(0);
    setFails(0);
    setHintLevel(0);
    setStuckPlace(null);
    setPhase("solve");
    setGuideIndex(0);
    setGuidePlaying(false);
    setGuideUsed(false);
    setGuideStartStageIndex(0);
  }, [stages]);

  useEffect(() => {
    if (phase !== "guide" || !guidePlaying || guideDone) return;
    const timer = window.setTimeout(
      () => setGuideIndex(index => index + 1),
      guideStep.kind === "multiply" ? 2400 : 1900,
    );
    return () => window.clearTimeout(timer);
  }, [guideDone, guidePlaying, guideStep.kind, phase]);

  useEffect(() => {
    if (phase !== "guide" || !guideDone || stageIndex >= stages.length - 1) return;
    const timer = window.setTimeout(() => {
      const nextIndex = stageIndex + 1;
      setStageIndex(nextIndex);
      setWrongCells(stages[nextIndex].answerDigits.map(() => false));
      setFocusedPlace(0);
      setHintLevel(0);
      setStuckPlace(null);
      setGuideIndex(0);
      setGuidePlaying(true);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [guideDone, phase, stageIndex, stages]);

  const setDigit = (place: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setStageAnswers(previous => previous.map((row, rowIndex) =>
      rowIndex === stageIndex
        ? row.map((answer, index) => index === place ? digit : answer)
        : row,
    ));
    setWrongCells(previous => previous.map((wrong, index) => index === place ? false : wrong));
    if (digit && place < stage.answerDigits.length - 1) {
      setFocusedPlace(place + 1);
      inputRefs.current[place + 1]?.focus();
    }
  };

  const backspace = () => {
    if (answers[focusedPlace]) {
      setDigit(focusedPlace, "");
    } else if (focusedPlace > 0) {
      setFocusedPlace(focusedPlace - 1);
      setDigit(focusedPlace - 1, "");
      inputRefs.current[focusedPlace - 1]?.focus();
    }
  };

  const check = () => {
    if (!allFilled || phase !== "solve") return;
    const wrong = stage.answerDigits.map((digit, place) => Number(answers[place]) !== digit);
    const selected = answers.slice().reverse().join("");
    if (!wrong.some(Boolean)) {
      if (!mutedRef.current) sounds.playSuccess();
      onAttempt?.("correct", {
        expected: String(stage.value),
        selected,
        details: {
          component: "column_multiplication",
          stage: stage.kind,
          stageIndex,
          multiplierPlace: partial?.multiplierPlace,
          guideUsed,
        },
      });
      if (stageIndex < stages.length - 1) {
        const nextIndex = stageIndex + 1;
        setStageIndex(nextIndex);
        setWrongCells(stages[nextIndex].answerDigits.map(() => false));
        setFocusedPlace(0);
        setFails(0);
        setHintLevel(0);
        setStuckPlace(null);
        requestAnimationFrame(() => inputRefs.current[0]?.focus());
      } else {
        setPhase("solved");
        window.setTimeout(() => onSuccess?.(), 550);
      }
      return;
    }

    if (!mutedRef.current) sounds.playFailure();
    const firstWrong = wrong.findIndex(Boolean);
    const modelStep = partial && firstWrong >= partial.shiftZeros
      ? partial.steps[firstWrong - partial.shiftZeros]
      : undefined;
    const errorType = diagnoseMultiplicationError(modelStep, answers[firstWrong]);
    setFails(value => value + 1);
    setWrongCells(wrong);
    setStuckPlace(firstWrong);
    setHintLevel(0);
    onAttempt?.("incorrect", {
      expected: String(stage.value),
      selected,
      details: {
        component: "column_multiplication",
        stage: stage.kind,
        stageIndex,
        multiplierPlace: partial?.multiplierPlace,
        wrongPlaces: wrong.flatMap((isWrong, place) => isWrong ? [place] : []),
        errorType,
        carryIns: partial?.steps.map(step => step.carryIn) ?? [],
        guideUsed,
      },
    });
    window.setTimeout(() => {
      setWrongCells(stage.answerDigits.map(() => false));
      setStageAnswers(previous => previous.map((row, rowIndex) =>
        rowIndex === stageIndex
          ? row.map((answer, place) => wrong[place] ? "" : answer)
          : row,
      ));
      setFocusedPlace(firstWrong);
      inputRefs.current[firstWrong]?.focus();
    }, 700);
  };

  const enterGuide = () => {
    setGuideUsed(true);
    setGuideStartStageIndex(stageIndex);
    setGuideIndex(0);
    setGuidePlaying(true);
    setPhase("guide");
    onHint?.({
      component: "column_multiplication",
      hintLevel: 3,
      scope: stage.kind === "final" ? "partial_product_sum" : "partial_product",
      stageIndex,
      multiplierPlace: partial?.multiplierPlace,
    });
  };

  const requestHint = () => {
    const nextLevel = Math.min(2, hintLevel + 1);
    setHintLevel(nextLevel);
    onHint?.({
      component: "column_multiplication",
      hintLevel: nextLevel,
      scope: "single_digit",
      stageIndex,
      place: stuckPlace ?? undefined,
    });
  };

  const tryAgain = () => {
    const returnStage = stages[guideStartStageIndex];
    setPhase("solve");
    setGuidePlaying(false);
    setGuideIndex(0);
    setStageIndex(guideStartStageIndex);
    setWrongCells(returnStage.answerDigits.map(() => false));
    setStageAnswers(previous => previous.map((row, rowIndex) =>
      rowIndex === guideStartStageIndex
        ? row.map((answer, place) =>
          Number(answer) === returnStage.answerDigits[place] ? answer : "")
        : row,
    ));
    setFocusedPlace(0);
    setStuckPlace(null);
    requestAnimationFrame(() => inputRefs.current[0]?.focus());
  };

  const currentNarration = (() => {
    if (phase === "solved") return `**${multiplicand}** times **${multiplier}** is **${product}**. Every partial product lined up correctly!`;
    if (phase === "guide") {
      if (guideDone) {
        return stageIndex < stages.length - 1
          ? `This ${stage.label} is complete. Next, we'll work through the **${stages[stageIndex + 1].label}**.`
          : `The complete multiplication is **${product}**. Choose **I understand—let me try** when you're ready.`;
      }
      if (guideStep.kind === "final") {
        return `Add the completed partial products by place value. Their total is **${product}**.`;
      }
      const step = partial?.steps[guideStep.stepIndex];
      if (!step) return "Work one place at a time.";
      const narration = multiplicationStepNarration(
        step,
        guideStep.stepIndex === 0 ? partial?.shiftZeros ?? 0 : 0,
      );
      return guideStep.kind === "multiply" ? narration.multiply : narration.write;
    }
    if (stuckPlace !== null) {
      if (stage.kind === "final") {
        return hintLevel
          ? `Add the completed partial products in this column, including any carry from the right.`
          : `Check this final-product digit. The partial rows above are already correct.`;
      }
      if (stuckPlace < (partial?.shiftZeros ?? 0)) {
        return `This row represents the **${partial?.multiplierPlaceLabel}** digit, so place a **0** in each shifted position first.`;
      }
      const step = partial?.steps[stuckPlace - (partial?.shiftZeros ?? 0)];
      if (step && hintLevel >= 2) return multiplicationStepNarration(step).multiply;
      if (step && hintLevel === 1) {
        return `Multiply **${step.multiplicandDigit}** by **${step.multiplierDigit}**${step.carryIn ? `, then add the carried **${step.carryIn}**` : ""}.`;
      }
      return `Only this digit needs attention. Your other correct digits can stay.`;
    }
    if (stage.kind === "final") {
      return `Now add the **${partialRows.length} partial products** to find the final product.`;
    }
    return `Multiply **${multiplicand}** by the **${partial?.multiplierDigit}** in the **${partial?.multiplierPlaceLabel}** place.`;
  })();
  const mood: KodaMood = phase === "solved" || guideDone ? "cheer" : phase === "guide" ? "think" : fails ? "oops" : "idle";

  return (
    <div
      ref={containerRef}
      className={`@container relative flex h-full w-full flex-col overflow-hidden rounded-2xl border shadow-sm ${
        isDark ? "dark border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-800"
      }`}
    >
      {isPlayMode && <KodaActor text={currentNarration} mood={mood} voice={voice} isDark={isDark} dragConstraints={containerRef} />}
      {isPlayMode && phase === "solve" && (
        <button
          type="button"
          onClick={enterGuide}
          className="absolute right-3 top-3 z-40 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/90 px-2.5 py-2 text-[11px] font-bold text-slate-500"
        >
          <HelpCircle size={14} /><span className="hidden sm:inline">Show me how</span>
        </button>
      )}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 px-4 pt-3">
        <Badge>{describeMultiplicationMode(model.digitMode)}</Badge>
        <Badge>{partialRows.length} partial {partialRows.length === 1 ? "row" : "rows"}</Badge>
        <Badge className={model.anyCarry ? "border-rose-100 bg-rose-50 text-rose-600" : "border-emerald-100 bg-emerald-50 text-emerald-600"}>
          {model.anyCarry ? "Carrying" : "No carrying"}
        </Badge>
      </div>
      <p className="shrink-0 px-4 pt-1 text-center text-[10px] font-medium text-slate-500">
        {phase === "solved" ? "Solved" : `${stageIndex + 1} of ${stages.length}: ${stage.label}`}
      </p>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-3 py-3 @7xl:flex-row @7xl:gap-10 @7xl:overflow-hidden">
        <div className="max-w-full overflow-x-auto px-1">
          <div className="inline-flex min-w-max flex-col">
            <PlaceLabels count={maxAnswerDigits} />
            <StaticNumber value={multiplicand} width={maxAnswerDigits} />
            <StaticNumber value={multiplier} width={maxAnswerDigits} operator="×" />
            <Rule />
            {stages.map((item, index) => {
              if (item.kind === "final") return null;
              const operator = partialRows.length > 1 && index === partialRows.length - 1 ? "+" : "";
              if (!isPlayMode || index < stageIndex || phase === "solved") {
                return <StaticDigits key={item.id} digits={item.answerDigits} width={maxAnswerDigits} operator={operator} />;
              }
              if (index === stageIndex) {
                return phase === "guide"
                  ? <GuideRow key={item.id} item={item} operator={operator} />
                  : <AnswerRow key={item.id} item={item} operator={operator} />;
              }
              return <FutureRow key={item.id} item={item} operator={operator} />;
            })}
            {partialRows.length > 1 && (
              <>
                <Rule />
                {stage.kind === "final" && phase !== "solved"
                  ? phase === "guide"
                    ? <GuideRow item={stage} operator="=" />
                    : <AnswerRow item={stage} operator="=" />
                  : phase === "solved" || !isPlayMode
                    ? <StaticDigits digits={model.productDigits} width={maxAnswerDigits} operator="=" />
                    : <FutureRow item={stages[stages.length - 1]} operator="=" />}
              </>
            )}
          </div>
        </div>
        {isPlayMode && phase === "solve" && (
          <NumberPad
            onDigit={digit => setDigit(focusedPlace, digit)}
            onBackspace={backspace}
            onEnter={check}
            enterDisabled={!allFilled}
            accentText="text-indigo-600"
            accentSolid="bg-indigo-600 text-white"
            className="@7xl:w-80 @7xl:shrink-0"
          />
        )}
      </div>

      {isPlayMode && phase !== "solved" && (
        <div className="shrink-0 p-3 pt-2">
          <AnimatePresence>
            {phase === "solve" && stuckPlace !== null && (
              <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-center gap-2">
                {hintLevel < 2 ? (
                  <button type="button" onClick={requestHint} className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                    <Sparkles size={13} />{hintLevel ? "Show the calculation" : "Hint for this digit"}
                  </button>
                ) : (
                  <button type="button" onClick={enterGuide} className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
                    <Play size={13} /> Show this row
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {phase === "guide" && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => { setGuideIndex(0); setGuidePlaying(true); }} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-2.5 text-[11px] font-bold text-slate-500">
                <RotateCcw size={12} /> Replay
              </button>
              <StepButton label="Previous step" disabled={guideIndex <= 0} onClick={() => { setGuidePlaying(false); setGuideIndex(index => Math.max(0, index - 1)); }}>
                <ChevronLeft size={14} />
              </StepButton>
              <button type="button" disabled={guideDone} onClick={() => setGuidePlaying(value => !value)} className="flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-[11px] font-bold text-indigo-700 disabled:opacity-40">
                {guidePlaying ? <Pause size={13} /> : <Play size={13} />}{guidePlaying ? "Pause" : "Play"}
              </button>
              <span className="min-w-20 text-center text-[10px] font-semibold text-slate-400">
                Row {stageIndex + 1}/{stages.length} · {Math.min(guideIndex + 1, guideSteps.length)}/{guideSteps.length}
              </span>
              <StepButton label="Next step" disabled={guideDone} onClick={() => { setGuidePlaying(false); setGuideIndex(index => Math.min(guideSteps.length, index + 1)); }}>
                <ChevronRight size={14} />
              </StepButton>
              <button type="button" onClick={tryAgain} className="h-9 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow">
                I understand — let me try
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  function AnswerRow({ item, operator = "" }: { item: MultiplicationStage; operator?: string; key?: React.Key }) {
    const offset = maxAnswerDigits - item.answerDigits.length;
    return (
      <div className="flex justify-end">
        <div className={`${OP_CELL} text-xl font-bold text-indigo-500 sm:text-2xl`}>{operator}</div>
        {Array.from({ length: maxAnswerDigits }, (_, visualIndex) => {
          const place = maxAnswerDigits - visualIndex - 1;
          const localIndex = place;
          if (visualIndex < offset || localIndex >= item.answerDigits.length) return <div key={visualIndex} className={CELL} />;
          return (
            <div key={visualIndex} className={CELL}>
              <input
                ref={element => { inputRefs.current[localIndex] = element; }}
                value={answers[localIndex] ?? ""}
                onFocus={() => setFocusedPlace(localIndex)}
                onChange={event => setDigit(localIndex, event.target.value)}
                inputMode="numeric"
                aria-label={`Answer digit ${localIndex + 1} for ${item.label}`}
                className={`h-8 w-7 rounded-lg border-2 bg-white text-center text-lg font-black outline-none sm:h-10 sm:w-9 sm:text-2xl ${
                  wrongCells[localIndex]
                    ? "border-rose-400 text-rose-500 ring-2 ring-rose-100"
                    : focusedPlace === localIndex
                      ? "border-indigo-500 text-indigo-600 ring-2 ring-indigo-100"
                      : Number(answers[localIndex]) === item.answerDigits[localIndex]
                        ? "border-emerald-300 text-emerald-600"
                        : "border-slate-200 text-slate-800"
                }`}
              />
            </div>
          );
        })}
      </div>
    );
  }

  function FutureRow({ item, operator = "" }: { item: MultiplicationStage; operator?: string; key?: React.Key }) {
    const offset = maxAnswerDigits - item.answerDigits.length;
    return (
      <div className="flex justify-end" aria-label={`${item.label}, waiting`}>
        <div className={`${OP_CELL} text-xl font-bold text-slate-300 sm:text-2xl`}>{operator}</div>
        {Array.from({ length: maxAnswerDigits }, (_, visualIndex) => (
          <div key={visualIndex} className={CELL}>
            {visualIndex >= offset && (
              <span className="h-8 w-7 rounded-lg border-2 border-dashed border-slate-200 bg-white/50 sm:h-10 sm:w-9 dark:border-slate-700 dark:bg-slate-800/50" />
            )}
          </div>
        ))}
      </div>
    );
  }

  function GuideRow({ item, operator = "" }: { item: MultiplicationStage; operator?: string; key?: React.Key }) {
    const offset = maxAnswerDigits - item.answerDigits.length;
    const activeStepIndex = guideStep.kind === "final" ? -1 : guideStep.stepIndex;

    return (
      <div className="flex justify-end" aria-live="polite" aria-label={`${item.label} demonstration`}>
        <div className={`${OP_CELL} text-xl font-bold text-indigo-500 sm:text-2xl`}>{operator}</div>
        {Array.from({ length: maxAnswerDigits }, (_, visualIndex) => {
          const place = maxAnswerDigits - visualIndex - 1;
          if (visualIndex < offset || place >= item.answerDigits.length) {
            return <div key={visualIndex} className={CELL} />;
          }

          const isFinal = item.kind === "final";
          const isShiftZero = !isFinal && place < (partial?.shiftZeros ?? 0);
          const stepIndex = place - (partial?.shiftZeros ?? 0);
          const isCurrent = !isFinal && !isShiftZero && stepIndex === activeStepIndex && !guideDone;
          const isRevealed = isFinal
            || guideDone
            || isShiftZero
            || (!isShiftZero && guideIndex >= (stepIndex * 2) + 1);

          return (
            <div key={visualIndex} className={CELL}>
              <AnimatePresence mode="wait" initial={false}>
                {isRevealed ? (
                  <motion.span
                    key={`digit-${item.id}-${place}`}
                    initial={reduce ? false : { opacity: 0, y: -7, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex h-8 w-7 items-center justify-center rounded-lg border-2 text-lg font-black sm:h-10 sm:w-9 sm:text-2xl ${
                      isCurrent
                        ? "border-indigo-500 bg-indigo-100 text-indigo-700 ring-2 ring-indigo-100"
                        : isShiftZero
                          ? "border-violet-200 bg-violet-50 text-violet-500"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {item.answerDigits[place]}
                  </motion.span>
                ) : (
                  <motion.span
                    key={`placeholder-${item.id}-${place}`}
                    initial={false}
                    animate={isCurrent && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                    transition={isCurrent ? { duration: 1.1, repeat: Infinity } : undefined}
                    className={`h-8 w-7 rounded-lg border-2 border-dashed bg-white/70 sm:h-10 sm:w-9 dark:bg-slate-800/70 ${
                      isCurrent
                        ? "border-indigo-400 ring-2 ring-indigo-100"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  />
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    );
  }
};

const Badge: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = "", children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 ${className}`}>
    {children}
  </span>
);

const PlaceLabels: React.FC<{ count: number }> = ({ count }) => (
  <div className="flex justify-end">
    <div className={OP_CELL} />
    {Array.from({ length: count }, (_, index) => {
      const place = count - index - 1;
      return <div key={place} className={`${CELL} h-5 text-[8px] font-semibold uppercase text-slate-400`}>{PLACE_LABELS[place]}</div>;
    })}
  </div>
);

const StaticNumber: React.FC<{ value: number; width: number; operator?: string }> = ({ value, width, operator = "" }) => (
  <StaticDigits digits={String(value).split("").reverse().map(Number)} width={width} operator={operator} />
);

const StaticDigits: React.FC<{ digits: number[]; width: number; operator?: string; muted?: boolean }> = ({
  digits,
  width,
  operator = "",
  muted = false,
}) => (
  <div className={`flex justify-end ${muted ? "opacity-0" : ""}`}>
    <div className={`${OP_CELL} text-xl font-bold text-indigo-500 sm:text-2xl`}>{operator}</div>
    {Array.from({ length: width }, (_, index) => {
      const place = width - index - 1;
      return <div key={place} className={`${CELL} text-xl text-slate-800 sm:text-3xl dark:text-slate-100`}>{place < digits.length ? digits[place] : ""}</div>;
    })}
  </div>
);

const Rule = () => <div className="my-1.5 h-1 w-full rounded bg-slate-300 dark:bg-slate-600" />;

const StepButton: React.FC<{
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, disabled, onClick, children }) => (
  <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-40">
    {children}
  </button>
);
