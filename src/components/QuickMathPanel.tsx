import React, { useState, useEffect } from "react";
import { Zap, Sparkles, CheckCircle2, XCircle, Flame, Timer, RefreshCw, HelpCircle, ArrowRight, Award } from "lucide-react";
import { playSound } from "../utils/audio";
import { ChatMessage, TopicCategory } from "../types";

interface QuickMathProblem {
  id: string;
  category: TopicCategory | "mixed";
  question: string;
  answer: string | number;
  acceptableAnswers: string[];
  visualClue?: string;
  hint: string;
  explanation: string;
}

const QUICK_MATH_BANK: QuickMathProblem[] = [
  {
    id: "qm_1",
    category: "balance_equations",
    question: "Solve for x:   2x + 5 = 17",
    answer: "6",
    acceptableAnswers: ["6", "x=6", "x = 6"],
    visualClue: "[ 📦x ] [ 📦x ] + 5kg  ===⚖️===  17kg",
    hint: "If you remove 5kg from both sides of the balance scale, you get 2x = 12. What is 12 ÷ 2?",
    explanation: "Subtract 5 from both sides: 2x = 12. Divide both sides by 2: x = 6."
  },
  {
    id: "qm_2",
    category: "balance_equations",
    question: "Solve for x:   3x - 4 = 11",
    answer: "5",
    acceptableAnswers: ["5", "x=5", "x = 5"],
    visualClue: "[ 📦x ] [ 📦x ] [ 📦x ] - 4  ===⚖️===  11",
    hint: "To undo subtracting 4, add 4 to both sides! What is 11 + 4?",
    explanation: "Add 4 to both sides: 3x = 15. Divide both sides by 3: x = 5."
  },
  {
    id: "qm_3",
    category: "fraction_lab",
    question: "Simplify the fraction to lowest terms:   8 / 12",
    answer: "2/3",
    acceptableAnswers: ["2/3", "2 / 3"],
    visualClue: "[ 🥧 8 out of 12 slices ]",
    hint: "What is the largest number that divides both 8 and 12 evenly? Try dividing top and bottom by 4!",
    explanation: "8 ÷ 4 = 2, and 12 ÷ 4 = 3. So 8/12 simplifies to 2/3."
  },
  {
    id: "qm_4",
    category: "fraction_lab",
    question: "What is   1/4 + 2/4 ?",
    answer: "3/4",
    acceptableAnswers: ["3/4", "3 / 4"],
    visualClue: "[ 🥧 1 slice ] + [ 🥧 2 slices ] of 4 equal slices",
    hint: "When denominators are identical (4), simply add the top numerators together: 1 + 2.",
    explanation: "1/4 + 2/4 = 3/4."
  },
  {
    id: "qm_5",
    category: "exponent_growth",
    question: "Evaluate:   2⁵",
    answer: "32",
    acceptableAnswers: ["32"],
    visualClue: "2 × 2 × 2 × 2 × 2",
    hint: "Multiply 2 by itself 5 times: (2×2=4) ➔ (4×2=8) ➔ (8×2=16) ➔ (16×2=?)",
    explanation: "2⁵ = 2 × 2 × 2 × 2 × 2 = 32."
  },
  {
    id: "qm_6",
    category: "exponent_growth",
    question: "A cell doubles every minute. If you start with 3 cells, how many cells are there after 3 minutes?",
    answer: "24",
    acceptableAnswers: ["24", "24 cells"],
    visualClue: "Min 0: 3 ➔ Min 1: 6 ➔ Min 2: 12 ➔ Min 3: ?",
    hint: "Double 3 at step 1 (6), double 6 at step 2 (12), double 12 at step 3...",
    explanation: "3 × 2³ = 3 × 8 = 24 cells."
  },
  {
    id: "qm_7",
    category: "spatial_puzzles",
    question: "A garden rectangle is 6 meters long and 4 meters wide. What is its Area in square meters?",
    answer: "24",
    acceptableAnswers: ["24", "24 sq m", "24m2", "24 m²"],
    visualClue: "┌──────────┐ 4m\n└──────────┘\n    6m",
    hint: "Area of a rectangle = Width × Height. What is 6 × 4?",
    explanation: "Area = 6m × 4m = 24 sq meters."
  },
  {
    id: "qm_8",
    category: "spatial_puzzles",
    question: "A square field has an area of 49 square units. What is the length of one side?",
    answer: "7",
    acceptableAnswers: ["7", "7 units", "7m"],
    visualClue: "Side × Side = 49",
    hint: "What number multiplied by itself equals 49? (x² = 49)",
    explanation: "7 × 7 = 49, so each side length is 7."
  },
  {
    id: "qm_9",
    category: "coordinate_quest",
    question: "Start at point (2, 3). Move 4 units right and 3 units up. What are your new coordinates (x, y)?",
    answer: "(6, 6)",
    acceptableAnswers: ["(6, 6)", "(6,6)", "6, 6", "6,6"],
    visualClue: "(2 + 4,  3 + 3)",
    hint: "Add 4 to the X-coordinate (2 + 4), and add 3 to the Y-coordinate (3 + 3).",
    explanation: "X: 2 + 4 = 6; Y: 3 + 3 = 6. The new coordinate is (6, 6)."
  },
  {
    id: "qm_10",
    category: "logic_matrix",
    question: "Is the statement   (TRUE AND FALSE) OR TRUE   True or False?",
    answer: "true",
    acceptableAnswers: ["true", "True", "TRUE", "t"],
    visualClue: "[ (TRUE AND FALSE) ]  OR  [ TRUE ]",
    hint: "First evaluate (TRUE AND FALSE), which equals FALSE. Now evaluate FALSE OR TRUE.",
    explanation: "(TRUE AND FALSE) is FALSE. Then FALSE OR TRUE is TRUE."
  }
];

interface QuickMathPanelProps {
  onSolveSuccess: (xp: number) => void;
  onSendToSora: (userMessage: string) => void;
  voiceEnabled: boolean;
}

export const QuickMathPanel: React.FC<QuickMathPanelProps> = ({
  onSolveSuccess,
  onSendToSora,
  voiceEnabled,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "correct" | "incorrect">("idle");
  const [soraFeedbackText, setSoraFeedbackText] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [showHint, setShowHint] = useState(false);

  // Timer effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerActive) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

  const activePool = QUICK_MATH_BANK.filter((p) =>
    selectedCategory === "all" ? true : p.category === selectedCategory
  );

  const currentProblem = activePool[currentIndex % activePool.length] || QUICK_MATH_BANK[0];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userAnswer.trim()) return;

    const formattedUser = userAnswer.trim().toLowerCase();
    const isRight = currentProblem.acceptableAnswers.some(
      (ans) => ans.trim().toLowerCase() === formattedUser
    );

    if (isRight) {
      setFeedbackState("correct");
      playSound("levelup");
      const xp = 30 + Math.min(streak * 5, 20);
      setStreak((prev) => prev + 1);
      setSoraFeedbackText(`✨ Excellent speed math reasoning! ${currentProblem.explanation}`);
      onSolveSuccess(xp);
      onSendToSora(`I solved the quick math problem "${currentProblem.question}" with answer: ${userAnswer}!`);
    } else {
      setFeedbackState("incorrect");
      playSound("pop");
      setStreak(0);
      setSoraFeedbackText(
        `Not quite. Koda's Hint: ${currentProblem.hint} Give it another try!`
      );
    }
  };

  const handleNextProblem = () => {
    playSound("pop");
    setUserAnswer("");
    setFeedbackState("idle");
    setSoraFeedbackText(null);
    setShowHint(false);
    setCurrentIndex((prev) => prev + 1);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col w-full bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden font-sans">
      {/* Glow Aura */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Mode Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-white/10 gap-3 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/40">
              <Zap className="w-4 h-4" />
            </span>
            <span className="text-amber-400 font-mono uppercase tracking-[0.25em] text-[10px] font-bold">
              RAPID REINFORCEMENT MODE
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            Quick <span className="text-amber-400">Math</span> Drills
          </h3>
        </div>

        {/* Live Scoreboard / Timer Stats */}
        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 px-3 py-1.5 rounded-xl">
            <Flame className="w-4 h-4 text-orange-400 animate-bounce" />
            <span className="text-xs font-bold text-orange-300">
              {streak} Hot Streak
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 rounded-xl text-cyan-300">
            <Timer className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold">{formatTime(timerSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 py-4 overflow-x-auto no-scrollbar font-mono text-xs relative z-10">
        {[
          { id: "all", label: "⚡ All Mixed" },
          { id: "balance_equations", label: "⚖️ Algebra" },
          { id: "fraction_lab", label: "🥧 Fractions" },
          { id: "exponent_growth", label: "📈 Exponents" },
          { id: "spatial_puzzles", label: "📐 Geometry" },
          { id: "coordinate_quest", label: "🗺️ Coordinates" },
          { id: "logic_matrix", label: "💻 Logic" },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              playSound("pop");
              setSelectedCategory(cat.id);
              setCurrentIndex(0);
              setUserAnswer("");
              setFeedbackState("idle");
              setSoraFeedbackText(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              selectedCategory === cat.id
                ? "bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                : "bg-white/5 text-gray-400 hover:text-white border border-white/5"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Problem Display Card */}
      <div className="bg-black/60 border border-white/10 rounded-2xl p-6 my-2 relative z-10 flex flex-col justify-between min-h-[220px]">
        <div>
          <div className="flex items-center justify-between mb-3 font-mono">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded border border-cyan-400/30">
              {currentProblem.category.replace("_", " ")}
            </span>
            <span className="text-xs text-gray-400">
              Question {(currentIndex % activePool.length) + 1} of {activePool.length}
            </span>
          </div>

          <h4 className="text-lg sm:text-2xl font-bold text-white tracking-tight mb-3">
            {currentProblem.question}
          </h4>

          {/* Visual Clue Box */}
          {currentProblem.visualClue && (
            <div className="bg-[#050505] border border-white/10 rounded-xl p-3 font-mono text-xs text-cyan-300 w-fit mb-4">
              <span className="text-[10px] text-gray-500 uppercase block mb-1">Visual Clue Model:</span>
              {currentProblem.visualClue}
            </div>
          )}
        </div>

        {/* Answer Input & Actions */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={feedbackState === "correct"}
            placeholder="Type your mental math answer..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/60 font-mono transition-all disabled:opacity-50"
          />

          <div className="flex items-center gap-2">
            {feedbackState !== "correct" ? (
              <button
                type="submit"
                disabled={!userAnswer.trim()}
                className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold font-mono text-xs uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.4)] disabled:opacity-40 transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <Zap className="w-4 h-4 fill-black" />
                Submit Answer
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextProblem}
                className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-bold font-mono text-xs uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all flex items-center justify-center gap-2 shrink-0"
              >
                Next Problem <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className="p-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all shrink-0"
              title="Request Koda Hint"
            >
              <HelpCircle className="w-5 h-5 text-amber-400" />
            </button>
          </div>
        </form>

        {/* Socratic Hint Box */}
        {showHint && (
          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 font-sans animate-fadeIn">
            <span className="font-mono font-bold uppercase tracking-wider text-amber-400 block mb-1">
              💡 Koda's Socratic Mental Hint:
            </span>
            {currentProblem.hint}
          </div>
        )}

        {/* Feedback Message */}
        {soraFeedbackText && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs sm:text-sm font-sans leading-relaxed animate-fadeIn ${
              feedbackState === "correct"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                : "bg-red-500/10 border-red-500/30 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider mb-1">
              {feedbackState === "correct" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Correct! +30 XP</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400">Keep Reasoning!</span>
                </>
              )}
            </div>
            {soraFeedbackText}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-gray-500 pt-2 px-1">
        <span>Socratic Speed Engine Active</span>
        <span>Solve rapid problems to double daily XP momentum</span>
      </div>
    </div>
  );
};
