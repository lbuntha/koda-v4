/**
 * Koda Actor — the shared guide character.
 *
 * Any canvas that wants to talk a child through a task renders this instead of
 * building its own speech bubble. It owns the mascot, the bubble, the voice
 * controls and the read-along animation, so guidance behaves identically
 * everywhere and a canvas only has to say *what* Koda should say.
 *
 *   const voice = useKodaVoice("koda_tutor_muted");
 *   <KodaActor text={`Tap **+ Ten Rod** to add **2** rods.`} mood="think" voice={voice} />
 *
 * The `voice` object is passed in rather than created internally because the
 * host canvas usually needs `voice.muted` to gate its own sound effects too.
 *
 * Self-contained by design: it applies its own `dark` class from `isDark`, so
 * it themes correctly in any canvas regardless of what ancestors do.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, TargetAndTransition } from "motion/react";
import { Volume2, VolumeX, RotateCcw, Move } from "lucide-react";
import { KodaVoice, toSpeech } from "./kodaVoice";
import { tokenize, sentenceShape } from "./kodaText";

export type { KodaVoice } from "./kodaVoice";
export { useKodaVoice, toSpeech } from "./kodaVoice";

/** Drives the mascot's body language. */
export type KodaMood = "idle" | "talking" | "cheer" | "oops" | "think";

/**
 * How lively Koda is allowed to be.
 *  - "full" — mascot idles and reacts, words reveal as they are read
 *  - "calm" — no looping motion; words still reveal (good for busy classrooms)
 *  - "none" — everything static
 * An OS "reduce motion" preference always forces "none". Dragging the bubble
 * is never affected — that is a placement affordance, not decoration.
 */
export type KodaAnimation = "full" | "calm" | "none";

/* ────────────────────────────────────────────────────────────────────────────
 * Motion configuration — every timing Koda uses lives here, so the character's
 * feel can be tuned in one place instead of hunting through JSX.
 * ──────────────────────────────────────────────────────────────────────────── */

const MOTION = {
  /** Read-along reveal. */
  reveal: { perWord: 0.045, duration: 0.2, rise: 4 },
  /** Bubble entrance. */
  enter: { duration: 0.28, rise: 6 },
  /** Speaking-indicator bars. */
  bars: { duration: 0.6, stagger: 0.15, min: 3, max: 8 },
  /** Mood glow pulse. */
  glow: { duration: 1.8, from: 0.5, to: 0.9, still: 0.7 },
} as const;

/** Looping body language per mood. Only applied at the "full" animation level. */
const MASCOT_LOOP: Record<KodaMood, TargetAndTransition> = {
  idle: {
    y: [0, -3, 0],
    transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
  },
  talking: {
    y: [0, -5, 0],
    scaleY: [1, 0.94, 1],
    transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
  },
  cheer: {
    y: [0, -10, 0],
    rotate: [0, -12, 12, 0],
    transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
  },
  oops: {
    x: [0, -4, 4, -3, 3, 0],
    transition: { duration: 0.5, repeat: 2, ease: "easeInOut" },
  },
  think: {
    rotate: [0, -8, 0],
    transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
  },
};

/**
 * Mood reads as a soft glow behind the mascot rather than a bordered tile —
 * colour without adding another hard edge to the bubble.
 */
const MOOD_GLOW: Record<KodaMood, string | null> = {
  idle: null,
  talking: "bg-indigo-400/40",
  cheer: "bg-amber-400/50",
  oops: "bg-rose-400/45",
  think: "bg-violet-400/40",
};

const MOOD_BADGE: Record<KodaMood, string | null> = {
  idle: null,
  talking: null,
  cheer: "🎉",
  oops: "💭",
  think: "💡",
};

/**
 * Width of the element Koda lives in.
 *
 * Deliberately *not* `window.innerWidth`: a canvas is usually a panel inside
 * the Studio (~530px) on a 1440px monitor, so viewport breakpoints pick the
 * wrong layout. Measuring the actual container makes the bubble respond to the
 * space it really has, in the Studio and full-screen alike.
 */
function useContainerWidth(ref?: React.RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref?.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width;
      if (typeof next === "number") setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

/** Below this the bubble flows inline instead of floating.
 *  Matches Tailwind's `@xl` container breakpoint (36rem), so a canvas that
 *  reserves top space for a floating bubble is exactly the canvas that gets one. */
const COMPACT_WIDTH = 576;

/** True when the OS asks for reduced motion — we then hold everything still. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────────── */

export interface KodaActorProps {
  /** What Koda says. `**double asterisks**` mark the words a child must act on. */
  text: string;
  /** Override the spoken form. Defaults to `text` with the markers removed. */
  speechText?: string;
  mood?: KodaMood;
  voice: KodaVoice;
  isDark?: boolean;
  /**
   * "auto" (default) floats a draggable bubble when the canvas is wide enough
   * and flows inline when it is not — measured from `dragConstraints`.
   * "floating" / "inline" force one layout.
   */
  variant?: "auto" | "floating" | "inline";
  /**
   * The canvas element. Bounds the drag *and* is measured for responsive
   * layout, so pass it whenever the actor sits inside a resizable panel.
   */
  dragConstraints?: React.RefObject<HTMLElement | null>;
  /** Read new instructions aloud automatically. Default true. */
  autoSpeak?: boolean;
  /** Liveliness. Default "full"; OS reduce-motion always wins. */
  animation?: KodaAnimation;
  className?: string;
}

/** Icon buttons are borderless — background only appears on hover. */
const ghostButton =
  "w-7 h-7 rounded-lg flex items-center justify-center transition-colors " +
  "text-slate-400 hover:text-slate-600 hover:bg-slate-100 " +
  "dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

export const KodaActor: React.FC<KodaActorProps> = ({
  text,
  speechText,
  mood = "idle",
  voice,
  isDark = false,
  variant = "auto",
  dragConstraints,
  autoSpeak = true,
  animation = "full",
  className = "",
}) => {
  const containerWidth = useContainerWidth(dragConstraints);
  // Until the container is measured, assume roomy so the bubble does not
  // visibly jump from inline to floating on first paint.
  const roomy = containerWidth === null || containerWidth >= COMPACT_WIDTH;
  const floating = variant === "auto" ? roomy : variant === "floating";

  const reduceMotion = usePrefersReducedMotion();
  // One resolved level drives every animation decision below.
  const level: KodaAnimation = reduceMotion ? "none" : animation;
  const loops = level === "full";
  const reveals = level !== "none";

  const shape = sentenceShape(text);
  const spoken = speechText ?? toSpeech(text);

  // Bumping this replays the read-along reveal without changing the text.
  const [replayNonce, setReplayNonce] = useState(0);
  const lastShapeRef = useRef<string>("");

  // Keep the latest spoken string reachable from the effect below without
  // making it a dependency — the effect must fire on new *instructions*, not
  // on every wording tweak. Declared first so it is current when that runs.
  const spokenRef = useRef(spoken);
  useEffect(() => {
    spokenRef.current = spoken;
  });

  // Speak once per genuinely-new instruction, not on every re-render. While
  // muted the ref is left untouched, so unmuting reads the current step aloud.
  useEffect(() => {
    if (!autoSpeak || voice.muted) return;
    if (lastShapeRef.current === shape) return;
    lastShapeRef.current = shape;
    voice.speak(spokenRef.current);
  }, [shape, autoSpeak, voice.muted, voice.speak]);

  const replay = () => {
    setReplayNonce(n => n + 1);
    voice.speak(spoken);
  };

  const tokens = tokenize(text);
  const speaking = voice.isSpeaking;
  const activeMood: KodaMood = speaking && mood === "idle" ? "talking" : mood;
  const badge = MOOD_BADGE[activeMood];
  const glow = MOOD_GLOW[activeMood];

  // Outer element owns placement and dragging; it must never carry an `animate`
  // transform, or re-renders (which happen on every tap) would yank a bubble
  // the child has dragged back to its origin.
  const placement = floating
    ? "absolute top-3 left-3 z-50 max-w-sm w-[min(20rem,calc(100%-1.5rem))] cursor-grab active:cursor-grabbing"
    : // Inline: full width, in flow. Never draggable — on a narrow/touch canvas
      // a draggable bubble swallows the touch gestures used to scroll.
      "relative w-full mb-3";

  // A single soft elevation instead of a border: the bubble floats above the
  // canvas rather than being another framed box on it. Dark mode swaps to a
  // hairline because shadows do not separate on dark backgrounds.
  const surface =
    "w-full px-3.5 py-3 rounded-2xl flex items-start gap-3 " +
    "bg-white text-slate-800 shadow-[0_6px_24px_-8px_rgba(15,23,42,0.25)] " +
    "dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-none " +
    "border border-transparent dark:border-slate-700/70";

  // Reveal delay counts words only, so whitespace does not skew the rhythm.
  let wordIndex = 0;

  return (
    <motion.div
      // Remount on a coarse width change. `dragConstraints` measures the canvas
      // once on mount, so when the canvas resizes — Studio to full screen, or a
      // container-query reflow — those cached bounds go stale and motion drags
      // the bubble to "correct" it, stranding it far from top-left. Remounting
      // in ~120px buckets re-measures and clears any leftover drag transform,
      // without thrashing on every pixel of a resize.
      key={containerWidth === null ? "unmeasured" : Math.round(containerWidth / 120)}
      drag={floating}
      dragConstraints={dragConstraints}
      dragMomentum={false}
      dragElastic={0.12}
      className={`${isDark ? "dark " : ""}${placement} ${className}`}
    >
      <motion.div
        initial={reveals ? { opacity: 0, y: -MOTION.enter.rise } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: MOTION.enter.duration }}
        className={surface}
      >
        {/* ── Mascot ── */}
        {/*
          Tapping Koda replays the line — a nice affordance for small hands, but
          it duplicates the explicit replay button, so it stays out of the tab
          order and the accessibility tree rather than announcing twice.
        */}
        <button
          type="button"
          onClick={replay}
          aria-hidden="true"
          tabIndex={-1}
          className="relative flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full"
        >
          {glow && (
            <motion.span
              className={`absolute inset-1 rounded-full blur-lg ${glow}`}
              animate={loops ? { opacity: [MOTION.glow.from, MOTION.glow.to, MOTION.glow.from] } : { opacity: MOTION.glow.still }}
              transition={loops ? { duration: MOTION.glow.duration, repeat: Infinity, ease: "easeInOut" } : undefined}
            />
          )}

          <motion.span
            className="relative text-3xl leading-none select-none"
            animate={loops ? MASCOT_LOOP[activeMood] : undefined}
          >
            👾
          </motion.span>

          {badge && (
            <motion.span
              initial={reveals ? { scale: 0 } : false}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 text-sm select-none pointer-events-none"
            >
              {badge}
            </motion.span>
          )}

          {/* Bare bars, no pill — links the voice to the character */}
          {speaking && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-[2px] h-2">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="w-[2px] bg-indigo-500 rounded-full"
                  animate={loops ? { height: [MOTION.bars.min, MOTION.bars.max, MOTION.bars.min] } : { height: MOTION.bars.min }}
                  transition={loops ? { duration: MOTION.bars.duration, repeat: Infinity, delay: i * MOTION.bars.stagger } : undefined}
                />
              ))}
            </span>
          )}
        </button>

        {/* ── Speech ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-650 dark:text-indigo-400">
              Koda says
            </span>

            <div className="flex items-center gap-0.5">
              <button type="button" onClick={replay} aria-label="Hear that again" className={ghostButton}>
                <RotateCcw size={12} />
              </button>
              <button
                type="button"
                onClick={voice.toggleMute}
                aria-label={voice.muted ? "Turn Koda's voice on" : "Turn Koda's voice off"}
                aria-pressed={voice.muted}
                className={`${ghostButton} ${voice.muted ? "text-rose-500 dark:text-rose-400" : ""}`}
              >
                {voice.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              {floating && (
                <span className="text-slate-300 dark:text-slate-600 pl-0.5" title="Drag me">
                  <Move size={11} />
                </span>
              )}
            </div>
          </div>

          {/*
            One stable live region carries the whole sentence to screen readers.
            It is never re-keyed, so announcements are not dropped or doubled by
            a remount, and readers get clean prose rather than ~15 split spans.
          */}
          <span className="sr-only" role="status" aria-live="polite">
            {spoken}
          </span>

          {/*
            Read-along: words arrive left-to-right so an emergent reader's eye
            tracks with the voice. `key` restarts it only on a new instruction.
            Hidden from assistive tech in favour of the live region above.
          */}
          <p
            key={`${shape}-${replayNonce}`}
            aria-hidden="true"
            className="text-[13px] font-semibold leading-relaxed text-slate-700 dark:text-slate-200"
          >
            {tokens.map((token, i) => {
              if (token.isSpace) return <span key={i}> </span>;
              const delay = reveals ? wordIndex++ * MOTION.reveal.perWord : 0;

              return (
                <motion.span
                  key={i}
                  initial={reveals ? { opacity: 0, y: MOTION.reveal.rise } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay, duration: MOTION.reveal.duration }}
                  className={
                    token.strong
                      ? "inline-flex items-center px-1.5 py-0.5 mx-px rounded-md bg-indigo-100/80 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-extrabold whitespace-nowrap"
                      : "inline-block"
                  }
                >
                  {token.text}
                </motion.span>
              );
            })}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
