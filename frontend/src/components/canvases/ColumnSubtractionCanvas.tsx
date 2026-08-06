/**
 * Column Subtraction — five-digit written subtraction with optional,
 * column-specific borrowing support.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CanvasProps } from "./types";
import { CountingTechnique } from "../../types";
import { KodaActor, KodaMood, useKodaVoice } from "./KodaActor";
import { NumberPad } from "./NumberPad";
import { sounds } from "../../sound";
import {
  buildColumnSubtractionModel,
  describeSubtractionMode,
  diagnoseSubtractionColumnError,
  subtractionColumnNarration,
  type SubtractionColumnErrorType,
} from "./columnSubtractionModel";

interface Accent {
  badge: string;
  box: string;
  answer: string;
  operator: string;
}

const ACCENTS: Record<string, Accent> = {
  indigo: {
    badge: "bg-indigo-600 text-white",
    box: "bg-indigo-100 text-indigo-700 border-indigo-300/60 dark:bg-indigo-900/50 dark:text-indigo-300",
    answer: "text-indigo-600 dark:text-indigo-400",
    operator: "text-indigo-500",
  },
  emerald: {
    badge: "bg-emerald-600 text-white",
    box: "bg-emerald-100 text-emerald-700 border-emerald-300/60 dark:bg-emerald-900/50 dark:text-emerald-300",
    answer: "text-emerald-600 dark:text-emerald-400",
    operator: "text-emerald-500",
  },
  purple: {
    badge: "bg-purple-600 text-white",
    box: "bg-purple-100 text-purple-700 border-purple-300/60 dark:bg-purple-900/50 dark:text-purple-300",
    answer: "text-purple-600 dark:text-purple-400",
    operator: "text-purple-500",
  },
  rose: {
    badge: "bg-rose-600 text-white",
    box: "bg-rose-100 text-rose-700 border-rose-300/60 dark:bg-rose-900/50 dark:text-rose-300",
    answer: "text-rose-600 dark:text-rose-400",
    operator: "text-rose-500",
  },
};

const CELL = "flex h-11 w-9 shrink-0 select-none items-center justify-center font-mono font-black min-[380px]:w-10 sm:h-13 sm:w-12";
const OP_CELL = "flex w-7 shrink-0 items-center justify-center sm:w-8";
const PLACE_ABBREVIATIONS = ["1s", "10s", "100s", "1K", "10K"];
const GENERIC_INSTRUCTION = /\b(count(?:ing)?|tap|drag|line up|ten[- ]?frame|sudoku|pattern|sort|magnet|arrange|subiti|how many|group)\b/i;

export const ColumnSubtractionCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  onSuccess,
  onAttempt,
  onHint,
}) => {
  const reduce = useReducedMotion();
  const voice = useKodaVoice("koda_column_subtraction_muted");
  const mutedRef = useRef(voice.muted);
  const containerRef = useRef<HTMLDivElement>(null);
  const answerCellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rawMinuend = question.config?.minuend ?? 432;
  const rawSubtrahend = question.config?.subtrahend ?? 178;
  const isMultiRow = question.technique === CountingTechnique.SUBTRACTION_COLUMN_MULTI;
  const hasThirdRow = isMultiRow
    || (question.config?.subtrahend2 !== undefined && question.config?.subtrahend2 !== null);
  const rawSubtrahend2 = hasThirdRow ? question.config?.subtrahend2 ?? 56 : null;
  const model = useMemo(
    () => buildColumnSubtractionModel(rawMinuend, rawSubtrahend, rawSubtrahend2),
    [rawMinuend, rawSubtrahend, rawSubtrahend2],
  );
  const { columns, difference, minuend, subtrahend, subtrahend2 } = model;
  const componentName = isMultiRow ? "multi_row_column_subtraction" : "column_subtraction";
  const accent = ACCENTS[question.config?.frameColor ?? "indigo"] ?? ACCENTS.indigo;
  const requiredPlaces = useMemo(
    () => columns.flatMap((column, place) => column.requiresAnswer ? [place] : []),
    [columns],
  );
  const order = useMemo(() => columns.map((_, place) => place).reverse(), [columns]);

  const [answers, setAnswers] = useState<string[]>(() => columns.map(() => ""));
  const [borrowMarks, setBorrowMarks] = useState<boolean[]>(() => columns.map(() => false));
  const [wrongCells, setWrongCells] = useState<boolean[]>(() => columns.map(() => false));
  const [fails, setFails] = useState(0);
  const [phase, setPhase] = useState<"solve" | "guide" | "solved">("solve");
  const [stuckPlace, setStuckPlace] = useState<number | null>(null);
  const [lastError, setLastError] = useState<SubtractionColumnErrorType | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [guideTarget, setGuideTarget] = useState<number | null>(null);
  const [guidePlaying, setGuidePlaying] = useState(false);
  const [guideUsed, setGuideUsed] = useState(false);
  const [beatIndex, setBeatIndex] = useState(-1);
  const [focusedPlace, setFocusedPlace] = useState(requiredPlaces[0] ?? 0);
  const [offerFullGuide, setOfferFullGuide] = useState(false);

  useEffect(() => { mutedRef.current = voice.muted; }, [voice.muted]);

  const guidePlaces = useMemo(
    () => guideTarget === null ? requiredPlaces : [guideTarget],
    [guideTarget, requiredPlaces],
  );
  const beats = useMemo(
    () => guidePlaces.flatMap(place => [
      { place, kind: "subtract" as const },
      { place, kind: "write" as const },
    ]),
    [guidePlaces],
  );
  const currentBeat = beats[Math.min(Math.max(beatIndex, 0), Math.max(0, beats.length - 1))]
    ?? { place: requiredPlaces[0] ?? 0, kind: "subtract" as const };
  const guideDone = phase === "guide" && beatIndex >= beats.length;

  useEffect(() => {
    setAnswers(columns.map(() => ""));
    setBorrowMarks(columns.map(() => false));
    setWrongCells(columns.map(() => false));
    setFails(0);
    setPhase("solve");
    setStuckPlace(null);
    setLastError(null);
    setHintLevel(0);
    setGuideTarget(null);
    setGuidePlaying(false);
    setGuideUsed(false);
    setBeatIndex(-1);
    const firstPlace = requiredPlaces[0] ?? 0;
    setFocusedPlace(firstPlace);
    setOfferFullGuide(false);
    if (isPlayMode) {
      const id = requestAnimationFrame(() => answerCellRefs.current[firstPlace]?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(id);
    }
  }, [columns, isPlayMode, requiredPlaces]);

  useEffect(() => {
    if (phase !== "guide" || !guidePlaying || beatIndex < 0 || beatIndex >= beats.length) return;
    const timer = window.setTimeout(
      () => setBeatIndex(index => index + 1),
      currentBeat.kind === "subtract" ? 2600 : 2100,
    );
    return () => window.clearTimeout(timer);
  }, [beatIndex, beats.length, currentBeat.kind, guidePlaying, phase]);

  useEffect(() => {
    if (phase !== "guide") return;
    if (guideDone) {
      setGuidePlaying(false);
      return;
    }
    if (currentBeat.kind === "write" && !mutedRef.current) sounds.playTick(columns[currentBeat.place].digitOut || 1);
    if (currentBeat.kind === "subtract" && columns[currentBeat.place].borrowOut && !mutedRef.current) sounds.playPop();
  }, [columns, currentBeat, guideDone, phase]);

  const enterGuide = useCallback((target: number | null, source: "targeted" | "full") => {
    setGuideTarget(target);
    setGuideUsed(true);
    setGuidePlaying(true);
    setBeatIndex(0);
    setPhase("guide");
    setOfferFullGuide(false);
    onHint?.({
      component: componentName,
      hintLevel: target === null ? 4 : 3,
      scope: target === null ? "full_problem" : "single_column",
      source,
      place: target ?? undefined,
      placeLabel: target === null ? undefined : columns[target]?.placeLabel,
      errorType: target === null ? undefined : lastError,
    });
  }, [columns, componentName, lastError, onHint]);

  const tryItMyself = () => {
    const resumePlace = guideTarget ?? stuckPlace ?? requiredPlaces.find(place => !answers[place]) ?? requiredPlaces[0] ?? 0;
    setAnswers(previous => previous.map((answer, place) => {
      if (place === resumePlace) return "";
      return Number(answer) === columns[place].digitOut ? answer : "";
    }));
    setWrongCells(columns.map(() => false));
    setGuideTarget(null);
    setGuidePlaying(false);
    setBeatIndex(-1);
    setPhase("solve");
    setHintLevel(0);
    setFocusedPlace(resumePlace);
    requestAnimationFrame(() => answerCellRefs.current[resumePlace]?.focus({ preventScroll: true }));
  };

  const setAnswerDigit = (place: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setAnswers(previous => previous.map((answer, index) => index === place ? digit : answer));
    setWrongCells(previous => previous.map((wrong, index) => index === place ? false : wrong));
    if (!digit) return;
    const position = requiredPlaces.indexOf(place);
    const nextPlace = requiredPlaces[position + 1];
    if (nextPlace !== undefined) {
      setFocusedPlace(nextPlace);
      // Run after the keypad click finishes so mobile browsers do not retain
      // focus on the tapped digit key.
      requestAnimationFrame(() => answerCellRefs.current[nextPlace]?.focus({ preventScroll: true }));
    }
  };

  const allFilled = requiredPlaces.every(place => answers[place]?.trim());

  const keypadBackspace = () => {
    if (answers[focusedPlace]) {
      setAnswerDigit(focusedPlace, "");
      requestAnimationFrame(() => answerCellRefs.current[focusedPlace]?.focus({ preventScroll: true }));
      return;
    }
    const position = requiredPlaces.indexOf(focusedPlace);
    const previous = requiredPlaces[position - 1];
    if (previous !== undefined) {
      setFocusedPlace(previous);
      setAnswerDigit(previous, "");
      requestAnimationFrame(() => answerCellRefs.current[previous]?.focus({ preventScroll: true }));
    }
  };

  const checkAnswer = () => {
    if (!allFilled || phase !== "solve") return;
    const wrong = columns.map((column, place) =>
      column.requiresAnswer && Number(answers[place]) !== column.digitOut,
    );
    const selected = requiredPlaces.slice().reverse().map(place => answers[place]).join("");
    if (!wrong.some(Boolean)) {
      setPhase("solved");
      if (!mutedRef.current) sounds.playSuccess();
      onAttempt?.("correct", {
        expected: String(difference),
        selected,
        details: {
          component: componentName,
          borrowCount: model.borrowCount,
          digitMode: model.digitMode,
          rowCount: model.rowCount,
          operands: [minuend, subtrahend, ...(subtrahend2 === null ? [] : [subtrahend2])],
          guideUsed,
        },
      });
      window.setTimeout(() => onSuccess?.(), 550);
      return;
    }

    if (!mutedRef.current) sounds.playFailure();
    const firstWrong = wrong.findIndex(Boolean);
    const errorTypes = wrong.map((isWrong, place) =>
      isWrong ? diagnoseSubtractionColumnError(columns[place], answers[place]) : null,
    );
    const nextFails = fails + 1;
    setFails(nextFails);
    setWrongCells(wrong);
    setStuckPlace(firstWrong);
    setLastError(firstWrong >= 0 ? errorTypes[firstWrong] : null);
    setHintLevel(0);
    if (nextFails >= 2) setOfferFullGuide(true);
    onAttempt?.("incorrect", {
      expected: String(difference),
      selected,
      details: {
        component: componentName,
        digitMode: model.digitMode,
        rowCount: model.rowCount,
        operands: [minuend, subtrahend, ...(subtrahend2 === null ? [] : [subtrahend2])],
        wrongPlaces: wrong.flatMap((isWrong, place) => isWrong ? [place] : []),
        wrongPlaceLabels: wrong.flatMap((isWrong, place) => isWrong ? [columns[place].placeLabel] : []),
        errorTypes: errorTypes.filter(Boolean),
        expectedDigits: requiredPlaces.map(place => columns[place].digitOut),
        selectedDigits: requiredPlaces.map(place => answers[place]),
        borrowIns: columns.map(column => column.borrowIn),
        borrowOuts: columns.map(column => column.borrowOut),
        borrowMarks,
        guideUsed,
      },
    });
    window.setTimeout(() => {
      setWrongCells(columns.map(() => false));
      setAnswers(previous => previous.map((answer, place) => wrong[place] ? "" : answer));
      if (firstWrong >= 0) {
        setFocusedPlace(firstWrong);
        answerCellRefs.current[firstWrong]?.focus({ preventScroll: true });
      }
    }, 750);
  };

  const requestHint = () => {
    if (stuckPlace === null) return;
    const nextLevel = Math.min(2, hintLevel + 1);
    setHintLevel(nextLevel);
    onHint?.({
      component: componentName,
      hintLevel: nextLevel,
      scope: "single_column",
      place: stuckPlace,
      placeLabel: columns[stuckPlace].placeLabel,
      errorType: lastError,
    });
  };

  const showStatic = !isPlayMode;
  const solved = phase === "solved";
  const inGuide = phase === "guide";
  const instruction = question.instruction?.trim();
  const customInstruction = instruction && !GENERIC_INSTRUCTION.test(instruction) ? instruction : "";
  const activeColumn = columns[currentBeat.place];
  const expressionText = subtrahend2 === null
    ? `**${minuend}** minus **${subtrahend}**`
    : `**${minuend}** minus **${subtrahend}** minus **${subtrahend2}**`;
  const kodaText = (() => {
    if (solved) return `${expressionText} is **${difference}**. You kept every place lined up—great work!`;
    if (inGuide) {
      if (guideDone) return guideTarget === null
        ? `The difference is **${difference}**. Choose **I understand—let me try** to solve it yourself.`
        : `That **${columns[guideTarget].placeLabel}** column is ready. Your correct work is still saved.`;
      const narration = subtractionColumnNarration(activeColumn);
      return currentBeat.kind === "subtract" ? narration.subtract : narration.write;
    }
    if (stuckPlace !== null) {
      const column = columns[stuckPlace];
      const lowerTotal = column.bottomDigit + column.bottomDigit2;
      const lowerText = column.hasBottomDigit2
        ? `**${column.bottomDigit}** plus **${column.bottomDigit2}**`
        : `**${column.bottomDigit}**`;
      if (hintLevel >= 2) {
        return column.borrowOut
          ? `In the **${column.placeLabel}** column, the lower rows total ${lowerText}, or **${lowerTotal}**. Borrow **${column.borrowOut}** to make **${column.workingTop}**, then subtract.`
          : `In the **${column.placeLabel}** column, subtract ${lowerText} from **${column.adjustedTop}**.`;
      }
      if (hintLevel === 1) {
        return lastError === "missed_borrow"
          ? `This **${column.placeLabel}** column already lent one to its right. Reduce its top digit by **1** before subtracting.`
          : lastError === "reversed_digits"
            ? `We cannot reverse the digits. Borrow from the place on the left, then subtract the bottom digit.`
            : `Focus only on the **${column.placeLabel}** column. Check whether its top value is large enough.`;
      }
      return `Only the **${column.placeLabel}** column needs attention. Your other correct digits can stay.`;
    }
    return customInstruction || `Let's solve ${expressionText}. Start with the **ones** on the right.`;
  })();
  const mood: KodaMood = solved || guideDone ? "cheer" : inGuide ? "think" : fails ? "oops" : "idle";

  return (
    <div
      ref={containerRef}
      className={`@container relative flex h-full w-full flex-col overflow-hidden rounded-2xl border shadow-sm ${
        isDark ? "dark border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-800"
      }`}
    >
      {isPlayMode && (
        <KodaActor text={kodaText} mood={mood} voice={voice} isDark={isDark} dragConstraints={containerRef} />
      )}
      {isPlayMode && phase === "solve" && (
        <button
          onClick={() => enterGuide(null, "full")}
          className="absolute right-3 top-3 z-40 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/90 px-2.5 py-2 text-[11px] font-bold text-slate-500 backdrop-blur-sm hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800/90"
        >
          <HelpCircle size={14} /><span className="hidden sm:inline">Show me how</span>
        </button>
      )}

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 px-4 pt-3">
        <Badge>{describeSubtractionMode(model.digitMode)}</Badge>
        <Badge className={model.anyBorrow ? "border-rose-100 bg-rose-50 text-rose-600" : "border-emerald-100 bg-emerald-50 text-emerald-600"}>
          {model.anyBorrow ? "Regrouping" : "No regrouping"}
        </Badge>
        {solved && <Badge className="border-emerald-100 bg-emerald-50 text-emerald-600"><Check size={10} /> Solved</Badge>}
      </div>
      <p className="shrink-0 px-4 pt-1 text-center text-[10px] font-medium text-slate-500">
        Start at the ones on the right, then move one place left.
      </p>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 overflow-y-auto px-3 py-3 @7xl:flex-row @7xl:gap-10 @7xl:overflow-hidden">
        <div className="max-w-full shrink-0 overflow-x-auto px-1 pb-1">
          <div className="mx-auto inline-flex min-w-max flex-col items-stretch">
            <div className="flex justify-end">
              <div className={OP_CELL} />
              {order.map(place => (
                <div key={`label-${place}`} title={columns[place].placeLabel} className={`${CELL} h-5 text-[8px] font-semibold uppercase text-slate-400 sm:text-[9px]`}>
                  {PLACE_ABBREVIATIONS[place]}
                </div>
              ))}
            </div>
            <div className="flex items-end justify-end">
              <div className={OP_CELL} />
              {order.map(place => <div key={`borrow-${place}`} className={`${CELL} h-8`}>{renderBorrow(place)}</div>)}
            </div>
            <div className="flex justify-end">
              <div className={OP_CELL} />
              {order.map(place => renderNumberCell(place, columns[place].topDigit, columns[place].hasTopDigit, "top"))}
            </div>
            <div className="flex justify-end">
              <div className={`${OP_CELL} text-2xl font-bold sm:text-3xl ${accent.operator}`}>{subtrahend2 === null ? "−" : ""}</div>
              {order.map(place => renderNumberCell(place, columns[place].bottomDigit, columns[place].hasBottomDigit, "bottom"))}
            </div>
            {subtrahend2 !== null && (
              <div className="flex justify-end">
                <div className={`${OP_CELL} text-2xl font-bold sm:text-3xl ${accent.operator}`}>−</div>
                {order.map(place => renderNumberCell(place, columns[place].bottomDigit2, columns[place].hasBottomDigit2, "bottom2"))}
              </div>
            )}
            <div className="my-2 h-1 w-full rounded bg-slate-300 dark:bg-slate-600" />
            <div className="flex justify-end">
              <div className={OP_CELL} />
              {order.map(place => renderAnswer(place))}
            </div>
          </div>
        </div>
        {isPlayMode && phase === "solve" && (
          <NumberPad
            onDigit={digit => setAnswerDigit(focusedPlace, digit)}
            onBackspace={keypadBackspace}
            onEnter={checkAnswer}
            enterDisabled={!allFilled}
            accentText={accent.answer}
            accentSolid={accent.badge}
            className="@7xl:w-80 @7xl:shrink-0"
          />
        )}
      </div>

      {!showStatic && phase !== "solved" && (
        <div className="shrink-0 p-3 pt-2">
          <AnimatePresence>
            {phase === "solve" && stuckPlace !== null && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto flex max-w-lg flex-wrap items-center justify-center gap-2"
              >
                {hintLevel < 2 ? (
                  <button onClick={requestHint} className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                    <Sparkles size={13} />{hintLevel ? "Show the calculation" : `Hint for ${columns[stuckPlace].placeLabel}`}
                  </button>
                ) : (
                  <button onClick={() => enterGuide(stuckPlace, "targeted")} className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
                    <Play size={13} /> Show this column
                  </button>
                )}
                {offerFullGuide && (
                  <button onClick={() => enterGuide(null, "full")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                    Show full walkthrough
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {phase === "guide" && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={() => { setBeatIndex(0); setGuidePlaying(true); }} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-2.5 text-[11px] font-bold text-slate-500">
                <RotateCcw size={12} /> Replay
              </button>
              <StepButton label="Previous step" disabled={beatIndex <= 0} onClick={() => { setGuidePlaying(false); setBeatIndex(index => Math.max(0, index - 1)); }}>
                <ChevronLeft size={14} />
              </StepButton>
              <button
                disabled={guideDone}
                onClick={() => setGuidePlaying(playing => !playing)}
                className="flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-[11px] font-bold text-indigo-700 disabled:opacity-40"
              >
                {guidePlaying ? <Pause size={13} /> : <Play size={13} />}{guidePlaying ? "Pause" : "Play"}
              </button>
              <span className="min-w-12 text-center text-[10px] font-semibold text-slate-400">{Math.min(beatIndex + 1, beats.length)} / {beats.length}</span>
              <StepButton label="Next step" disabled={guideDone} onClick={() => { setGuidePlaying(false); setBeatIndex(index => Math.min(beats.length, index + 1)); }}>
                <ChevronRight size={14} />
              </StepButton>
              <button onClick={tryItMyself} className={`h-9 rounded-xl px-4 text-xs font-bold shadow ${accent.badge}`}>
                I understand — let me try
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  function renderBorrow(place: number) {
    const column = columns[place];
    if (place >= columns.length - 1 || !column.borrowOut) return null;
    const visible = showStatic || solved || (inGuide && currentBeat.place === place);
    if (inGuide || showStatic || solved) {
      return visible ? (
        <span className={`z-10 inline-flex h-6 items-center justify-center whitespace-nowrap rounded-full px-2 text-[9px] font-bold shadow-sm ring-2 ring-white dark:ring-slate-900 ${accent.badge}`}>
          Borrow {column.borrowOut}
        </span>
      ) : null;
    }
    const marked = borrowMarks[place];
    return (
      <button
        onClick={() => setBorrowMarks(previous => previous.map((value, index) => index === place ? !value : value))}
        aria-label={`${marked ? "Remove" : "Add"} borrow mark for ${column.placeLabel}`}
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
          marked ? accent.badge : "border border-dashed border-slate-300 text-transparent"
        }`}
      >
        {marked ? column.borrowOut : "·"}
      </button>
    );
  }

  function renderNumberCell(
    place: number,
    digit: number,
    hasDigit: boolean,
    row: "top" | "bottom" | "bottom2",
  ) {
    const active = inGuide && !guideDone && currentBeat.place === place;
    const column = columns[place];
    // Borrowing changes only the top number. The bottom number is the amount
    // being subtracted and must remain unchanged (e.g. 12 − 8, never 12 − 12).
    const shownDigit = row === "top"
      && active
      && currentBeat.kind === "subtract"
      && (column.borrowIn > 0 || column.borrowOut > 0)
      ? column.workingTop
      : digit;
    return (
      <div key={`number-${row}-${place}`} className={`${CELL} text-2xl text-slate-800 sm:text-4xl dark:text-slate-100`}>
        <div className={`flex h-10 min-w-8 items-center justify-center rounded-xl border border-transparent px-1 transition-all sm:h-12 sm:min-w-10 ${active ? `${accent.box} scale-105 shadow-sm` : ""}`}>
          {hasDigit ? shownDigit : ""}
        </div>
      </div>
    );
  }

  function renderAnswer(place: number) {
    const column = columns[place];
    if (!column.requiresAnswer) return <div key={`answer-${place}`} className={CELL} />;
    const writeBeat = beats.findIndex(beat => beat.place === place && beat.kind === "write");
    const revealed = showStatic || solved || (inGuide && writeBeat >= 0 && beatIndex >= writeBeat);
    const correctSaved = Number(answers[place]) === column.digitOut;
    if (revealed || solved) {
      return (
        <div key={`answer-${place}`} className={`${CELL} text-2xl sm:text-4xl ${correctSaved ? "text-emerald-600" : accent.answer}`}>
          <motion.span initial={reduce ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
            {column.digitOut}
          </motion.span>
        </div>
      );
    }
    return (
      <div key={`answer-${place}`} className={CELL}>
        <button
          ref={element => { answerCellRefs.current[place] = element; }}
          type="button"
          onClick={() => setFocusedPlace(place)}
          onFocus={() => setFocusedPlace(place)}
          aria-label={`Answer for ${column.placeLabel}${answers[place] ? `: ${answers[place]}` : ""}`}
          className={`h-10 w-8 rounded-xl border-2 bg-white text-center text-xl font-black outline-none transition sm:h-12 sm:w-10 sm:text-3xl ${
            wrongCells[place]
              ? "border-rose-400 text-rose-500 ring-4 ring-rose-100"
              : focusedPlace === place
                ? "border-indigo-500 text-indigo-600 ring-4 ring-indigo-100"
                : correctSaved
                  ? "border-emerald-300 text-emerald-600"
                  : "border-slate-200 text-slate-800"
          }`}
        >
          {answers[place]}
        </button>
      </div>
    );
  }
};

const Badge: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = "", children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 ${className}`}>
    {children}
  </span>
);

const StepButton: React.FC<{
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, disabled, onClick, children }) => (
  <button
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
  >
    {children}
  </button>
);
