import React, { useState, useEffect, useRef } from "react";
import { CanvasProps } from "./types";
import { guidePropsFor } from "../../features/koda-mascot";
import { sounds } from "../../sound";
import {
  RotateCcw, ArrowRight, Check, ChevronRight,
  Blocks, Layers, Sigma, Target, CheckCircle2, Play
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  buildTutorModel,
  generateChallenges,
  normaliseChallenges,
  describeDigitMode,
} from "./additionTutorModel";
import { KodaActor, useKodaVoice, KodaMood } from "./KodaActor";
import { Celebration, randomPraise } from "./Celebration";
import { TenRod, OneUnit, Base10Scale, RodFit, useFittedUnitSize, ROD_WIDTH_UNITS, BLOCK_SPRING } from "./Base10Blocks";

const ALL_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
// Steps that only make sense when the ones column overflows past ten.
const MAKE_TEN_STEPS = [5, 6];

/**
 * CPA phases. The footer shows these rather than a bare step counter so a
 * learner can see they are moving from handling blocks, through a strategy,
 * to symbols — and which of those they are in right now.
 */
const PHASES = [
  { id: "concrete", label: "Build", icon: Blocks, steps: [1, 2, 3, 4] },
  { id: "strategy", label: "Make Ten", icon: Layers, steps: [5, 6] },
  { id: "abstract", label: "Symbols", icon: Sigma, steps: [7, 8, 9, 10] },
  { id: "fluency", label: "Practice", icon: Target, steps: [11, 12] },
] as const;

/**
 * Wraps a unit sitting in the ten frame so it can take part in the bundle.
 *
 * When `bundling` flips on, the ten units suck inward in sequence while a rod
 * rises in their place — the child watches ten ones *become* one ten, which is
 * the single idea the whole step exists to teach.
 */
const BundlingUnit: React.FC<{ bundling: boolean; index: number; children: React.ReactNode }> = ({
  bundling, index, children,
}) => {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      animate={bundling ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={bundling ? { delay: index * 0.028, duration: 0.26, ease: "easeIn" } : { duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
};

/**
 * The CPA bridge: a pile of blocks turning into the numeral that names it.
 *
 * Both layers occupy the same spot, so the blocks shrink and blur away exactly
 * where the number swells up — the child sees the quantity *become* the symbol
 * rather than watching one panel replace another. This is the moment the whole
 * concrete→abstract sequence is building toward, so it gets room to breathe.
 */
const MorphSlot: React.FC<{
  morphed: boolean;
  numeral: number;
  accent: string;
  delay?: number;
  children: React.ReactNode;
}> = ({ morphed, numeral, accent, delay = 0, children }) => {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center min-h-[5.5rem] min-w-[5rem]">
      <motion.div
        animate={
          morphed
            ? { scale: 0.3, opacity: 0, filter: "blur(6px)" }
            : { scale: 1, opacity: 1, filter: "blur(0px)" }
        }
        transition={{ duration: reduce ? 0 : 0.42, delay: reduce ? 0 : delay, ease: "easeIn" }}
      >
        {children}
      </motion.div>

      {morphed && (
        <motion.span
          initial={reduce ? false : { scale: 0.25, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            reduce ? { duration: 0 } : { delay: delay + 0.26, type: "spring", stiffness: 360, damping: 18 }
          }
          className={`absolute font-mono text-4xl font-black ${accent}`}
        >
          {numeral}
        </motion.span>
      )}
    </div>
  );
};

/** Slides a group in from one side so two things visibly meet in the middle. */
const MergeIn: React.FC<{ from: "left" | "right"; delay?: number; children: React.ReactNode }> = ({
  from, delay = 0, children,
}) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { x: from === "left" ? -56 : 56, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 26, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
};

/** One addend shown as its blocks, captioned with the number it represents. */
const AddendGroup: React.FC<{
  label: number;
  tens: number;
  ones: number;
  objectId: string;
  accent: string;
}> = ({ label, tens, ones, objectId, accent }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="flex items-end gap-2 min-h-[3.5rem]">
      {Array.from({ length: tens }).map((_, i) => (
        <TenRod key={i} type={objectId} noEnter />
      ))}
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: ones }).map((_, i) => (
          <OneUnit key={i} type={objectId} noEnter />
        ))}
      </div>
    </div>
    <span className={`font-mono text-lg font-black ${accent}`}>{label}</span>
  </div>
);

/**
 * Renders `a + b + c` with zero terms removed, so a single-digit problem shows
 * "7 + 5" rather than "0 + (7 + 5)". Falls back to "0" if everything is zero.
 */
const TermRow: React.FC<{ terms: (React.ReactNode | null)[] }> = ({ terms }) => {
  const kept = terms.filter(t => t !== null && t !== false);
  if (kept.length === 0) return <span>0</span>;
  return (
    <>
      {kept.map((term, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span>+</span>}
          {term}
        </React.Fragment>
      ))}
    </>
  );
};

// The tutor is a guided sequence rather than a free-play sandbox, so it renders
// the same walkthrough in design preview and play mode — `isPlayMode` is unused.
export const AdditionTutorCanvas: React.FC<CanvasProps> = ({
  question,
  isDark = false,
  onSuccess,
  onAttempt
}) => {
  // All arithmetic — digit split, regrouping, digit mode — comes from the
  // shared model so the panel and AI schema can never describe a problem
  // differently from how the canvas teaches it.
  const rawNum1 = question.config?.num1 !== undefined ? question.config.num1 : 18;
  const rawNum2 = question.config?.num2 !== undefined ? question.config.num2 : 7;
  const model = React.useMemo(() => buildTutorModel(rawNum1, rawNum2), [rawNum1, rawNum2]);
  const {
    num1, num2, sum, tens1, ones1, tens2, ones2,
    totalOnes, needsRegroup, leftoverOnes, totalTens, digitMode,
  } = model;

  // A number with no tens digit shows only a Ones workspace while building.
  const showTens1 = tens1 > 0;
  const showTens2 = tens2 > 0;
  const combinedTens = tens1 + tens2;

  // Voice + mute live in the shared Koda hook so the actor, the spoken counts
  // and the sound effects all obey one mute switch.
  const voice = useKodaVoice("koda_tutor_muted");
  const speakText = voice.speak;

  const triggerSound = (type: 'pop' | 'tock' | 'success' | 'failure' | 'sparkle') => {
    if (voice.muted) return;
    if (type === 'pop') sounds.playPop();
    else if (type === 'tock') sounds.playTock();
    else if (type === 'success') sounds.playSuccess();
    else if (type === 'failure') sounds.playFailure();
    else if (type === 'sparkle') sounds.playSparkle();
  };

  // Interactive step controller: 1 to 12
  const [activeStep, setActiveStep] = useState<number>(1);

  // Step 2 & 3: Interactive number builder lists
  const [builtTens1, setBuiltTens1] = useState<number>(0);
  const [builtOnes1, setBuiltOnes1] = useState<number>(0);
  const [builtTens2, setBuiltTens2] = useState<number>(0);
  const [builtOnes2, setBuiltOnes2] = useState<number>(0);

  // Step 5: Interactive carrying states
  const targetOnesToMakeTen = model.onesToMakeTen; // ones needed to fill num1's ten frame
  /**
   * Step 5 models the movable ones as *objects that change place*, not as a
   * counter. `movedOnes` holds the ids that have travelled from the pool into
   * the frame, in the order they were moved. Because each id keeps a stable
   * `layoutId`, motion animates the very same element from the pool to its
   * frame slot — the child sees the one travel instead of teleport.
   */
  const [movedOnes, setMovedOnes] = useState<number[]>([]);
  const onesMovedToTenFrame = movedOnes.length;
  const poolOnes = Array.from({ length: ones2 }, (_, i) => i).filter(i => !movedOnes.includes(i));

  /** Ten ones collapsing into a single rod — a beat before step 6. */
  const [isBundling, setIsBundling] = useState(false);

  // Praise shown with the confetti. Held in state so it does not reshuffle on
  // every render, and never repeats the phrase used immediately before.
  const [praise, setPraise] = useState<string>("");
  const celebrate = () => {
    const word = randomPraise(praise);
    setPraise(word);
    speakText(word);
  };

  const moveOneToFrame = (id?: number) => {
    if (onesMovedToTenFrame >= targetOnesToMakeTen) return;
    const pick = id ?? poolOnes[0];
    if (pick === undefined) return;
    setMovedOnes(prev => [...prev, pick]);
    triggerSound("pop");
    // Say where it lands in the frame (9, 10) — not how many have moved.
    speakText(String(ones1 + onesMovedToTenFrame + 1));
  };

  /**
   * Step 6 → 7. The blocks turn into "20 + 5" before the symbolic flow opens,
   * so the numbers step 7 works with are ones the child just watched appear.
   */
  const [isMorphing, setIsMorphing] = useState(false);

  const morphIntoNumbers = () => {
    setIsMorphing(true);
    triggerSound("sparkle");
    setTimeout(() => {
      setIsMorphing(false);
      advanceStep();
    }, 1500);
  };

  const bundleIntoTenRod = () => {
    setIsBundling(true);
    triggerSound("success");
    setTimeout(() => {
      setIsBundling(false);
      advanceStep();
    }, 850);
  };

  // Fluency practice problems. Authors can pin an exact set in the Property
  // Studio; otherwise we derive problems that rehearse the same skill (same
  // digit shape, same regrouping behaviour) as the one just taught.
  const challenges = React.useMemo(() => {
    const authored = normaliseChallenges(question.config?.tutorChallenges);
    return authored.length > 0 ? authored : generateChallenges(num1, num2);
  }, [question.config?.tutorChallenges, num1, num2]);

  // The wizard adapts to the problem: the make-a-ten steps only exist when the
  // ones column actually overflows (12 + 3 skips them rather than asking the
  // student to move ones that do not exist), and the practice step only exists
  // when there is something to practise.
  const visibleSteps = React.useMemo(
    () => ALL_STEPS.filter(s => {
      if (!needsRegroup && MAKE_TEN_STEPS.includes(s)) return false;
      if (s === 11 && challenges.length === 0) return false;
      return true;
    }),
    [needsRegroup, challenges.length]
  );
  const stepPosition = visibleSteps.indexOf(activeStep);

  // The "Make Ten" phase vanishes along with its steps on a no-carry problem,
  // so the rail never advertises a phase the learner will not reach.
  const activePhases = React.useMemo(
    () => PHASES.filter(p => p.steps.some(s => visibleSteps.includes(s))),
    [visibleSteps]
  );
  const activePhaseIndex = activePhases.findIndex(p => (p.steps as readonly number[]).includes(activeStep));

  // Step 8: Sum answer input
  const [resultInput, setResultInput] = useState<string>("");
  const [isResultCorrect, setIsResultCorrect] = useState<boolean | null>(null);

  // Step 10 Carry Animation states
  const [carryAnimStage, setCarryAnimStage] = useState<number>(0);
  const [animTrigger, setAnimTrigger] = useState<number>(0);

  useEffect(() => {
    if (activeStep === 10) {
      setCarryAnimStage(0);
      const t1 = setTimeout(() => setCarryAnimStage(1), 1200); // Highlight ones
      const t2 = setTimeout(() => setCarryAnimStage(2), 3500); // Carry 1 up
      const t3 = setTimeout(() => setCarryAnimStage(3), 5800); // Solve tens
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [activeStep, animTrigger]);

  const replayAnimation = () => {
    setAnimTrigger(prev => prev + 1);
  };

  // Step 7 Deconstruction timeline states
  const [deconstructStage, setDeconstructStage] = useState<number>(0);
  const [deconstructTrigger, setDeconstructTrigger] = useState<number>(0);

  useEffect(() => {
    if (activeStep === 7) {
      setDeconstructStage(0);
      const t1 = setTimeout(() => setDeconstructStage(1), 1000);
      const t2 = setTimeout(() => setDeconstructStage(2), 2500);
      const t3 = setTimeout(() => setDeconstructStage(3), 4000);
      const t4 = setTimeout(() => setDeconstructStage(4), 5500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [activeStep, deconstructTrigger]);

  const replayDeconstruction = () => {
    setDeconstructTrigger(prev => prev + 1);
  };

  const buildPracticeStates = React.useCallback(
    () => challenges.map(c => ({
      num1: c.num1,
      num2: c.num2,
      ans: c.num1 + c.num2,
      input: "",
      isCorrect: null as boolean | null,
    })),
    [challenges]
  );

  const [practiceStates, setPracticeStates] = useState(buildPracticeStates);
  // Practice shows one question at a time; this is the cursor into `challenges`.
  // Equal to the length once every question has been answered correctly.
  const [practiceIndex, setPracticeIndex] = useState(0);
  const practiceInputRef = useRef<HTMLInputElement>(null);

  // Reset when the problem changes. Always starts at the beginning: both the
  // studio preview and GameLauncher pass isPlayMode=true, so keying the start
  // step off it meant students opened straight into fluency practice and never
  // reached the guided steps that are the point of a tutor.
  useEffect(() => {
    setActiveStep(1);
    setBuiltTens1(0);
    setBuiltOnes1(0);
    setBuiltTens2(0);
    setBuiltOnes2(0);
    setMovedOnes([]);
    setResultInput("");
    setIsResultCorrect(null);
    setPracticeStates(buildPracticeStates());
    setPracticeIndex(0);
  }, [num1, num2, buildPracticeStates]);

  // Move focus to the answer box whenever a new question appears, so a child
  // can keep typing without hunting for the field.
  useEffect(() => {
    if (activeStep === 11) practiceInputRef.current?.focus();
  }, [activeStep, practiceIndex]);

  // Practice finished — go straight to the reward. The celebration on the last
  // answer has already played by the time the cursor passes the final question.
  useEffect(() => {
    if (activeStep !== 11) return;
    if (practiceStates.length === 0 || practiceIndex < practiceStates.length) return;
    const t = setTimeout(() => advanceStep(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, practiceIndex, practiceStates.length]);

  const getStepText = () => {
    switch (activeStep) {
      case 1:
        return `Hi! I'm Koda. Are you ready to add **${num1}** and **${num2}**?`;
      case 2:
        if (builtTens1 === 0 && builtOnes1 === 0) {
          return `Let's build **${num1}**! First, tap **+ Ten Rod** to add **${tens1}** ten-rod.`;
        }
        if (builtTens1 < tens1) {
          return `Tap **+ Ten Rod** to add **${tens1}** ten-rods.`;
        }
        if (builtTens1 === tens1 && builtOnes1 === 0) {
          return `Great! We have **${tens1}** ten-rod. Now tap **+ One Unit** to add **${ones1}** ones.`;
        }
        if (builtTens1 === tens1 && builtOnes1 < ones1) {
          return `Tap **+ One Unit** to reach **${ones1}** ones. Currently we have **${builtOnes1}**.`;
        }
        return `Perfect! We built **${num1}**! Tap **Confirm Number ${num1}** to proceed.`;
      case 3:
        if (builtTens2 === 0 && builtOnes2 === 0) {
          if (tens2 > 0) {
            return `Now let's build **${num2}**! First, tap **+ Ten Rod** to add **${tens2}** ten-rods.`;
          } else {
            return `Now let's build **${num2}**! Tap **+ One Unit** to add **${ones2}** ones.`;
          }
        }
        if (builtTens2 < tens2) {
          return `Tap **+ Ten Rod** to add **${tens2}** ten-rods.`;
        }
        if (builtTens2 === tens2 && builtOnes2 < ones2) {
          if (builtOnes2 === 0) {
            return `Great! We have **${tens2}** ten-rods. Now tap **+ One Unit** to add **${ones2}** ones.`;
          }
          return `Keep tapping **+ One Unit** to reach **${ones2}** ones. Currently we have **${builtOnes2}**.`;
        }
        return `Perfect! We built **${num2}**! Tap **Confirm Number ${num2}** to put them together.`;
      case 4:
        return `Now let's put them all together!`;
      case 5:
        if (onesMovedToTenFrame === 0) {
          return `We have **${totalOnes}** ones. The frame holds **10**. Tap **${targetOnesToMakeTen}** more to fill it.`;
        }
        if (onesMovedToTenFrame < targetOnesToMakeTen) {
          return `Good! We are at **${ones1 + onesMovedToTenFrame}**. Tap **${targetOnesToMakeTen - onesMovedToTenFrame}** more to reach **10**.`;
        }
        return `The frame is full — that is **10**! Now bundle them into one ten-rod.`;
      case 6:
        return `You made a new ten-rod! Now we have **${totalTens}** ten-rods and **${leftoverOnes}** ones left over.`;
      case 7:
        return needsRegroup
          ? `Now let's write it with numbers. Watch how we make a ten.`
          : `Now let's write it with numbers. Tens with tens, ones with ones.`;
      case 8:
        return `What is **${totalTens * 10} + ${leftoverOnes}**? Type your answer.`;
      case 9:
        return `Awesome! **${num1}** plus **${num2}** equals **${sum}**! Let's review the vertical carrying symbols.`;
      case 10:
        return needsRegroup
          ? `See the little **1** on top? That is the ten we carried. Now you try!`
          : `Each column adds on its own. Nothing to carry here. Now you try!`;
      case 11:
        return `Your turn! Add these on your own.`;
      case 12:
        return `You did it! Ready for bigger numbers?`;
      default:
        return "";
    }
  };

  // Koda's spoken line is derived from the same string the bubble shows
  // (markers stripped), so wording can no longer drift between eye and ear.
  const currentStepText = getStepText();

  // Koda reacts to what just happened rather than bouncing continuously:
  // celebrating a solve, wincing at a wrong answer, pondering the symbol steps.
  const kodaMood: KodaMood =
    activeStep === 9 || activeStep === 12
      ? "cheer"
      : isResultCorrect === false
        ? "oops"
        : activeStep === 7 || activeStep === 10
          ? "think"
          : "idle";


  const advanceStep = () => {
    triggerSound("pop");
    if (stepPosition >= 0 && stepPosition < visibleSteps.length - 1) {
      setActiveStep(visibleSteps[stepPosition + 1]);
    }
  };

  const retreatStep = () => {
    triggerSound("tock");
    if (stepPosition > 0) {
      setActiveStep(visibleSteps[stepPosition - 1]);
    }
  };

  const handleResultSubmit = () => {
    const val = parseInt(resultInput);
    if (val === sum) {
      setIsResultCorrect(true);
      triggerSound("success");
      celebrate();
      onAttempt?.("correct", { expected: String(sum), selected: resultInput });
      setTimeout(() => {
        advanceStep();
      }, 1000);
    } else {
      setIsResultCorrect(false);
      triggerSound("failure");
      onAttempt?.("incorrect", { expected: String(sum), selected: resultInput });
      setTimeout(() => setIsResultCorrect(null), 1500);
    }
  };

  // Rows are replaced, never mutated in place, so React always sees new
  // objects and stale closures cannot resurrect an old answer.
  const patchPractice = (index: number, patch: Partial<(typeof practiceStates)[number]>) => {
    setPracticeStates(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handlePracticeChange = (index: number, val: string) => {
    patchPractice(index, { input: val, isCorrect: null });
  };

  const checkPractice = (index: number) => {
    const item = practiceStates[index];
    if (!item || !item.input.trim()) return;

    const correct = parseInt(item.input, 10) === item.ans;

    patchPractice(index, { isCorrect: correct });
    triggerSound(correct ? "success" : "failure");
    onAttempt?.(correct ? "correct" : "incorrect", {
      expected: String(item.ans),
      selected: item.input,
    });

    if (correct) {
      celebrate();
      // Hold the confetti and praise long enough to enjoy, then move on.
      setTimeout(() => setPracticeIndex(i => i + 1), 1500);
    } else {
      // Clear the answer so the next attempt starts from an empty box.
      setTimeout(() => patchPractice(index, { isCorrect: null, input: "" }), 1000);
    }
  };

  const allPracticeDone = practiceStates.every(p => p.isCorrect === true);

  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // A ten-rod laid out horizontally is the widest thing on the board, so sizing
  // the unit to fit one rod across the canvas keeps every block in proportion.
  // Subtract the workspace padding so the rod does not touch the edges.
  const unitSize = useFittedUnitSize(containerRef, ROD_WIDTH_UNITS + 2);

  return (
    // `@container` makes every breakpoint below respond to the canvas's own
    // width, not the browser window — the canvas is a ~530px Studio panel on a
    // 1440px monitor, so viewport breakpoints picked the wrong layout.
    <div ref={containerRef} className={`@container w-full h-full flex flex-col overflow-hidden rounded-2xl border shadow-sm relative
      ${isDark
        ? "dark bg-slate-900 border-slate-800 text-slate-100"
        : "bg-slate-50 border-slate-200 text-slate-800"
      }`}
    >
      {/* ── KODA, THE GUIDE ── */}
      {activeStep <= 10 && (
        <KodaActor
          text={currentStepText}
          mood={kodaMood}
          voice={voice}
          isDark={isDark}
          dragConstraints={containerRef}
          // The character the author cast in the Studio, per moment.
          {...guidePropsFor(question)}
        />
      )}


      {/* ── WORKSPACE AREA ── */}
      {/* One unit size for every block on the board, sized to the canvas so a
          rod's cell always equals a one-unit no matter how wide the panel is. */}
      <Base10Scale size={unitSize}>
      <div className={`flex-1 overflow-y-auto px-4 pb-4 pt-4 @3xl:px-8 @3xl:pb-8 flex flex-col justify-center items-center min-h-0 ${activeStep <= 10 ? "@xl:pt-32" : ""}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full flex justify-center"
          >
            {/* STEP 1: Story Intro */}
            {activeStep === 1 && (
              <div className="max-w-md w-full flex flex-col items-center text-center space-y-4">
                <div className="relative w-full h-36 rounded-xl overflow-hidden bg-gradient-to-b from-sky-400 to-emerald-400 border border-sky-300 dark:border-sky-700 shadow-inner flex items-center justify-center">
                  <div className="text-5xl absolute top-10 left-1/2 -translate-x-1/2 animate-bounce">🌳</div>
                  <div className="text-3xl absolute top-12 left-1/3">🍎</div>
                  <div className="text-3xl absolute top-8 right-1/3">🍎</div>
                  <div className="text-4xl absolute bottom-0 right-10">🧺</div>
                  <div className="text-4xl absolute bottom-2 left-12">👾</div>
                </div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  {question.title?.trim() || "Addition Adventure"}
                </h3>

                {/* What kind of problem this is, and whether it will carry */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60">
                    {describeDigitMode(digitMode)}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    needsRegroup
                      ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/60"
                      : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60"
                  }`}>
                    {needsRegroup ? "Make a Ten" : "No Regrouping"}
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  {question.instruction?.trim() || (
                    <>Let's help Koda group his units into tens and ones. We want to add <strong className="text-indigo-650 font-bold">{num1}</strong> and <strong className="text-rose-600 font-bold">{num2}</strong> together!</>
                  )}
                </p>
                <StepButton onClick={advanceStep}>
                  <Play size={14} />
                  Let's Go!
                </StepButton>
              </div>
            )}

            {/* STEP 2 & 3: Build each addend from tens rods and one units (CONCRETE) */}
            {(activeStep === 2 || activeStep === 3) && (
              <NumberBuilder
                target={activeStep === 2 ? num1 : num2}
                targetTens={activeStep === 2 ? tens1 : tens2}
                targetOnes={activeStep === 2 ? ones1 : ones2}
                builtTens={activeStep === 2 ? builtTens1 : builtTens2}
                builtOnes={activeStep === 2 ? builtOnes1 : builtOnes2}
                accentClass={activeStep === 2 ? "text-indigo-650" : "text-rose-600"}
                objectId={question.objectId}
                onAddTen={() => {
                  const setTens = activeStep === 2 ? setBuiltTens1 : setBuiltTens2;
                  const current = activeStep === 2 ? builtTens1 : builtTens2;
                  const limit = activeStep === 2 ? tens1 : tens2;
                  if (current < limit) {
                    setTens(current + 1);
                    triggerSound("pop");
                    speakText(String((current + 1) * 10));
                  }
                }}
                onAddOne={() => {
                  const setOnes = activeStep === 2 ? setBuiltOnes1 : setBuiltOnes2;
                  const current = activeStep === 2 ? builtOnes1 : builtOnes2;
                  const limit = activeStep === 2 ? ones1 : ones2;
                  if (current < limit) {
                    setOnes(current + 1);
                    triggerSound("pop");
                    speakText(String(current + 1));
                  }
                }}
                onReset={() => {
                  if (activeStep === 2) { setBuiltTens1(0); setBuiltOnes1(0); }
                  else { setBuiltTens2(0); setBuiltOnes2(0); }
                  triggerSound("tock");
                }}
                onConfirm={advanceStep}
                onComplete={() => triggerSound("success")}
              />
            )}


            {/* STEP 4: Put them together */}
            {activeStep === 4 && (
              <div className="w-full max-w-lg @3xl:max-w-3xl space-y-5 text-center">
                <div className="min-h-[200px] py-2 flex flex-col justify-between items-center relative">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block mb-2">Put Them Together</span>
                  
                  {/*
                    The two numbers slide in from opposite sides and meet, so
                    "put them together" is something the child watches happen
                    rather than a screen they arrive at. Grouped by number here;
                    the next step is where they get regrouped by place value.
                  */}
                  <RodFit fraction={0.42} className="flex flex-wrap gap-4 @lg:gap-8 items-center flex-1 justify-center">
                    <MergeIn from="left">
                      <AddendGroup
                        label={num1}
                        tens={tens1}
                        ones={ones1}
                        objectId={question.objectId}
                        accent="text-indigo-650"
                      />
                    </MergeIn>

                    <motion.span
                      initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.35, type: "spring", stiffness: 400, damping: 20 }}
                      className="text-3xl font-extrabold text-slate-400"
                    >
                      +
                    </motion.span>

                    <MergeIn from="right" delay={0.06}>
                      <AddendGroup
                        label={num2}
                        tens={tens2}
                        ones={ones2}
                        objectId={question.objectId}
                        accent="text-rose-600"
                      />
                    </MergeIn>
                  </RodFit>
                </div>

                <StepButton onClick={advanceStep}>
                  Put Them Together
                  <ArrowRight size={13} />
                </StepButton>
              </div>
            )}

            {/* STEP 5: Make another ten */}
            {activeStep === 5 && (
              <div className="w-full max-w-lg @3xl:max-w-2xl space-y-4">
                <div className="text-center text-xs font-semibold text-slate-600 dark:text-slate-300 select-none pb-1">
                  We have <strong className="font-extrabold text-indigo-600 dark:text-indigo-400">{totalOnes}</strong> ones. Tap <strong className="font-extrabold text-indigo-600 dark:text-indigo-400">{targetOnesToMakeTen}</strong> more to fill the ten frame.
                </div>

                <div className="relative py-2">
                  <RodFit className="space-y-8 flex flex-col items-center">
                    {/* ── The ten frame ── */}
                    <div className="border-2 border-dashed border-indigo-400/60 p-4 rounded-xl w-full max-w-xs flex flex-col items-center relative">
                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest absolute top-2 left-2">New Ten Frame</span>

                      {/*
                        The frame is numbered straight through, 1…10. Seeing the
                        count climb is the lesson — a child reads off "I'm at 8,
                        two more makes ten".
                      */}
                      <div className="grid grid-cols-5 gap-2 mt-4">
                        {/* num1's ones: already here, never move */}
                        {Array.from({ length: ones1 }).map((_, i) => (
                          <BundlingUnit key={`fixed-${i}`} bundling={isBundling} index={i}>
                            <OneUnit type={question.objectId} label={String(i + 1)} />
                          </BundlingUnit>
                        ))}

                        {/* Slots ones1+1 … 10: filled by ones that travel up */}
                        {Array.from({ length: targetOnesToMakeTen }).map((_, i) => {
                          const movedId = movedOnes[i];
                          const isFilled = movedId !== undefined;
                          const ordinal = ones1 + i + 1;
                          const isNext = !isFilled && i === onesMovedToTenFrame;

                          if (isFilled) {
                            return (
                              <BundlingUnit key={`slot-${i}`} bundling={isBundling} index={ones1 + i}>
                                {/* Same layoutId as in the pool — motion carries
                                    the element across, so the one visibly flies
                                    from the pool into this slot. */}
                                <motion.div layoutId={`one-${movedId}`} transition={BLOCK_SPRING}>
                                  <OneUnit type={question.objectId} label={String(ordinal)} noEnter />
                                </motion.div>
                              </BundlingUnit>
                            );
                          }

                          return (
                            <motion.button
                              key={`slot-${i}`}
                              onClick={() => moveOneToFrame()}
                              aria-label={`Put one here to make ${ordinal}`}
                              title="Tap to move one here"
                              // Only the next slot invites a tap, so the eye is
                              // drawn to one place rather than every empty cell.
                              animate={isNext && !reduceMotion ? { scale: [1, 1.06, 1], opacity: [0.75, 1, 0.75] } : { scale: 1, opacity: 0.75 }}
                              transition={isNext && !reduceMotion ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
                              className="relative w-10 h-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-xs cursor-pointer select-none hover:border-indigo-400 dark:hover:border-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              {ordinal}
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* The bundle: ten ones collapse and one rod rises in their place */}
                      <AnimatePresence>
                        {isBundling && (
                          <motion.div
                            initial={{ scale: 0.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: 0.28, type: "spring", stiffness: 380, damping: 24 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          >
                            <TenRod type={question.objectId} noEnter />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* ── The pool of ones still to move ── */}
                    <div className="w-full max-w-xs flex flex-col items-center p-3.5 pt-6 rounded-2xl relative border border-dashed border-slate-300/70 dark:border-slate-700/60">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest absolute top-2 left-2">Remaining Ones</span>

                      <div className="grid grid-cols-5 gap-2 mt-4 min-h-[2.5rem]">
                        {poolOnes.map(id => (
                          <motion.div key={id} layoutId={`one-${id}`} transition={BLOCK_SPRING}>
                            <OneUnit
                              type={question.objectId}
                              isInteractive
                              noEnter
                              onClick={() => moveOneToFrame(id)}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </RodFit>
                </div>

                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => { setMovedOnes([]); triggerSound("tock"); }}
                    aria-label="Put the ones back"
                    className="w-11 h-10 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700 rounded-xl flex items-center justify-center cursor-pointer transition-colors shadow-sm active:scale-95"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <div className="flex-1">
                    <ConfirmButton
                      ready={onesMovedToTenFrame >= targetOnesToMakeTen && !isBundling}
                      onClick={bundleIntoTenRod}
                    >
                      Make a New Ten Rod
                    </ConfirmButton>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6: The blocks become numbers (concrete → abstract) */}
            {activeStep === 6 && (
              <div className="w-full max-w-md @3xl:max-w-2xl space-y-5 text-center">
                <div className="flex flex-col items-center space-y-5">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
                    {isMorphing ? "Now in numbers!" : "New Ten Created!"}
                  </h3>

                  {/*
                    A place-value chart: tens on the left, ones on the right.
                    Framing it this way is what makes the morph legible — each
                    column turns into the number that column is worth.
                  */}
                  <RodFit fraction={0.46} className="grid grid-cols-2">
                    <div className="p-3 border-r border-slate-200/70 dark:border-slate-700/60 space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 block">Tens</span>
                      <MorphSlot morphed={isMorphing} numeral={totalTens * 10} accent="text-indigo-650 dark:text-indigo-400">
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          {Array.from({ length: totalTens }).map((_, i) => (
                            <TenRod key={i} type={question.objectId} noEnter />
                          ))}
                        </div>
                      </MorphSlot>
                    </div>

                    <div className="p-3 space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 block">Ones</span>
                      <MorphSlot morphed={isMorphing} numeral={leftoverOnes} accent="text-rose-600 dark:text-rose-400" delay={0.14}>
                        <div className="grid grid-cols-3 gap-1.5 justify-items-center">
                          {Array.from({ length: leftoverOnes }).map((_, i) => (
                            <OneUnit key={i} type={question.objectId} noEnter />
                          ))}
                        </div>
                      </MorphSlot>
                    </div>
                  </RodFit>

                  {/* The two numerals read as one equation once both have landed */}
                  <div className="h-6 flex items-center justify-center">
                    {isMorphing && (
                      <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduceMotion ? 0 : 0.75 }}
                        className="font-mono text-sm font-black text-slate-500 dark:text-slate-400"
                      >
                        <TermRow terms={[
                          totalTens > 0 ? <span key="t">{totalTens * 10}</span> : null,
                          leftoverOnes > 0 ? <span key="o">{leftoverOnes}</span> : null,
                        ]} />
                      </motion.div>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    {isMorphing
                      ? "Blocks can be written as numbers."
                      : <>We turned 10 ones into 1 ten-rod. Now we have <strong className="text-indigo-600">{totalTens}</strong> ten-rods and <strong className="text-rose-600">{leftoverOnes}</strong> ones.</>}
                  </p>
                </div>

                <StepButton onClick={morphIntoNumbers} disabled={isMorphing}>
                  Now Write It
                  <ArrowRight size={13} />
                </StepButton>
              </div>
            )}

            {/* STEP 7: Rename the numbers */}
            {activeStep === 7 && (
              <div className="w-full max-w-lg @3xl:max-w-2xl space-y-4 flex flex-col items-center">
                <div className="w-full">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block mb-5 text-center">Breaking It Apart</span>

                  <div className="space-y-3 font-mono text-center flex flex-col items-center py-2 select-none w-full min-h-[320px] justify-start">
                    {/* Row 1 */}
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-extrabold">
                      <span>{num1} + {num2}</span>
                    </div>

                    {/* Row 2 */}
                    {deconstructStage >= 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center w-full"
                      >
                        <div className="text-xs text-slate-350 my-0.5">↓</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-3.5 py-1.5 rounded-xl">
                          <TermRow terms={[
                            <span key="a">{showTens1 ? `(${tens1 * 10} + ${ones1})` : num1}</span>,
                            <span key="b">{showTens2 ? `(${tens2 * 10} + ${ones2})` : num2}</span>,
                          ]} />
                        </div>
                      </motion.div>
                    )}

                    {/* Row 3 */}
                    {deconstructStage >= 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center w-full"
                      >
                        <div className="text-xs text-slate-350 my-0.5">↓</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-3.5 py-1.5 rounded-xl">
                          <TermRow terms={[
                            combinedTens > 0 ? <span key="t">{combinedTens * 10}</span> : null,
                            <span key="o" className="text-indigo-600 dark:text-indigo-400 font-bold">({ones1} + {ones2})</span>,
                          ]} />
                        </div>
                      </motion.div>
                    )}

                    {/* Row 4 — the make-ten split, only when the ones overflow */}
                    {needsRegroup && deconstructStage >= 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center w-full"
                      >
                        <div className="text-xs text-slate-350 my-0.5">↓</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-4 py-2 rounded-xl">
                          <TermRow terms={[
                            combinedTens > 0 ? <span key="t">{combinedTens * 10}</span> : null,
                            <span key="ten" className="text-indigo-600 dark:text-indigo-400 font-bold">10</span>,
                            leftoverOnes > 0 ? <span key="o" className="text-rose-600 dark:text-rose-400 font-bold">{leftoverOnes}</span> : null,
                          ]} />
                        </div>
                      </motion.div>
                    )}

                    {/* Row 5 */}
                    {deconstructStage >= (needsRegroup ? 4 : 3) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center w-full"
                      >
                        <div className="text-xs text-slate-350 my-0.5">↓</div>
                        <div className="flex items-center gap-1.5 text-base font-extrabold text-slate-800 dark:text-white border-2 border-indigo-200 dark:border-slate-700 px-5 py-3 rounded-2xl bg-indigo-50/20 dark:bg-indigo-950/10 animate-pulse shadow-sm">
                          <TermRow terms={[
                            totalTens > 0 ? <span key="t" className="text-indigo-650 dark:text-indigo-400 font-black">{totalTens * 10}</span> : null,
                            leftoverOnes > 0 ? <span key="o" className="text-rose-600 dark:text-rose-400 font-black">{leftoverOnes}</span> : null,
                          ]} />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Replay Flow button */}
                  <div className="flex justify-center mt-3 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <button
                      onClick={replayDeconstruction}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1 cursor-pointer transition-colors shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                    >
                      <RotateCcw size={10} /> Replay Animation
                    </button>
                  </div>
                </div>

                <StepButton onClick={advanceStep}>
                  Write It Down
                  <ArrowRight size={13} />
                </StepButton>
              </div>
            )}

            {/* STEP 8: Find the result */}
            {activeStep === 8 && (
              <div className="relative w-full max-w-sm space-y-4">
                <Celebration show={isResultCorrect === true} message={praise} />
                <div className="text-center space-y-6">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block">What Is The Total?</span>
                  
                  {/* Equations summary */}
                  <div className="text-4xl font-black font-mono tracking-tight py-2 flex items-center justify-center gap-2 text-slate-800 dark:text-slate-100">
                    <TermRow terms={[
                      totalTens > 0 ? <span key="t">{totalTens * 10}</span> : null,
                      leftoverOnes > 0 ? <span key="o">{leftoverOnes}</span> : null,
                    ]} /> = ?
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">Your Answer</label>
                    <input
                      type="number"
                      value={resultInput}
                      onChange={(e) => { setResultInput(e.target.value); setIsResultCorrect(null); }}
                      placeholder="Type result..."
                      onKeyDown={(e) => e.key === "Enter" && handleResultSubmit()}
                      className={`w-full text-center text-xl font-bold py-3 border rounded-xl outline-none focus:ring-4 transition-all
                        ${isResultCorrect === true
                          ? "border-emerald-500 focus:ring-emerald-100 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300"
                          : isResultCorrect === false
                            ? "border-rose-400 focus:ring-rose-100 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300"
                            : "border-slate-300 dark:border-slate-700 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                        }`}
                    />
                  </div>

                  <StepButton onClick={handleResultSubmit} disabled={!resultInput.trim()}>
                    Check Sum
                  </StepButton>
                </div>
              </div>
            )}

            {/* STEP 9: Celebrate */}
            {activeStep === 9 && (
              <div className="w-full max-w-sm space-y-4 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center text-4xl shadow-inner animate-bounce">
                    🏆
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Super Addition!</h3>
                  <div className="text-xl font-black text-indigo-650 bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/50 dark:text-indigo-300 px-6 py-3.5 rounded-2xl">
                    {num1} + {num2} = {sum}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    {needsRegroup
                      ? `You made a new ten! That turned ${num1} + ${num2} into ${totalTens * 10} + ${leftoverOnes}, which is ${sum}.`
                      : `You added the tens and the ones on their own: ${totalTens * 10} + ${leftoverOnes} = ${sum}. No carrying this time!`}
                  </p>
                </div>

                <StepButton onClick={advanceStep}>
                  Review Vertical Method
                  <ArrowRight size={13} />
                </StepButton>
              </div>
            )}

            {/* STEP 10: Symbols (vertical write it) */}
            {activeStep === 10 && (
              <div className="w-full max-w-lg @3xl:max-w-2xl space-y-4">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block mb-6 text-center">Adding In Columns</span>

                  <div className="flex flex-col @2xl:flex-row gap-6 @2xl:gap-8 items-center justify-center py-4 w-full">
                    {/* Vertical addition visual using a precise three-column grid (Operator, Tens, Ones) */}
                    {/* The divider only makes sense side-by-side; stacked it
                        would be a stray vertical rule under the sum. */}
                    <div className="flex flex-col items-center @2xl:border-r border-slate-100 dark:border-slate-800/80 @2xl:pr-8">
                      <div className="grid grid-cols-[24px_minmax(32px,auto)_32px] gap-x-4 gap-y-3 font-mono text-3xl font-black text-slate-800 dark:text-slate-100 select-none justify-center">
                        {/* Row 1: Carry Badge Positioned ABOVE Column 2 (Tens) */}
                        <div className="w-6 h-8"></div>
                        <div className="w-8 h-8 flex items-center justify-center">
                          {needsRegroup && carryAnimStage >= 2 && (
                            <motion.span
                              initial={{ y: 92, x: 36, scale: 0.5, opacity: 0 }}
                              animate={{ y: 0, x: 0, scale: 1, opacity: 1 }}
                              transition={{ duration: 0.85, ease: [0.34, 1.56, 0.64, 1] }}
                              className="w-7 h-7 rounded-full bg-indigo-600 text-white dark:bg-indigo-650 dark:text-white text-xs font-black flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-md shadow-indigo-500/20"
                            >
                              1
                            </motion.span>
                          )}
                        </div>
                        <div className="w-8 h-8"></div>

                        {/* Row 2: First Addend (18) */}
                        <div className="w-6 h-8"></div>
                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300
                          ${carryAnimStage === 3 
                            ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400 scale-105 shadow-sm border border-indigo-200/30" 
                            : ""
                          }`}
                        >
                          {tens1 > 0 ? tens1 : ""}
                        </div>
                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300
                          ${carryAnimStage === 1 
                            ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 scale-105 shadow-sm border border-rose-200/30" 
                            : ""
                          }`}
                        >
                          {ones1}
                        </div>

                        {/* Row 3: Second Addend — renders its tens digit too (e.g. 18 + 14) */}
                        <div className="w-6 h-8 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-sans text-2xl font-bold">
                          +
                        </div>
                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300
                          ${carryAnimStage === 3
                            ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400 scale-105 shadow-sm border border-indigo-200/30"
                            : ""
                          }`}
                        >
                          {tens2 > 0 ? tens2 : ""}
                        </div>
                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300
                          ${carryAnimStage === 1 
                            ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 scale-105 shadow-sm border border-rose-200/30" 
                            : ""
                          }`}
                        >
                          {ones2}
                        </div>

                        {/* Calculation Line */}
                        <div className="col-span-3 h-0.5 bg-slate-300 dark:bg-slate-700 rounded my-1" />

                        {/* Row 4: Answer (25) */}
                        <div className="w-6 h-10"></div>
                        {/* min-w so a three-digit sum (e.g. 99 + 20) is not clipped */}
                        <div className="min-w-8 h-10 flex items-center justify-center">
                          {carryAnimStage >= 3 ? (
                            <motion.div
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-indigo-600 dark:text-indigo-400 text-4xl font-extrabold text-center"
                            >
                              {totalTens > 0 ? totalTens : ""}
                            </motion.div>
                          ) : (
                            <span className="text-transparent">0</span>
                          )}
                        </div>
                        <div className="w-8 h-10 flex items-center justify-center">
                          {carryAnimStage >= 2 ? (
                            <motion.div
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-indigo-600 dark:text-indigo-400 text-4xl font-extrabold text-center"
                            >
                              {leftoverOnes}
                            </motion.div>
                          ) : (
                            <span className="text-transparent">0</span>
                          )}
                        </div>
                      </div>

                      {/* Replay controller button */}
                      <button
                        onClick={replayAnimation}
                        className="mt-5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1 cursor-pointer transition-colors shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                      >
                        <RotateCcw size={10} /> Replay Animation
                      </button>
                    </div>

                    {/* Pedagogy callout box explaining stages - formatted as clean plain text */}
                    <div className="max-w-[220px] w-full space-y-2 text-left select-none">
                      {carryAnimStage === 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Overview</span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                            Let's watch how the standard algorithm calculates addition vertically, carrying units.
                          </p>
                        </div>
                      )}

                      {carryAnimStage === 1 && (
                        <div className="space-y-1 animate-scale-up">
                          <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Step 1: Add Ones</span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                            Add the ones column: <strong className="text-rose-600 dark:text-rose-400 font-bold">{ones1} + {ones2} = {totalOnes}</strong>. {needsRegroup ? "Since it is 10 or more, we split it." : "It is less than 10, so nothing needs carrying."}
                          </p>
                        </div>
                      )}

                      {carryAnimStage === 2 && (
                        <div className="space-y-1 animate-scale-up">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Step 2: {needsRegroup ? "Carry Over" : "Write the Ones"}</span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                            {needsRegroup ? (
                              <>Write the remaining <strong className="text-rose-600 dark:text-rose-400 font-bold">{leftoverOnes}</strong> at the bottom. Carry the <strong className="text-indigo-600 dark:text-indigo-400 font-bold">1 ten</strong> to the top of the Tens column.</>
                            ) : (
                              <>Write <strong className="text-rose-600 dark:text-rose-400 font-bold">{leftoverOnes}</strong> at the bottom of the Ones column. There is nothing to carry.</>
                            )}
                          </p>
                        </div>
                      )}

                      {carryAnimStage >= 3 && (
                        <div className="space-y-1 animate-scale-up">
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 tracking-wider uppercase block">Step 3: Add Tens</span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                            Add the tens column: <strong className="text-indigo-650 dark:text-indigo-400 font-bold">
                              {needsRegroup ? "1 (carry) + " : ""}{tens1}{tens2 > 0 ? ` + ${tens2}` : ""} = {totalTens}
                            </strong> tens. Write <strong className="text-indigo-650 dark:text-indigo-400 font-bold">{totalTens}</strong> at the bottom.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <StepButton onClick={advanceStep}>
                  Now You Try
                  <ArrowRight size={13} />
                </StepButton>
              </div>
            )}

            {/* STEP 11: Practice — one question at a time */}
            {activeStep === 11 && (() => {
              const total = practiceStates.length;
              const current = practiceStates[practiceIndex];

              // Every question answered — fall through to the reward screen
              // rather than parking the child on a second panel with a second
              // button. The effect below advances as soon as the last burst has
              // played, so answering the final question *is* the transition.
              if (!current) return null;

              return (
                <div className="relative w-full max-w-md space-y-5">
                  <Celebration show={current.isCorrect === true} message={praise} />

                  {/* Progress: one bar per question, the current one highlighted */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      {practiceStates.map((p, i) => (
                        <span
                          key={i}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            p.isCorrect === true
                              ? "w-7 bg-emerald-500"
                              : i === practiceIndex
                                ? "w-7 bg-indigo-600"
                                : "w-2.5 bg-slate-200 dark:bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {practiceIndex + 1} of {total}
                    </span>
                  </div>

                  {/* The one question */}
                  <div className="text-center space-y-6 py-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      What is the answer?
                    </p>

                    <div className="font-mono text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                      {current.num1} + {current.num2} = ?
                    </div>

                    <input
                      ref={practiceInputRef}
                      type="number"
                      inputMode="numeric"
                      value={current.input}
                      onChange={(e) => handlePracticeChange(practiceIndex, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && checkPractice(practiceIndex)}
                      disabled={current.isCorrect === true}
                      placeholder="?"
                      aria-label={`What is ${current.num1} plus ${current.num2}?`}
                      className={`w-32 mx-auto block text-center text-3xl font-black py-3 rounded-2xl outline-none border-2 transition-colors
                        ${current.isCorrect === true
                          ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                          : current.isCorrect === false
                            ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:border-indigo-500"
                        }`}
                    />

                    {/* Feedback keeps its own row so nothing shifts when it appears */}
                    <div className="h-5 text-sm font-bold">
                      {current.isCorrect === false && (
                        <span className="text-rose-600 dark:text-rose-400">Not quite — try again.</span>
                      )}
                    </div>
                  </div>

                  <StepButton onClick={() => checkPractice(practiceIndex)} disabled={!current.input.trim() || current.isCorrect === true}>
                    Check
                  </StepButton>
                </div>
              );
            })()}

            {/* STEP 12: Level up */}
            {activeStep === 12 && (
              <div className="relative max-w-md w-full flex flex-col items-center text-center space-y-5 animate-scale-up">
                <Celebration show message={praise || "Well done!"} count={40} />
                <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-gradient-to-b from-amber-400 to-indigo-650 border border-amber-300 dark:border-amber-700 shadow-inner flex items-center justify-center">
                  {/* Treasure chest */}
                  <div className="text-8xl absolute animate-bounce">🎁</div>
                  <div className="text-3xl absolute top-4 left-6 animate-pulse text-amber-300">⭐️</div>
                  <div className="text-4xl absolute bottom-6 right-8 animate-pulse text-amber-200">✨</div>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">All Done!</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  You learned how to make a ten to add. Keep going and try bigger numbers!
                </p>
                <StepButton
                  onClick={() => {
                    triggerSound("success");
                    onSuccess?.();
                  }}
                >
                  Finish
                  <ChevronRight size={14} />
                </StepButton>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      </Base10Scale>

      {/* ── FOOTER WIZARD CONTROLS ── */}
      <div className={`p-2.5 px-4 border-t shrink-0 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800`}>
        <button
          onClick={retreatStep}
          disabled={activeStep === 1}
          className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer flex items-center gap-1"
        >
          ← Back
        </button>

        {/* CPA phase rail — shows the arc from blocks to symbols, not just a number */}
        <div className="flex items-center gap-1 @lg:gap-2 min-w-0">
          {activePhases.map((phase, i) => {
            const Icon = phase.icon;
            const state = i === activePhaseIndex ? "current" : i < activePhaseIndex ? "done" : "todo";
            return (
              <React.Fragment key={phase.id}>
                {i > 0 && <span className={`h-px w-2 @lg:w-4 ${state === "todo" ? "bg-slate-200 dark:bg-slate-700" : "bg-indigo-400"}`} />}
                <div
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors duration-300 ${
                    state === "current"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : state === "done"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-slate-400 dark:text-slate-600"
                  }`}
                  title={`${phase.label} — phase ${i + 1} of ${activePhases.length}`}
                >
                  <Icon size={11} className="shrink-0" />
                  {/* Only the current phase is named, so the rail never wraps
                      in a narrow canvas panel; the rest are icons with tooltips. */}
                  {state === "current" && (
                    <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                      {phase.label}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          <span className="hidden @xl:inline text-[9px] text-slate-400 font-bold uppercase tracking-wider ml-1 whitespace-nowrap">
            {stepPosition + 1}/{visibleSteps.length}
          </span>
        </div>

        {/* Next step bypass button */}
        <button
          onClick={advanceStep}
          disabled={
            stepPosition >= visibleSteps.length - 1 ||
            (activeStep === 2 && (builtTens1 !== tens1 || builtOnes1 !== ones1)) ||
            (activeStep === 3 && (builtTens2 !== tens2 || builtOnes2 !== ones2)) ||
            (activeStep === 5 && onesMovedToTenFrame < targetOnesToMakeTen) ||
            (activeStep === 8 && !isResultCorrect) ||
            (activeStep === 11 && !allPracticeDone)
          }
          className="text-xs font-bold text-indigo-650 hover:text-indigo-700 disabled:opacity-30 cursor-pointer flex items-center gap-1"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

/**
 * CONCRETE phase — build one addend out of ten-rods and one-units.
 *
 * Shared by both addends, and by both single- and double-digit numbers: when a
 * number has no tens digit the rod workspace and its button are dropped
 * entirely, so a 1-digit problem never shows an empty "Tens" box the learner
 * is not allowed to fill.
 */
/**
 * The single "move on" action for a step.
 *
 * Sized to its label rather than stretched across the card: a full-width bar
 * implies the whole row is the target and, on a wide canvas, turns a one-word
 * action into a banner. One shape for every step keeps the flow predictable.
 */
const StepButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, children }) => {
  const reduce = useReducedMotion();
  return (
    <div className="flex justify-center">
      <motion.button
        onClick={onClick}
        disabled={disabled}
        whileHover={disabled || reduce ? undefined : { scale: 1.04, y: -1 }}
        whileTap={disabled || reduce ? undefined : { scale: 0.97, y: 0 }}
        className={`px-8 py-3 rounded-full font-bold tracking-wide flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          disabled
            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-lg shadow-indigo-600/25"
        }`}
      >
        {children}
      </motion.button>
    </div>
  );
};

/**
 * The "you got it, now go on" button.
 *
 * Hidden entirely until the build matches its target, then it springs in with a
 * shine and settles into a slow green glow. Nothing to confirm means nothing to
 * show — a greyed-out bar is just clutter a child has to learn to ignore, and
 * its sudden appearance is a far clearer "you got it" than a colour change.
 * Green ties it to the MATCHED badge: the same signal, twice.
 */
const ConfirmButton: React.FC<{
  ready: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ ready, onClick, children }) => {
  const reduce = useReducedMotion();

  return (
    // Space is reserved so the layout does not jump when the button arrives.
    <div className="min-h-[3.25rem] flex items-center justify-center">
      <AnimatePresence>
        {ready && (
          <motion.button
            onClick={onClick}
            initial={reduce ? false : { scale: 0.6, opacity: 0, y: 8 }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0,
              boxShadow: reduce
                ? "0 6px 20px -8px rgba(16,185,129,0.55)"
                : [
                    "0 6px 20px -8px rgba(16,185,129,0.55)",
                    "0 12px 30px -8px rgba(16,185,129,0.85)",
                    "0 6px 20px -8px rgba(16,185,129,0.55)",
                  ],
            }}
            exit={reduce ? { opacity: 0 } : { scale: 0.8, opacity: 0, transition: { duration: 0.15 } }}
            transition={{
              scale: { type: "spring", stiffness: 420, damping: 18 },
              opacity: { duration: 0.2 },
              boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }}
            whileHover={reduce ? undefined : { scale: 1.04 }}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            className="relative overflow-hidden px-10 py-3 rounded-full font-bold tracking-wide flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {/* One shine sweep as it arrives */}
            {!reduce && (
              <motion.span
                aria-hidden
                initial={{ x: "-150%" }}
                animate={{ x: "150%" }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
                className="absolute inset-y-0 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent"
              />
            )}

            <span className="relative flex items-center gap-2">
              {children}
              <motion.span
                initial={reduce ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 500, damping: 14 }}
                className="inline-flex"
              >
                <Check size={16} className="stroke-[3]" />
              </motion.span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * A build-tray button.
 *
 * Shows a miniature of the block it adds and how many are still needed, so a
 * child can tell the two buttons apart by shape rather than by reading, and can
 * see the job shrinking. Presses physically: lifts on hover, squashes on tap,
 * and the live one breathes so it is obvious where to go next.
 */
const TrayButton: React.FC<{
  label: string;
  remaining: number;
  enabled: boolean;
  onClick: () => void;
  preview: React.ReactNode;
}> = ({ label, remaining, enabled, onClick, preview }) => {
  const reduce = useReducedMotion();
  return (
    <motion.button
      onClick={onClick}
      disabled={!enabled}
      aria-label={enabled ? `Add a ${label}, ${remaining} still needed` : `${label} — none needed`}
      whileHover={enabled && !reduce ? { y: -2 } : undefined}
      whileTap={enabled && !reduce ? { scale: 0.96, y: 0 } : undefined}
      animate={enabled && !reduce ? { boxShadow: ["0 2px 8px -2px rgba(79,70,229,.35)", "0 6px 18px -4px rgba(79,70,229,.55)", "0 2px 8px -2px rgba(79,70,229,.35)"] } : undefined}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      className={`flex-1 min-w-0 rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        enabled
          ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
          : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
      }`}
    >
      <span className="flex items-center shrink-0">{preview}</span>
      <span className="text-xs font-extrabold truncate">{label}</span>
      {enabled && remaining > 0 && (
        <span className="text-[10px] font-black bg-white/25 rounded-full px-1.5 py-0.5 shrink-0">
          {remaining}
        </span>
      )}
    </motion.button>
  );
};

const NumberBuilder: React.FC<{
  target: number;
  targetTens: number;
  targetOnes: number;
  builtTens: number;
  builtOnes: number;
  accentClass: string;
  objectId: string;
  onAddTen: () => void;
  onAddOne: () => void;
  onReset: () => void;
  onConfirm: () => void;
  /** Called once when the build first matches its target. */
  onComplete?: () => void;
}> = ({
  target, targetTens, targetOnes, builtTens, builtOnes,
  accentClass, objectId, onAddTen, onAddOne, onReset, onConfirm, onComplete,
}) => {
  const usesTens = targetTens > 0;
  const isComplete = builtTens === targetTens && builtOnes === targetOnes;
  // Ones stay locked until the rods are down, so place value is built in order.
  const onesUnlocked = builtTens >= targetTens;

  // Size blocks from the rod's *own* column, not the canvas: this grid is one
  // column when narrow and two when wide, so only the column knows how much
  // room a rod really has. Ones share the result, keeping cell = unit exactly.
  const tensRef = useRef<HTMLDivElement>(null);
  const unit = useFittedUnitSize(tensRef, ROD_WIDTH_UNITS);

  // Fire once on the transition into "matched", not on every render while matched.
  const wasComplete = useRef(false);
  useEffect(() => {
    if (isComplete && !wasComplete.current) onComplete?.();
    wasComplete.current = isComplete;
  }, [isComplete, onComplete]);

  return (
    <Base10Scale size={unit}>
    <div className="w-full max-w-xl @3xl:max-w-3xl @5xl:max-w-4xl space-y-3">
      <div className="flex justify-between items-center gap-3 px-1 pb-1">
        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
          Target: <span className={`${accentClass} text-xs font-black`}>{target}</span>
        </div>
        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
          Current: <span className="text-slate-800 dark:text-white text-xs font-black">{builtTens * 10 + builtOnes}</span>
        </div>
        <BadgeSuccess isOk={isComplete} />
      </div>

      {/*
        Stacked while the canvas is narrow so a horizontal ten-rod gets the full
        width to itself — side-by-side columns would halve the space and force
        the unit below its readable size.
      */}
      <div className={`grid gap-3 ${usesTens ? "grid-cols-1 @2xl:grid-cols-2" : "grid-cols-1"}`}>
        {usesTens && (
          <div ref={tensRef} className="border border-dashed border-slate-300/70 dark:border-slate-700/60 rounded-2xl p-3 pt-6 flex flex-col justify-center items-center relative min-h-[5.5rem] overflow-hidden">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider absolute top-2 left-2">Tens (Rods)</span>
            <div className="flex flex-col gap-1.5 items-center">
              {Array.from({ length: builtTens }).map((_, i) => (
                <TenRod key={i} type={objectId} />
              ))}
            </div>
          </div>
        )}

        <div className="border border-dashed border-slate-300/70 dark:border-slate-700/60 rounded-2xl p-3 pt-6 flex flex-col justify-center items-center relative min-h-[5.5rem]">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider absolute top-2 left-2">Ones (Units)</span>
          <div className="flex flex-wrap gap-1.5 justify-center max-w-full">
            {Array.from({ length: builtOnes }).map((_, i) => (
              <OneUnit key={i} type={objectId} />
            ))}
          </div>
        </div>
      </div>

      {/* Build tray — each button previews the block it adds and how many are left */}
      <div className="flex gap-2 w-full items-stretch">
        {usesTens && (
          <TrayButton
            label="Ten Rod"
            remaining={targetTens - builtTens}
            enabled={builtTens < targetTens}
            onClick={onAddTen}
            preview={<span className="flex gap-[2px]">{Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="w-[3px] h-3 rounded-[1px] bg-current opacity-80" />
            ))}</span>}
          />
        )}
        <TrayButton
          label="One Unit"
          remaining={targetOnes - builtOnes}
          enabled={onesUnlocked && builtOnes < targetOnes}
          onClick={onAddOne}
          preview={<span className="w-3 h-3 rounded-[3px] bg-current opacity-80" />}
        />
        <motion.button
          onClick={onReset}
          aria-label="Start this number again"
          whileTap={{ scale: 0.92, rotate: -30 }}
          className="w-12 shrink-0 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <RotateCcw size={15} />
        </motion.button>
      </div>

      <ConfirmButton ready={isComplete} onClick={onConfirm}>
        Confirm Number {target}
      </ConfirmButton>
    </div>
    </Base10Scale>
  );
};

const BadgeSuccess: React.FC<{ isOk: boolean }> = ({ isOk }) => {
  return isOk ? (
    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full font-black border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-1.5 shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
      Matched ✓
    </span>
  ) : (
    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full font-black border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1.5 shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
      Building...
    </span>
  );
};
