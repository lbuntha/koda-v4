import React, { forwardRef, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Edit3, Sparkles } from "lucide-react";
import { SpeechReadAloudButton } from "../../pedagogy";
import { useCanvasAudience } from "./presentation";
import { CanvasAccent, accentIconClass } from "./canvasTheme";

/** How long a hint stays on screen before fading out. */
const HINT_VISIBLE_MS = 3000;

/**
 * Flatten a ReactNode to its text, giving a hint a stable identity.
 *
 * Canvases pass JSX for `footerStatus`, and JSX is a fresh object every render —
 * keying the timer on the node itself would restart it constantly and the hint
 * would never fade. Keying on the words means the timer restarts only when the
 * instruction genuinely changes.
 */
function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (React.isValidElement(node)) return nodeText((node.props as { children?: React.ReactNode }).children);
  return "";
}

/**
 * The "what to do next" line, shown briefly then faded away.
 *
 * A hint that sits there permanently stops being read — it becomes furniture.
 * Showing it for a few seconds when it changes keeps it meaningful and leaves
 * the canvas clear for the activity itself. A solved message is the one
 * exception and stays put: that is a reward, not an instruction.
 */
const AutoHint: React.FC<{
  content: React.ReactNode;
  solved: boolean;
  isDark: boolean;
  durationMs: number;
}> = ({ content, solved, isDark, durationMs }) => {
  const reduce = useReducedMotion();
  const text = nodeText(content);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    if (solved || durationMs <= 0) return;      // rewards persist
    const timer = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timer);
  }, [text, solved, durationMs]);

  const tone = solved
    ? isDark ? "text-emerald-400 font-extrabold drop-shadow-sm" : "text-emerald-700 font-extrabold"
    : isDark ? "text-slate-300 font-bold" : "text-slate-700 font-bold";

  return (
    // Fixed height so the canvas never reflows as the hint comes and goes.
    <div className="relative z-20 flex-shrink-0 h-6 flex items-center justify-center px-1 pb-1">
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key="hint"
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className={`flex items-center justify-center gap-1.5 text-center text-[11px] sm:text-xs font-bold font-mono tracking-tight ${tone}`}
          >
            {solved && <Sparkles size={12} className="animate-spin flex-shrink-0" />}
            <span>{content}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export interface SharedCanvasLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the canvas is in Play Mode (true) or Designer Mode (false) */
  isPlayMode: boolean;
  /** Whether to show the structural layout grid */
  showGrid?: boolean;
  /** Whether dark mode is active */
  isDark?: boolean;
  /** Condenses the chrome for embedded card previews. */
  compact?: boolean;
  /** Minor grid cell size in pixels */
  gridSize?: number;
  /** Number of minor cells between stronger guide lines */
  majorGridEvery?: number;
  /** Whether to show ruler labels along the top and left canvas edges */
  showRulers?: boolean;
  /** Whether to show center alignment lines */
  showCenterGuides?: boolean;
  /** Accent family for this activity — tints the header icon, chips and status line */
  accent?: CanvasAccent;
  /** Icon shown in the top header banner */
  headerIcon?: React.ReactNode;
  /**
   * Name of the ACTIVITY (e.g. "Subtraction Sandbox") — never the slide title.
   * The slide title (`question.title`) belongs to the launcher navbar; repeating
   * it here duplicates it on screen.
   */
  headerTitle?: React.ReactNode;
  /** Optional subtitle or instructions right below header title */
  headerSubtitle?: React.ReactNode;
  /** Text for the text-to-speech read-aloud button in the header */
  readAloudText?: string;
  /** Custom action buttons or controls rendered in the top-right of the header */
  headerActions?: React.ReactNode;
  /** Standard status line under the canvas — the single place for "what to do next" */
  footerStatus?: React.ReactNode;
  /** Renders the status line in the success style (emerald + sparkle) */
  footerSolved?: boolean;
  /** Hint text shown in the floating Designer Mode pill */
  designerHint?: string;
  /**
   * How long the footer hint stays visible before fading, in ms.
   * `0` keeps it on screen permanently.
   */
  hintDurationMs?: number;
  /**
   * The task hint for a student — normally `question.instruction`.
   * Shown in play mode when there is no `footerStatus`, so a child gets the
   * "what am I doing" line that until now only teachers saw in Design Mode.
   */
  playHint?: React.ReactNode;
  /** Main canvas interactive content */
  children: React.ReactNode;
  /** Optional custom class name for the outer container */
  className?: string;
}

export const SharedCanvasLayout = forwardRef<HTMLDivElement, SharedCanvasLayoutProps>(({
  isPlayMode,
  showGrid = false,
  isDark = false,
  compact = false,
  gridSize = 20,
  majorGridEvery = 5,
  showRulers = false,
  showCenterGuides = true,
  accent = "indigo",
  headerIcon,
  headerTitle,
  headerSubtitle,
  readAloudText,
  headerActions,
  footerStatus,
  footerSolved = false,
  designerHint = "Drag & arrange objects freely across the canvas layout!",
  hintDurationMs = HINT_VISIBLE_MS,
  playHint,
  children,
  className = "",
  ...restProps
}, ref) => {
  const { learnerMode } = useCanvasAudience();
  const safeGridSize = Math.max(8, Math.min(80, Math.round(gridSize)));
  const majorGridSize = safeGridSize * Math.max(2, majorGridEvery);
  const rulerMarks = Array.from({ length: 12 }).map((_, idx) => idx * majorGridSize);

  return (
    <div
      ref={ref}
      className={`relative w-full h-full min-h-[350px] sm:min-h-[410px] md:min-h-[460px] rounded-3xl transition-colors duration-300 overflow-hidden select-none touch-none flex flex-col justify-between bg-transparent border-0 shadow-none text-slate-800 dark:text-slate-100 ${
        compact ? "gap-1 p-0" : "gap-3 p-1"
      } ${className}`}
      {...restProps}
    >
      {/* ── Precision Structural Layout Grid Overlay ── */}
      {(showGrid || !isPlayMode) && (
        <div className="absolute inset-0 pointer-events-none z-0 opacity-20 transition-opacity duration-300">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="shared-canvas-small-grid" width={safeGridSize} height={safeGridSize} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${safeGridSize} 0 L 0 0 0 ${safeGridSize}`}
                  fill="none"
                  stroke={isDark ? "#64748b" : "#94a3b8"}
                  strokeWidth="0.5"
                />
              </pattern>
              <pattern id="shared-canvas-large-grid" width={majorGridSize} height={majorGridSize} patternUnits="userSpaceOnUse">
                <rect width={majorGridSize} height={majorGridSize} fill="url(#shared-canvas-small-grid)" />
                <path
                  d={`M ${majorGridSize} 0 L 0 0 0 ${majorGridSize}`}
                  fill="none"
                  stroke={isDark ? "#818cf8" : "#6366f1"}
                  strokeWidth="1.2"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#shared-canvas-large-grid)" />
            {/* Center crosshair for alignment */}
            {showCenterGuides && (
              <>
                <line
                  x1="50%"
                  y1="0"
                  x2="50%"
                  y2="100%"
                  stroke={isDark ? "#a5b4fc" : "#4f46e5"}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.7"
                />
                <line
                  x1="0"
                  y1="50%"
                  x2="100%"
                  y2="50%"
                  stroke={isDark ? "#a5b4fc" : "#4f46e5"}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.7"
                />
              </>
            )}
          </svg>
        </div>
      )}

      {!isPlayMode && showRulers && (
        <div className="absolute inset-0 pointer-events-none z-10 text-[9px] font-mono font-bold">
          <div className={`absolute left-0 right-0 top-0 h-5 border-b ${
            isDark ? "bg-slate-950/70 border-slate-700 text-slate-400" : "bg-white/75 border-slate-200 text-slate-500"
          }`}>
            {rulerMarks.map(mark => (
              <span key={`x-${mark}`} className="absolute top-1 -translate-x-1/2" style={{ left: `${mark}px` }}>
                {mark}
              </span>
            ))}
          </div>
          <div className={`absolute bottom-0 left-0 top-0 w-7 border-r ${
            isDark ? "bg-slate-950/70 border-slate-700 text-slate-400" : "bg-white/75 border-slate-200 text-slate-500"
          }`}>
            {rulerMarks.map(mark => (
              <span key={`y-${mark}`} className="absolute left-1 -translate-y-1/2" style={{ top: `${mark}px` }}>
                {mark}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Top Header Bar ── */}
      {(headerTitle || headerActions || readAloudText) && (
        <div className={`relative z-20 flex flex-wrap justify-between border-b transition-all ${
          compact ? "flex-col items-stretch gap-1 pb-1 px-0.5" : "items-center gap-2.5 pb-2 px-1"
        } ${
          isDark ? "text-slate-100 border-white/[0.07]" : "text-slate-800 border-black/[0.06]"
        }`}>
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            {headerIcon && (
              <div className={`p-1.5 rounded-xl flex-shrink-0 ${accentIconClass(accent as CanvasAccent, isDark)}`}>
                {headerIcon}
              </div>
            )}
            {/*
              Hierarchy: the activity name is the eyebrow, the live state
              ("8 − 3 = 5", "4 of 8 counted") is the prominent line — the slide
              title already sits in the launcher navbar. When a canvas has no
              live state, its name takes the prominent line instead.
            */}
            <div className="min-w-0 flex-1">
              {/* The technique name ("Subitize", "Group in tens") is authoring vocabulary.
                  An adult uses it to find the right component; a six-year-old cannot read it
                  and it is set above the one line that actually tells them what to do. For a
                  learner it is dropped, and the instruction becomes the heading. */}
              {headerTitle && !(learnerMode && headerSubtitle) && (
                <div className={
                  headerSubtitle
                    ? `text-[9px] font-mono font-bold uppercase tracking-[0.18em] truncate leading-none ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`
                    : "text-sm sm:text-base font-extrabold tracking-tight truncate leading-tight"
                }>
                  {headerTitle}
                </div>
              )}
              {headerSubtitle && (
                <div className={`font-extrabold tracking-tight truncate leading-tight ${
                  learnerMode
                    ? "text-base sm:text-lg md:text-xl"
                    : "text-sm sm:text-base mt-1"
                }`}>
                  {headerSubtitle}
                </div>
              )}
            </div>
          </div>

          {/*
            `flex-shrink-0` used to be here, and it made a toolbar that cannot fit simply
            not fit: on a narrow card the controls held this row at their full width, the
            row held the canvas wider than its container, and `overflow-hidden` on the root
            cut the last buttons off — Reset and Shuffle were unreachable on a phone rather
            than merely cramped. Letting the row shrink lets its controls wrap onto a
            second line instead, which is what `flex-wrap` was always for.
          */}
          <div className={`flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2 ${
            compact ? "w-full justify-center" : "justify-end"
          }`}>
            {readAloudText && <SpeechReadAloudButton text={readAloudText} />}
            {headerActions}
          </div>
        </div>
      )}

      {/* ── Designer Mode Pill Indicator ── */}
      {!isPlayMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-pulse max-w-[90%] sm:max-w-md text-center">
          <div className={`border text-[10px] sm:text-xs font-extrabold px-3.5 py-1 rounded-full shadow-md flex items-center justify-center gap-1.5 ${
            isDark
              ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-300"
              : "bg-emerald-50 border-emerald-300 text-emerald-800"
          }`}>
            <Edit3 size={12} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="truncate">Designer Mode: {designerHint}</span>
          </div>
        </div>
      )}

      {/* ── Main Canvas Interactive Area ── */}
      <div className={`relative z-10 flex-1 flex flex-col w-full min-h-0 ${compact ? "mt-0" : "mt-2"}`}>
        {children}
      </div>

      {/* ── Standard Status Line ── */}
      {(footerStatus ?? (isPlayMode ? playHint : undefined)) && (
        <AutoHint
          content={footerStatus ?? playHint}
          solved={footerSolved}
          isDark={isDark}
          durationMs={hintDurationMs}
        />
      )}
    </div>
  );
});

SharedCanvasLayout.displayName = "SharedCanvasLayout";
