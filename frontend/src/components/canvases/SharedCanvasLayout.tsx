import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "motion/react";
import { Edit3, Sparkles } from "lucide-react";
import { SpeechReadAloudButton } from "../../pedagogy";
import { KodaMascot, useActor, type ActorRole } from "../../features/koda-mascot";
import type { GuideCast } from "../../features/koda-mascot";
import { SpeechBubble } from "../ui";
import { tokenize } from "./kodaText";
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

/**
 * The jump, as four poses.
 *
 * A character who slides into place has been *moved*; a character who jumps has
 * *decided to arrive*, and the difference is entirely squash and stretch. Koda
 * enters already airborne and stretched thin along the direction of travel,
 * overshoots the resting spot, lands wide and flat under their own weight, then
 * settles. Leaving runs the same physics backwards: a crouch first — the
 * anticipation, without which a launch reads as a glitch — and then gone off the
 * top, stretched again.
 *
 * `times` is what keeps it a jump rather than a wobble: most of the duration is
 * the flight, and the landing squash is quick, because that is how weight
 * behaves. Every transform is anchored at the feet (`transformOrigin`), so a
 * squashing Koda flattens onto the ground instead of shrinking towards their own
 * middle.
 */
const JUMP_IN_TIMES = [0, 0.42, 0.72, 1];
const JUMP_OUT_TIMES = [0, 0.3, 1];

const jumpVariants: Variants = {
  hidden: { opacity: 0, y: 74, scaleX: 0.8, scaleY: 1.24 },
  visible: {
    opacity: 1,
    /*
      The landing frame stays at y: 0 and does the compressing with `scaleY`
      alone. Pushing y positive there as well would double-count the squash and
      drive the feet *below* the shadow — Koda sinking into the floor rather than
      landing on it, which is the one thing a ground shadow makes unmissable.
    */
    y: [74, -22, 0, 0],
    scaleX: [0.8, 0.93, 1.2, 1],
    scaleY: [1.24, 1.09, 0.8, 1],
    transition: {
      duration: 0.66,
      times: JUMP_IN_TIMES,
      ease: "easeOut",
      opacity: { duration: 0.14 },
    },
  },
  gone: {
    /*
      A hop away, not a launch. The canvas root is `overflow-hidden` and this
      header sits at the very top of it, so anything thrown far upwards is
      clipped within a frame or two and reads as disappearing rather than as
      leaving. Short travel, and the fade carries the rest.
    */
    opacity: [1, 1, 0],
    y: [0, 2, -46],
    scaleX: [1, 1.22, 0.74],
    scaleY: [1, 0.8, 1.3],
    transition: { duration: 0.42, times: JUMP_OUT_TIMES, ease: "easeIn" },
  },
};

/**
 * The ground under the jump.
 *
 * A shadow is what tells an eye how high something is: wide and dark on the
 * floor, small and faint at the top of the arc. Without one the mascot is not
 * jumping, it is drifting — the same keyframes read as floating. It is drawn as
 * a blurred ellipse rather than as artwork so it costs nothing and never
 * disagrees with whatever mascot the account has saved.
 */
const shadowVariants: Variants = {
  hidden: { opacity: 0, scaleX: 0.45 },
  visible: {
    // Punchy at the moment of impact, then faint. Held at landing strength it
    // stops being a shadow and becomes a grey pill parked under the character.
    opacity: [0, 0.08, 0.26, 0.14],
    scaleX: [0.45, 0.55, 1.18, 1],
    transition: { duration: 0.66, times: JUMP_IN_TIMES, ease: "easeOut" },
  },
  gone: {
    opacity: [0.14, 0.22, 0],
    scaleX: [1, 1.2, 0.4],
    transition: { duration: 0.42, times: JUMP_OUT_TIMES, ease: "easeIn" },
  },
};

/**
 * The bubble, which waits for the landing.
 *
 * Opening it at the same moment as the jump makes two things move at once and
 * the eye picks neither, so it is held until Koda is on the ground — the speech
 * arrives *because* Koda arrived, which is the order it reads in. Scaled from
 * the corner nearest the character so it grows out of them rather than fading in
 * beside them.
 */
const bubbleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.86, y: -6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: 0.38, type: "spring", stiffness: 520, damping: 24 },
  },
  gone: { opacity: 0, scale: 0.9, y: -4, transition: { duration: 0.16 } },
};

/** How fast the read-along runs. Slower than reading; roughly a spoken pace. */
const WORD_REVEAL_S = 0.055;

/**
 * What Koda is saying, written down.
 *
 * The script is not the heading. `readAloudText` is the *guidance* — "drag each
 * one into the next empty box" — which until now existed only as sound, so a
 * child who could not follow the voice had nothing to fall back on and a
 * classroom with the volume off had nothing at all.
 *
 * The words arrive left to right, roughly in time with the voice, because an
 * emergent reader tracks a moving point far more easily than a wall of text
 * that appeared all at once. That reveal is decoration for a screen reader,
 * though — it gets the whole sentence in one live region instead, so it is not
 * read fifteen times as fifteen spans.
 */
const Bubble: React.FC<{
  text: string;
  /** Reveal the words in time with the voice. Off is the resting sentence. */
  speaking: boolean;
  reduce: boolean;
  compact: boolean;
  isDark: boolean;
}> = ({ text, speaking, reduce, compact, isDark }) => {
  let wordIndex = 0;
  /*
    A bubble beside Koda, tail pointing back at them.

    It was briefly plain text in a row, on the reasoning that a bubble is chrome.
    That holds where the row has a background of its own to sit on; this row
    floats over the board, and floating text over counting objects is a caption
    lying on the artwork with nothing to separate the two. The bubble is what
    makes the sentence a thing Koda is *saying* rather than a label printed on
    the board — and its surface is what keeps it readable over whatever the slide
    happens to have drawn underneath.

    `tail="left"`, centred: Koda stands to the left of it, always, so the tail
    has one job and can be pinned rather than measured.

    Speaking and resting are the same bubble, differing only in whether the words
    arrive one at a time. Swapping the contents rather than opening a second
    surface is what stops the row resizing when the voice starts, and what
    guarantees a child never sees the line twice.
  */
  return (
    <motion.div
      variants={bubbleVariants}
      // Its own state machine. It used to inherit `initial`/`animate` from the
      // guide it hung inside; standing beside them, it has to drive itself.
      initial="hidden"
      animate="visible"
      exit="gone"
      /*
        Pulled in until the tail touches Koda.

        Three separate gaps sat between the two and only one of them was a real
        margin. The row's own `gap`; the tail, which sticks out ~6px past the
        bubble's box, so any gap measured between boxes is bigger than the one
        you see; and the mascot's artwork, which does not reach the edges of its
        own square. Netting them out takes a negative margin — a bubble whose
        tail stops short points at empty air beside a character rather than at
        the character, and the two stop reading as one thing.
      */
      className={`-ml-4 max-w-[42ch] ${compact ? "text-xs" : "text-sm"}`}
    >
      <SpeechBubble tail="left" align="center">
        {/*
          A live region only while the voice is running.

          The bubble stays on the board now, so a `role="status"` inside it would
          be a permanent live region — and a live region that never closes
          re-announces its contents on any change near it, which is a screen
          reader talking over the child's own work. While speaking it is the
          right thing: one region carrying the whole sentence, rather than
          fifteen spans read one at a time. At rest the words below simply stop
          being `aria-hidden` and are read as ordinary text.
        */}
        {speaking && (
          <span className="sr-only" role="status" aria-live="polite">
            {text}
          </span>
        )}
        <p
          aria-hidden={speaking || undefined}
          className={`text-left font-semibold tracking-tight leading-snug ${
            isDark ? "text-slate-100" : "text-slate-700"
          }`}
        >
          {tokenize(text).map((token, index) => {
            if (token.isSpace) return <span key={index}> </span>;
            const delay = !speaking || reduce ? 0 : 0.42 + wordIndex++ * WORD_REVEAL_S;
            return (
              <motion.span
                key={index}
                initial={!speaking || reduce ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay, duration: 0.18 }}
                className={
                  token.strong
                    ? "inline-flex items-center px-1.5 py-0.5 mx-px rounded-md bg-violet-100 text-violet-700 font-extrabold whitespace-nowrap dark:bg-violet-900/50 dark:text-violet-200"
                    : "inline-block"
                }
              >
                {token.text}
              </motion.span>
            );
          })}
        </p>
      </SpeechBubble>
    </motion.div>
  );
};

/**
 * Koda, at the size and in the frame the question display gives them.
 *
 * The artwork is a Mascot Studio document — the same renderer, the same saved
 * file — so a school that draws its own Koda gets it here without anyone
 * exporting anything. `useStudioMascot` hands back `undefined` until the fetch
 * lands and forever for a learner (the endpoint is authoring-only), and that is
 * the quiet path rather than the broken one: `KodaMascot` draws the built-in
 * starter, which is the artwork the studio seeds anyway.
 */
const Guide: React.FC<{
  role: ActorRole;
  cast?: GuideCast;
  component?: string;
  style?: string | null;
  reduce: boolean;
  size: number;
}> = ({ role, cast, component, style, reduce, size }) => {
  const { document, state } = useActor(role, style, cast?.[role], component);
  /*
    The artwork alone — no card, no nameplate.

    A tinted squircle is a second frame on a canvas that already has bins, chips
    and a header rule, and a character in a box reads as an icon. The label went
    with it: a child who cannot yet read the question cannot read "Koda" either,
    and one who can does not need telling. Drawn large instead, because the face
    is what carries the mood and at bubble size it was a coloured blob.

    Koda arrives on the voice and leaves with it, and *jumps* both ways — see
    `jumpVariants` for the poses and `shadowVariants` for the ground that makes
    them read as height rather than as drift.

    `state="talking"` is what makes the mascot move while the sentence runs — a
    character standing perfectly still while a voice comes out of them is the
    uncanny version of this feature.

    Reduce-motion gets a plain fade and a still mascot. A jump is exactly the
    kind of large positional movement that preference is asking us not to make,
    and the feature survives without it: what matters is that Koda is here while
    the question is read, not how they got here.
  */
  if (reduce) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="relative flex-shrink-0 -my-2 pointer-events-none"
        style={{ width: size }}
      >
        <KodaMascot state={state} document={document} size={size} motionLevel="none" />
      </motion.div>
    );
  }

  return (
    /*
      The variants are declared here and inherited by both children, so the
      mascot and its shadow are driven by one state machine and cannot fall out
      of step — a shadow that lands a frame after the feet is worse than no
      shadow at all. The wrapper itself never transforms; it only reserves the
      space, so the jump cannot push the question around as it plays.
    */
    <motion.div
      initial="hidden"
      animate="visible"
      exit="gone"
      className="relative flex-shrink-0 -my-2 pointer-events-none"
      style={{ width: size, height: size }}
    >
      <motion.span
        variants={shadowVariants}
        aria-hidden="true"
        className="absolute left-1/2 bottom-0 -translate-x-1/2 rounded-[50%] bg-slate-900 blur-[6px] dark:bg-black"
        style={{ width: size * 0.56, height: size * 0.09 }}
      />
      <motion.div
        variants={jumpVariants}
        // Anchored at the feet: squash should flatten Koda onto the floor, not
        // shrink them towards their own middle.
        style={{ transformOrigin: "50% 100%" }}
        className="absolute inset-0 flex items-end justify-center"
      >
        <KodaMascot state={state} document={document} size={size} motionLevel="full" />
      </motion.div>

    </motion.div>
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
  /**
   * The sentence being asked, promoted to the top of the canvas.
   *
   * Passing this switches the header to the **question display**: an eyebrow, the
   * question set large enough to be read across a classroom, its controls under
   * it, and Koda at the right. It is opt-in because it is a different piece of
   * furniture, not a restyle — the old header leads with the activity name and
   * puts the live state on the prominent line, which is right for a canvas whose
   * state *is* the thing being watched, and wrong for one that asks a question
   * and waits.
   *
   * A canvas that passes this should stop passing the same words as
   * `playHint` — the footer would then repeat, in small grey type, the sentence
   * already set at 30px above it.
   */
  questionText?: React.ReactNode;
  /**
   * The small line above the question — "E · Understand addition".
   *
   * Curricular context, not the technique: a child does not need to know the
   * component is called Count. Defaults to `headerTitle` so a canvas that has
   * nothing better to say still reads sensibly.
   */
  questionEyebrow?: React.ReactNode;
  /**
   * Which moment of the question Koda is in — and, by being set at all, that
   * this display has a guide.
   *
   * Koda is not furniture parked beside every board from page load: they step in
   * the first time the question is read aloud. But they do not vanish the
   * instant the sentence ends either, because a character who disappears the
   * moment they stop talking never gets to react to anything. Once they have
   * arrived they stay, changing actor as the question moves — waiting while the
   * child works, wincing at a wrong answer, celebrating a right one.
   *
   * `talking` is not worth passing: the layout knows when its own read-aloud
   * button is speaking and overrides whatever the canvas said for the duration.
   */
  guideRole?: ActorRole;
  /**
   * Which saved Mascot Studio style to draw Koda in — a style id or its name.
   *
   * The slide's *default* actor, used for any role the account has not drawn a
   * style for. A style that was later deleted resolves to the built-in starter
   * rather than to nothing, so a slide never loses its guide.
   */
  guideStyle?: string | null;
  /**
   * Explicit casting per moment, from the Studio — wins over both the role's
   * conventional style name and `guideStyle`. Roles left out resolve
   * automatically, which is what almost every slide does.
   */
  guideCast?: GuideCast;
  /**
   * Which activity is asking, so a component can have its own house cast.
   *
   * See `COMPONENT_CAST`. Left out, every canvas shares the same four built-in
   * characters, which is the right default for a product where Koda is one
   * character rather than one per game.
   */
  guideComponent?: string;
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

/**
 * Below this, the header's title and its controls cannot share a row: the
 * read-aloud button and a status chip alone take ~260px, which leaves a phone
 * nothing for the sentence that matters most.
 */
const HEADER_ROW_MIN = 560;

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
  questionText,
  questionEyebrow,
  guideRole,
  guideStyle,
  guideCast,
  guideComponent,
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

  /*
    Whether this card is too narrow to lay the header out in a row.

    `compact` is a prop, and **no host has ever passed one** — so every canvas
    ran the wide header at every width, and on a phone the one line telling a
    child what to do was squeezed to "0 coun…" between the read-aloud button and
    the status chip. Measuring the card itself is better than a host guess in any
    case: the constraint is how much room this canvas got, not how wide the
    window is, and the same canvas is rendered full-bleed in a launcher and in a
    narrow studio column on the same screen.

    An explicit `compact` still wins, so a caller that knows better can say so.
  */
  const selfRef = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  /** True while the read-aloud button is speaking — what brings Koda on. */
  const [speaking, setSpeaking] = useState(false);
  /*
    Latched, not derived. Koda arrives with the first sentence and then belongs
    to the board, so the question of "is a guide on screen" stops being the same
    as "is a voice running" the moment the first one finishes.
  */
  const [hasSpoken, setHasSpoken] = useState(false);
  const onSpeakingChange = React.useCallback((next: boolean) => {
    setSpeaking(next);
    if (next) setHasSpoken(true);
  }, []);
  const reduceMotion = useReducedMotion();

  /*
    An answer is also an invitation for the guide to enter. Requiring a child
    to press Listen before Koda can celebrate or encourage them makes answer
    feedback depend on an unrelated control, and most children never see it.
    Waiting remains quiet on first paint; only a real result opens the latch.
  */
  useEffect(() => {
    if (guideRole === "oops" || guideRole === "celebrating") setHasSpoken(true);
  }, [guideRole]);

  useLayoutEffect(() => {
    const node = selfRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = (width: number) => setNarrow(width > 0 && width < HEADER_ROW_MIN);
    measure(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) measure(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const isCompact = compact || narrow;

  /*
    Koda can be sent away, and asked back.

    Dragging moves the guide off the object it is covering; dismissing is for the
    child who does not want a character on the board at all — or the teacher on a
    projector who needs the artwork clean. It is deliberately *not* sticky across
    slides: the next question re-reads itself, and a guide dismissed on a board
    about apples should not be missing from the next one about sharing.

    Hidden leaves a small speaker-shaped way back rather than nothing, because a
    control that removes itself along with the thing it removed is a control a
    child cannot undo.
  */
  const [guideHidden, setGuideHidden] = useState(false);

  /*
    A drag is not a tap.

    Koda is dismissed by tapping the character, and the character is also the
    drag handle — so a drag that ends over the same spot would otherwise fire the
    dismiss and make the guide vanish when a child only meant to move it. Motion
    calls `onDragStart` once a drag genuinely begins, past its own threshold,
    which is exactly the signal needed: anything that dragged is not a tap.
  */
  const guideDragged = useRef(false);

  const safeGridSize = Math.max(8, Math.min(80, Math.round(gridSize)));
  const majorGridSize = safeGridSize * Math.max(2, majorGridEvery);
  const rulerMarks = Array.from({ length: 12 }).map((_, idx) => idx * majorGridSize);

  return (
    <div
      ref={node => {
        selfRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      /*
        The card's own width decides its height floor, and the viewport caps it.

        `min-h` used to step up on `sm:`/`md:`, which asks the wrong question
        twice over. It read the viewport while the card measures itself — so the
        Studio's ~530px panel was held to the 460px floor meant for a full-width
        board — and it had no answer at all for a *short* screen: a landscape
        phone is 844px wide and ~390px tall, so it took the tallest floor on
        offer and pushed the bottom of the board past the edge, where the
        launcher's `overflow-hidden` clipped it with no way to scroll to it.

        `min(…, 70svh)` is the cap. On any ordinary screen the pixel floor wins
        and nothing moves; on a short one the card gives way instead of running
        off the bottom. `svh` rather than `vh` so a mobile browser's collapsing
        toolbar cannot retroactively make the floor too tall.
      */
      data-canvas-root=""
      /*
        The board paints its own white.

        `bg-transparent` meant the canvas had no colour of its own and took
        whichever surface it was dropped onto — white in the launcher, the
        Studio's `#FBFAFF` in the authoring panel — so the same slide was a
        different colour depending on who was looking at it, and the one it
        borrowed most often was a grey wash under artwork drawn to sit on white.
        A board is a sheet of paper; it should be the same sheet everywhere.

        Light only. In dark mode the launcher's near-black is the intended
        ground and painting over it would put a slab behind the objects.
      */
      className={`relative w-full h-full rounded-3xl transition-colors duration-300 overflow-hidden select-none flex flex-col justify-between border-0 shadow-none text-slate-800 dark:text-slate-100 ${
        isDark ? "bg-transparent" : "bg-white"
      } ${
        isCompact ? "min-h-[min(350px,70svh)] gap-1 p-0" : "min-h-[min(460px,70svh)] gap-3 p-1"
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

      {/* ── Question Display ──
          The question first, big, with everything else arranged around it.

          The old header led with the activity name and gave the prominent line
          to the live state, so a child arrived at "4 of 13 counted" and had to
          go looking for what they were meant to do — the sentence was a grey
          hint at the bottom of the canvas that faded after three seconds. Here
          the question is the heading, its controls sit under it where a hand
          reaches, and the running state steps back to a chip. */}
      {questionText ? (
        <div
          /*
            Sized off `isCompact`, not off `sm:`. The two disagree in the place
            this is most often authored: a Tailwind breakpoint asks the viewport,
            and the Studio's canvas panel is ~530px inside a 1440px window — so
            `sm:gap-5` fired while the card was measuring itself as narrow. One
            width decides the whole header, and it is the card's own.
          */
          /*
            One column, ranged left, with a rail under it that holds both edges.

            Two arrangements were tried and neither balanced. Koda pinned to the
            far right of a left-aligned question put the character and the
            sentence they are saying at opposite ends of a metre of empty space.
            Centring the stack fixed that pairing and broke everything else: a
            centred sentence over a left-aligned board has no edge to line up
            with, so the header floated free of the thing it introduces, and
            every line started in a different place — a ragged left margin is
            the hardest kind of text for an emergent reader to track down.

            So: everything ranged left against the board's own margin, and the
            balance comes from the rail below, which is pushed out to both edges
            rather than from centring anything.
          */
          className={`relative z-20 flex flex-col border-b transition-all ${
            isCompact ? "pb-2 px-0.5" : "pb-2.5 px-1"
          } ${isDark ? "text-slate-100 border-white/[0.07]" : "text-slate-800 border-black/[0.06]"}`}
        >
          {/*
            The eyebrow sits tight to the question and the controls sit apart
            from it — 1.5 between all three read as one undifferentiated stack,
            with the row crowding the sentence it serves. `gap-1` above, `mt-2.5`
            below: label and heading are one object, the controls answer to it.
          */}
          <div className="min-w-0 w-full flex flex-col gap-1">
            {/*
              A real eyebrow only — never the component's name.

              This used to fall back to `headerTitle` when a canvas had nothing
              better, which printed "COUNT" over a counting board. It said
              nothing a child could use and nothing an author did not already
              know: the launcher's navbar carries the slide's name, the Studio's
              panel names the component twice over, and the board itself is
              plainly a counting board. It was a row of chrome asserting the
              obvious in the most prominent colour on the card.

              A unit, a skill, "Lesson 4 · Place value" — that is context, and it
              still shows, for learner and author alike. The difference is that
              it has to be *given*, not derived from what the component is called.
            */}
            {questionEyebrow && (
              <div
                className={`font-black uppercase tracking-[0.16em] truncate leading-none ${
                  isCompact ? "text-[10px]" : "text-[11px]"
                } ${isDark ? "text-violet-300" : "text-violet-600"}`}
              >
                {questionEyebrow ?? headerTitle}
              </div>
            )}

            {/*
              Read from across a room, but still a sentence — set well below the
              eyebrow's black so it reads as prose rather than as a banner.

              `font-medium`, not `semibold`. The display face this ships with is
              already dense at 24px, so 600 gave a heading that shouted a line a
              child is meant to read calmly and then work under. Size carries the
              hierarchy here; the weight does not have to as well.

              24px on a wide card, down from 28. At 28 a full-width board gave
              the question the presence of a page title, and it is not one: it
              is the line a child reads once and then works under, sharing the
              header with a button, a chip and Koda. 24 still carries the row
              without flattening everything beside it.

              One size per branch, no `sm:`/`md:` ramp inside it. The card
              already measured itself to pick the branch — asking the viewport a
              second question inside that answer is how a 600px card in a wide
              window ended up with the full-width type.

              Two lines on a wide card, three on a narrow one. The clamp was
              flat at two on the argument that truncating beats pushing the
              board off the bottom of a phone — but the phone is where the line
              is *shortest*, and a clamp that bites hardest exactly where it can
              hold the least is the wrong shape. At `text-lg` a third line costs
              about 24px and buys the sentence that a child who cannot read the
              first two has no other way to get: the read-aloud speaks the
              guidance, not the question. Wide cards keep two, because at
              1.75rem a third line is a banner.
            */}
            {/*
              The speaker sits in front of the sentence it reads.

              It was a "Listen" pill on its own row beneath the question, which
              cost a line of height and read as a control standing next to the
              thing it acts on rather than part of it. In front of the first
              word it is unambiguous — press the speaker, hear this — and the
              row it used to occupy goes back to the board.

              `items-baseline` so the icon sits on the sentence's own baseline
              rather than in the middle of a block that may run to three lines,
              and `shrink-0` so a long question never squeezes it.
            */}
            {/*
              One row: speaker, question, state.

              The chip had a line to itself under the question, which on a wide
              card left a band of empty space with a small pill adrift at the far
              end of it — and pushed the board down by a row to do it. Up here it
              holds the right margin against the question holding the left, on
              the line they share.

              `items-start` and not `items-center`: the question is the tall
              element and may run to two or three lines, and a chip centred
              against a three-line heading floats in the middle of nowhere. Level
              with the first line is where the eye already is.

              `flex-1` on the question so it takes the room left over and wraps
              inside it, `shrink-0` on the chip so a long question shortens the
              sentence rather than squeezing the number.
            */}
            <div className={`flex items-start ${isCompact ? "gap-1.5" : "gap-2"}`}>
              {readAloudText && (
                <SpeechReadAloudButton
                  text={readAloudText}
                  isDark={isDark}
                  onSpeakingChange={onSpeakingChange}
                  label={null}
                  size="sm"
                  className="shrink-0 px-0 w-8"
                />
              )}
              <h2
                className={`min-w-0 flex-1 font-medium tracking-tight leading-[1.2] ${
                  isCompact ? "text-lg line-clamp-3" : "text-2xl line-clamp-2"
                } ${isDark ? "text-slate-50" : "text-slate-900"}`}
              >
                {questionText}
              </h2>
              {headerActions && (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{headerActions}</div>
              )}
            </div>
          </div>

          {/*
            The floating guide, hanging below the header rule.

            `absolute … top-full` rather than a row in the flow: the character is
            transient — it arrives with the voice, changes with the answer, and
            can be dismissed outright — and a transient thing that owns permanent
            layout spends the board's height whether or not anybody is standing
            there. On this canvas that height is the whole point; it was the
            difference between a keypad that fits and one that gets cut off.

            Anchored to `top-full` so it starts *below* the rule instead of
            straddling it, and `pointer-events-none` so the board underneath
            stays reachable — the guide itself takes them back, since it is
            draggable and carries its own dismiss.

            Arrival is still tied to the voice — the character jumps in the first
            time the question is read, and an answer brings them in too — and
            after that they stay, changing role as the question moves.

            A narrow card shrinks the guide rather than dropping it. Suppressing
            it on `isCompact` looked reasonable and was wrong in the place this
            is most often looked at: the Studio's canvas panel is ~530px, under
            the compact threshold, so an author pressed Listen and no character
            ever appeared — the feature was invisible exactly where it is
            authored.
          */}
          <div className="absolute inset-x-0 top-full z-30 flex items-start pt-1 pointer-events-none">
            <AnimatePresence>
              {guideRole && hasSpoken && guideHidden && (
                /* The way back. See `guideHidden`. */
                <motion.button
                  key="guide-recall"
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setGuideHidden(false)}
                  title="Show Koda"
                  aria-label="Show Koda"
                  className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full border-2 pointer-events-auto transition-colors ${
                    isDark
                      ? "border-violet-500/40 bg-slate-800/90 text-violet-300 hover:bg-slate-700"
                      : "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100"
                  }`}
                >
                  <Sparkles size={14} />
                </motion.button>
              )}

              {guideRole && hasSpoken && !guideHidden && (
                /*
                  Koda can be moved out of the way.

                  A guide that floats over the board will sometimes float over
                  the one object a child is reaching for, and no default position
                  is right for every slide, every count and every screen. Rather
                  than guess, the whole group — character and bubble together —
                  picks up and puts down wherever it is dropped.

                  `dragConstraints={selfRef}` is the card itself, so Koda cannot
                  be dragged off the board and stranded outside it.
                  `dragMomentum={false}` because a thrown mascot that keeps
                  sliding after the finger lifts is a toy, not a control, and a
                  child will chase it. `pointer-events-auto` is granted here and
                  nowhere else on the rail: this is the one part of it that is
                  meant to be touched.
                */
                <motion.div
                  key="guide-row"
                  drag
                  dragConstraints={selfRef}
                  dragMomentum={false}
                  dragElastic={0.04}
                  whileDrag={{ scale: 1.03 }}
                  /*
                    Tight. The bubble's tail is what joins it to Koda, and a tail
                    with a gap in front of it points across empty space at a
                    character standing somewhere else — the two stop reading as
                    one object. `-ml-1` on the bubble closes the last of it: the
                    tail sticks out past the bubble's own box, so a gap measured
                    between the boxes is bigger than the gap you see.
                  */
                  className="flex min-w-0 items-center pt-1 gap-0 pointer-events-auto touch-none cursor-grab active:cursor-grabbing"
                  onPointerDown={() => {
                    guideDragged.current = false;
                  }}
                  onDragStart={() => {
                    guideDragged.current = true;
                  }}
                >
                {/*
                  Tapping the character sends it away.

                  There was a small × floating beside the bubble, and it was the
                  wrong control twice over: a close button is adult chrome on a
                  board whose entire vocabulary is "touch the thing you mean",
                  and hung off a character with no card behind it, it had nothing
                  to belong to — it read as a stray mark on the board. The
                  character is the affordance. A child who wants Koda gone pushes
                  Koda, which is what they would try first anyway.
                */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Hide Koda"
                  title="Hide Koda"
                  onClick={() => {
                    if (!guideDragged.current) setGuideHidden(true);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setGuideHidden(true);
                    }
                  }}
                  className="rounded-full outline-none focus-visible:ring-4 focus-visible:ring-violet-400/40"
                >
                  <Guide
                    // Speaking wins: the layout owns its own read-aloud button,
                    // so it knows better than the canvas whether a sentence is
                    // running.
                    role={speaking ? "talking" : guideRole}
                    cast={guideCast}
                    component={guideComponent}
                    style={guideStyle}
                    reduce={!!reduceMotion}
                    /*
                      Bigger again, now that the guide costs the board nothing.

                      It was cut to 76 when it sat in the layout flow and every
                      pixel of it pushed the board down. Floating, it spends no
                      height at all — so the character can be a character. The
                      face is what carries the mood, and at 76 in a wide card it
                      was a coloured blob with a bubble next to it.
                    */
                    size={isCompact ? 72 : 112}
                  />
                </div>

                {/*
                  What Koda is saying — one bubble, whether or not it is being
                  read out. See `Bubble` for why the two states share a surface.

                  Suppressed where it would only repeat the heading: a slide with
                  no instruction of its own falls back to this very sentence for
                  `questionText`, and the guide should not stand there saying the
                  thing printed above them in 24px. Speaking overrides that,
                  because then the bubble is the read-along and its job is to
                  show *which word* is being said, not which sentence.
                */}
                {readAloudText && (speaking || readAloudText.trim() !== String(questionText).trim()) && (
                  <Bubble
                    text={readAloudText}
                    speaking={speaking}
                    reduce={!!reduceMotion}
                    compact={isCompact}
                    isDark={!!isDark}
                  />
                )}

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (headerTitle || headerActions || readAloudText) && (
        <div className={`relative z-20 flex flex-wrap justify-between border-b transition-all ${
          isCompact ? "flex-col items-stretch gap-1 pb-1 px-0.5" : "items-center gap-2.5 pb-2 px-1"
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
              {/*
                The one line that tells a child what to do, so it is sized to be
                read rather than to fit. It was a step below the technique name
                it sits under, and children were reaching the board without
                knowing what was being asked — `truncate` made that worse by
                quietly cutting the sentence off at the toolbar. It wraps to two
                lines now instead of losing its second half.
              */}
              {headerSubtitle && (
                <div className={`font-extrabold tracking-tight leading-snug line-clamp-2 ${
                  learnerMode
                    ? "text-lg sm:text-xl md:text-2xl"
                    : "text-base sm:text-lg mt-1"
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
            isCompact ? "w-full justify-center" : "justify-end"
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

      {/*
        ── Main Canvas Interactive Area ──

        `touch-none` belongs here and not on the card.

        A drag has to win against the browser's own scroll gesture, or the first
        finger movement steals the object and pans the page instead — so the
        board suppresses touch scrolling, and always did. What it should never
        have suppressed is the *header*: on a phone that made the question, the
        Listen button and the status chips a dead zone, so a child who put a
        finger on the sentence they were reading found the page frozen. Nothing
        up there is draggable; there is nothing for the gesture to compete with.
      */}
      <div className={`relative z-10 flex-1 flex flex-col w-full min-h-0 touch-none ${isCompact ? "mt-0" : "mt-2"}`}>
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
