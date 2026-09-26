import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Volume2, X } from "lucide-react";
import { BANDS, type Passage, type PicturePlace, type Sentence } from "./data/passage";
import { layoutBook, type SetSentence, type SetToken } from "./bookLayout";
import { FLAT, SPRING, TURNED, angularVelocity, castOf, completes, curlOf, dragAngle, shadeOf, type Dir } from "./pageTurn";
import { Picture } from "./Picture";
import { LibraryProgress } from "./progress";
import { minutesToRead } from "./session";
import { canSpeak, say, stop } from "./voice";
import { prefetchBook, prefetchClips, recordingAudioSupported } from "./clips";
import { playSound } from "../utils/audio";
import { UIReaderFrame, UIReaderPagination, UIReaderToolbar } from "../components/ui";
import { useTheme } from "../context/ThemeContext";

/**
 * A story read as a book: one page at a time, turned by a swipe, the arrows or
 * the ← → keys.
 *
 * The page is deliberately plain — no frame, no card: near-black type straight
 * on the page (light type in dark mode), a book serif for English, one measure of text. Colour is
 * kept for the controls around the page, never the words on it. Emphasis carries
 * meaning: **bold** is a word the quiz will ask about, *italic* is a name. What
 * goes on which page is decided by `bookLayout`, so it can be tested without a
 * screen.
 *
 * Turning is drawn as a page turning: going forward, the page folds away from
 * the spine and the next one is there underneath; going back, the previous page
 * folds in over it. With reduced motion the page simply changes.
 *
 * "I'm ready" sits on the last page. Reaching it is the whole rule: a child who
 * turned every page has seen every sentence, and nothing has to watch the scroll.
 */

const KHMER = "font-['Noto_Sans_Khmer','Khmer_OS','Khmer_MN',sans-serif]";
const SERIF = "font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,'Times_New_Roman',serif]";
const round = "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-30";

/** How far a finger must move sideways before it is a page turn, not a tap. */
const DRAG_START = 8;
const TURN_AT = 60;

const TEXT_KEY = "koda_library_text_v1";
/** Text sizes a reader can step through, as multiples of the page's own size. */
const TEXT_STEPS = [0.85, 1, 1.15, 1.3, 1.5] as const;
const readTextStep = (): number => {
  try {
    const raw = localStorage.getItem(TEXT_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 && n < TEXT_STEPS.length ? n : 1;
  } catch {
    return 1;
  }
};

/** Match the audio clock to an approved word; old/manual clips use a duration-weighted fallback. */
export function spokenWordAt(sentence: Pick<Sentence, "words" | "audioCues">, elapsedMs: number, durationMs?: number): number | null {
  const cues = sentence.audioCues;
  if (cues?.length === sentence.words.length) {
    const exact = cues.findIndex((cue) => elapsedMs >= cue.startMs && elapsedMs < cue.endMs);
    return exact >= 0 ? exact : null;
  }
  if (!durationMs || durationMs <= 0 || elapsedMs < 0 || elapsedMs >= durationMs || !sentence.words.length) return null;
  const weights = sentence.words.map((word) => Math.max(1, [...word.replace(/[^\p{L}\p{N}]/gu, "")].length));
  const target = (elapsedMs / durationMs) * weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  for (let i = 0; i < weights.length; i++) {
    cursor += weights[i];
    if (target < cursor) return i;
  }
  return weights.length - 1;
}

interface Turn { dir: Dir; from: number; to: number }

export function BookReader({ book, onBack, onReady, preview = false }: { book: Passage; onBack(): void; onReady(): void; preview?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const pages = useMemo(() => layoutBook(book), [book]);
  const reduce = useReducedMotion() ?? false;
  const km = book.language === "km";
  const [page, setPageState] = useState(0);
  const [turning, setTurning] = useState<Turn | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState<{ sentence: string; index: number } | null>(null);
  const [reading, setReading] = useState(false);
  const [pageAudio, setPageAudio] = useState<"idle" | "preparing" | "ready" | "failed">("idle");
  const [peek, setPeek] = useState<string | null>(null);
  const [peekAnchor, setPeekAnchor] = useState<HTMLElement | null>(null);
  const [peekPosition, setPeekPosition] = useState<{ left: number; top: number; side: "top" | "bottom" | "left" | "right" } | null>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [textStep, setTextStepState] = useState(readTextStep);
  const run = useRef(0);
  const pageRef = useRef(0);
  const turnRef = useRef<Turn | null>(null);
  const spring = useRef<{ stop(): void } | null>(null);
  const bookEl = useRef<HTMLElement>(null);
  const scrollEl = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; id: number; dragging: boolean; turn: Turn | null; lastX: number; lastT: number; vx: number } | null>(null);
  const swallowClick = useRef(false);
  const last = pages.count - 1;
  const pageSentences = useMemo(() => page > 0 ? pages.story[page - 1] ?? [] : [], [page, pages]);
  const pageAudioIds = useMemo(
    () => pageSentences.map((item) => item.sentence.audio).filter((id): id is string => Boolean(id)),
    [pageSentences],
  );
  const pageRecorded = pageSentences.length > 0 && pageAudioIds.length === pageSentences.length;

  useLayoutEffect(() => {
    if (!peek || !peekAnchor || !peekRef.current) return;
    const place = () => {
      const anchor = peekAnchor.getBoundingClientRect();
      const bubble = peekRef.current?.getBoundingClientRect();
      if (!bubble) return;
      const gap = 12;
      const pad = 12;
      const fitsBelow = anchor.bottom + gap + bubble.height <= window.innerHeight - pad;
      const fitsAbove = anchor.top - gap - bubble.height >= pad;
      const fitsRight = anchor.right + gap + bubble.width <= window.innerWidth - pad;
      const fitsLeft = anchor.left - gap - bubble.width >= pad;
      const side: "top" | "bottom" | "left" | "right" = fitsBelow ? "bottom" : fitsAbove ? "top" : fitsRight ? "right" : fitsLeft ? "left" : "bottom";
      let left = anchor.left + anchor.width / 2 - bubble.width / 2;
      let top = anchor.bottom + gap;
      if (side === "top") top = anchor.top - gap - bubble.height;
      if (side === "right") { left = anchor.right + gap; top = anchor.top + anchor.height / 2 - bubble.height / 2; }
      if (side === "left") { left = anchor.left - gap - bubble.width; top = anchor.top + anchor.height / 2 - bubble.height / 2; }
      setPeekPosition({ left: Math.max(pad, Math.min(window.innerWidth - bubble.width - pad, left)), top: Math.max(pad, Math.min(window.innerHeight - bubble.height - pad, top)), side });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [peek, peekAnchor]);

  // The turning sheet, driven by a finger or a spring. Shade, cast shadow and
  // curl all follow its angle, so they can never disagree with it.
  const angle = useMotionValue(FLAT);
  const shade = useTransform(angle, shadeOf);
  const cast = useTransform(angle, castOf);
  const curl = useTransform(angle, curlOf);

  // The one place a page actually changes, however the turn was made — a
  // button, the arrow keys, a completed swipe, or "read to me" advancing on
  // its own. Every call site already checked this is a real change before
  // reaching it, so the sound plays once per page and never for a swipe let go
  // of halfway through.
  const setPage = (p: number) => {
    pageRef.current = p;
    setPageState(p);
    if (scrollEl.current) scrollEl.current.scrollTop = 0;
    playSound("page");
  };
  const setTextStep = (n: number) => {
    const next = Math.max(0, Math.min(TEXT_STEPS.length - 1, n));
    setTextStepState(next);
    try {
      localStorage.setItem(TEXT_KEY, String(next));
    } catch {
      /* a remembered size is a convenience */
    }
  };

  useEffect(() => {
    if (!preview) LibraryProgress.set(book.id, { stage: "read", rev: book.rev });
  }, [book, preview]);
  // Have the first recording ready before a phone tap. This keeps playback in
  // the browser's user-gesture window and lets the same audio element continue
  // through every recorded sentence on the page.
  useEffect(() => {
    void prefetchBook(book);
  }, [book]);
  useEffect(() => {
    if (!pageRecorded) {
      setPageAudio("idle");
      return;
    }
    if (!recordingAudioSupported()) {
      setPageAudio("failed");
      return;
    }
    let live = true;
    setPageAudio("preparing");
    void prefetchClips(pageAudioIds).then(({ ready, total }) => {
      if (live) setPageAudio(total > 0 && ready === total ? "ready" : "failed");
    });
    return () => { live = false; };
  }, [pageAudioIds, pageRecorded]);
  useEffect(() => () => { run.current++; stop(); spring.current?.stop(); }, []);

  const hush = () => {
    run.current++;
    stop();
    setReading(false);
    setPlaying(null);
    setPlayingWord(null);
  };

  /** Put the sheet down: the turn is over, whichever way it went. */
  const land = (t: Turn) => {
    if (turnRef.current !== t) return;
    spring.current?.stop();
    spring.current = null;
    turnRef.current = null;
    setTurning(null);
    angle.set(FLAT);
  };

  /** Lift a sheet to go to page `to`. A turn still in flight is finished first. */
  const begin = (to: number, keepReading = false): Turn | null => {
    const inFlight = turnRef.current;
    if (inFlight) land(inFlight);
    const from = pageRef.current;
    const next = Math.max(0, Math.min(last, to));
    if (next === from) return null;
    if (!keepReading) hush();
    setPeek(null);
    setPeekAnchor(null);
    setPeekPosition(null);
    if (reduce) {
      setPage(next);
      return null;
    }
    const t: Turn = { dir: next > from ? 1 : -1, from, to: next };
    turnRef.current = t;
    setTurning(t);
    angle.set(t.dir === 1 ? FLAT : TURNED);
    return t;
  };

  /** Let go of the sheet: the spring carries it over, or lets it fall back. */
  const release = (t: Turn, finish: boolean, velocity = 0) => {
    if (finish) setPage(t.to);
    const target = (t.dir === 1) === finish ? TURNED : FLAT;
    spring.current = animate(angle, target, { ...SPRING, velocity, onComplete: () => land(t) });
  };

  const turn = (to: number, keepReading = false) => {
    const t = begin(to, keepReading);
    if (t) release(t, true);
  };

  // ← and → turn the page, unless someone is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowRight") turn(pageRef.current + 1);
      else if (e.key === "ArrowLeft") turn(pageRef.current - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** Read the current page aloud, using recordings while Koda's voice is off. */
  const readPage = async () => {
    if (reading) return hush();
    const current = pageRef.current;
    if (current < 1 || current > pages.story.length) return;
    const mine = ++run.current;
    setReading(true);
    setPeek(null);
    setPeekAnchor(null);
    setPeekPosition(null);
    for (const s of pages.story[current - 1]) {
      if (run.current !== mine) return;
      if (!s.sentence.audio) continue;
      setPlaying(s.sentence.id);
      await say(s.sentence.text, book.language, s.sentence.audio, (elapsedMs, durationMs) => {
        if (run.current !== mine || elapsedMs === null) return setPlayingWord(null);
        const index = spokenWordAt(s.sentence, elapsedMs, durationMs);
        setPlayingWord(index === null ? null : { sentence: s.sentence.id, index });
      });
    }
    if (run.current === mine) {
      setPlaying(null);
      setPlayingWord(null);
      setReading(false);
    }
  };

  const tapWord = (w: string, target?: HTMLElement) => {
    if (!w) return;
    if (reading) hush();
    setPeek(w);
    setPeekAnchor(target ?? null);
    setPeekPosition(null);
    hear(w);
  };
  const hear = (w: string) => {
    const clip = book.wordAudio?.[w] ?? book.wordAudio?.[w.toLowerCase()];
    if ((clip || canSpeak(book.language)) && !(book.noRecording ?? []).includes(w)) void say(w, book.language, clip);
  };

  // A finger on the page. Past a few pixels sideways it takes hold of the sheet —
  // left lifts this page, right brings the last one back — and the sheet follows
  // it. Anything shorter, or mostly up and down, stays a tap or a scroll.
  const width = () => bookEl.current?.getBoundingClientRect().width || 360;
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, dragging: false, turn: null, lastX: e.clientX, lastT: e.timeStamp, vx: 0 };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    if (!g.dragging) {
      if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(e.clientY - g.y)) return;
      g.dragging = true;
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        /* a pointer the browser no longer tracks: the drag still works without capture */
      }
      g.turn = reduce ? null : begin(pageRef.current + (dx < 0 ? 1 : -1));
    }
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.vx = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    if (g.turn) angle.set(dragAngle(g.turn.dir, dx, width()));
  };
  const onPointerEnd = (e: ReactPointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId || !g.dragging) return;
    swallowClick.current = true;
    const dx = e.clientX - g.x;
    const w = width();
    if (g.turn) release(g.turn, completes(g.turn.dir, dx, g.vx, w), angularVelocity(g.vx, w));
    // Reduced motion: no sheet to hold, so a long enough swipe simply turns.
    else if (reduce && Math.abs(dx) >= TURN_AT) turn(pageRef.current + (dx < 0 ? 1 : -1));
  };

  const peekPic = peek ? book.pictures[peek.toLowerCase()] ?? book.pictures[peek] : undefined;
  const scale = TEXT_STEPS[textStep];
  const sheet = (i: number) => (
    <Sheet index={i} count={pages.count}>
      {i === 0 ? <TitlePage book={book} km={km} /> : (
        <StoryPage book={book} sentences={pages.story[i - 1]} picture={pages.pictures[i - 1]} at={pages.places[i - 1]} scale={scale} playing={playing} playingWord={playingWord} peek={peek} onWord={tapWord} end={i === last} />
      )}
    </Sheet>
  );
  // While a sheet turns, two pages are on the table: the one lying flat beneath,
  // and the one in the air. Forward, the page in view is the one that lifts.
  const under = turning ? (turning.dir === 1 ? turning.to : turning.from) : page;
  const over = turning ? (turning.dir === 1 ? turning.from : turning.to) : null;

  return (
    <UIReaderFrame
      contentRef={scrollEl}
      toolbar={<UIReaderToolbar
        onBack={onBack}
        onSmallerText={() => setTextStep(textStep - 1)}
        onLargerText={() => setTextStep(textStep + 1)}
        smallerDisabled={textStep === 0}
        largerDisabled={textStep === TEXT_STEPS.length - 1}
        audio={pageRecorded ? {
          playing: reading,
          disabled: pageAudio !== "ready",
          disabledTitle: pageAudio === "failed" ? "Audio unavailable on this device" : "Preparing audio",
          onToggle: () => void readPage(),
        } : undefined}
        dark={theme === "dark"}
        onToggleDark={toggleTheme}
      />}
      footer={<UIReaderPagination
        page={page}
        pageCount={pages.count}
        storyPageCount={pages.story.length}
        onPrevious={() => turn(page - 1)}
        onNext={() => turn(page + 1)}
        onComplete={() => { hush(); onReady(); }}
      />}
    >
      <section
        ref={bookEl}
        aria-roledescription="book"
        aria-label={book.title}
        className="relative grid min-h-full touch-pan-y select-none overflow-hidden font-normal text-neutral-900 [perspective:2000px] dark:text-neutral-100"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <div className="relative col-start-1 row-start-1 bg-surface" aria-hidden={over !== null && over === page ? true : undefined} inert={over !== null && over === page ? true : undefined}>
          {sheet(under)}
          {over !== null && (
            <motion.div aria-hidden="true" style={{ opacity: cast }} className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,.55),rgba(0,0,0,.12)_22%,transparent_55%)]" />
          )}
        </div>
        {over !== null && (
          <motion.div
            aria-hidden={over !== page || undefined}
            inert={over !== page || undefined}
            style={{ rotateY: angle, skewY: curl }}
            className="relative col-start-1 row-start-1 origin-left bg-surface [backface-visibility:hidden] [transform-style:preserve-3d]"
          >
            {sheet(over)}
            <motion.div aria-hidden="true" style={{ opacity: shade }} className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_left,rgba(0,0,0,.5),rgba(0,0,0,.08)_45%,rgba(255,255,255,.06))]" />
          </motion.div>
        )}
      </section>

      {peek && peekAnchor ? (
        <div ref={peekRef} role="tooltip" aria-label={`Word helper: ${peek}`} aria-live="polite" data-word-tooltip style={{ left: peekPosition?.left ?? 0, top: peekPosition?.top ?? 0, visibility: peekPosition ? "visible" : "hidden" }} className="koda-tooltip-in fixed z-50 flex w-[min(calc(100vw-1.5rem),24rem)] items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-4 py-3 pr-12 shadow-xl dark:border-indigo-900 dark:bg-surface">
          <span aria-hidden="true" className={`absolute h-4 w-4 rotate-45 border-indigo-100 bg-white dark:border-indigo-900 dark:bg-surface ${peekPosition?.side === "top" ? "-bottom-2 left-1/2 -translate-x-1/2 border-b border-r" : peekPosition?.side === "left" ? "-right-2 top-1/2 -translate-y-1/2 border-r border-t" : peekPosition?.side === "right" ? "-left-2 top-1/2 -translate-y-1/2 border-b border-l" : "-top-2 left-1/2 -translate-x-1/2 border-l border-t"}`} />
          {peekPic && <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-play-sky"><Picture name={peekPic} /></span>}
          <span className="min-w-0 flex-1">
            <span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted">Word helper</span>
            <span className={`block text-xl font-bold leading-tight text-ink ${km ? KHMER : SERIF}`}>{peek}</span>
            <span className="text-xs text-muted">{peekPic ? "Picture word · tap the speaker to hear it" : "Tap the speaker to hear it"}</span>
          </span>
          {(canSpeak(book.language) || book.wordAudio?.[peek] || book.wordAudio?.[peek.toLowerCase()]) && (
            <button type="button" onClick={() => hear(peek)} aria-label={`Hear ${peek}`} className={round}>
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={() => { setPeek(null); setPeekAnchor(null); setPeekPosition(null); }} aria-label="Close" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-indigo-200 bg-white/70 text-ink transition-colors hover:border-indigo-400 dark:border-indigo-800 dark:bg-indigo-950/70">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        null
      )}
    </UIReaderFrame>
  );
}

/** One sheet of the book. */
function Sheet({ index, count, children }: { index: number; count: number; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-roledescription="page"
      aria-label={index === 0 ? "Cover" : `Page ${index} of ${count - 1}`}
      data-book-page={index}
      className="flex min-h-full w-full flex-col py-4 sm:px-8 sm:py-8"
    >
      {children}
    </div>
  );
}

/** The cover: the book's picture, edge to edge, with the title beneath it. */
function TitlePage({ book, km }: { book: Passage; km: boolean }) {
  const [lo, hi] = BANDS[book.band].ages;
  return (
    <div className="flex flex-1 flex-col">
      <div className="relative min-h-56 flex-1 overflow-hidden rounded-3xl">
        <Picture name={book.picture} label={book.title} className="absolute inset-0 h-full w-full p-6 sm:p-10" />
      </div>
      <div className="px-2 pb-2 pt-7 text-center">
        <h1 className={`text-[2rem] font-bold leading-tight tracking-tight sm:text-4xl ${km ? `${KHMER} leading-snug` : SERIF}`}>{book.title}</h1>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
          Level {book.band} · Ages {lo}–{hi} · {minutesToRead(book)} min
        </p>
      </div>
    </div>
  );
}

/**
 * How a page is arranged for each place its picture can take. Left and right sit
 * beside the words from a small tablet up; on a phone there is no room for both
 * at a readable size, so left falls above the words and right below them.
 */
const PLACE: Record<PicturePlace, { page: string; frame: string; words: string }> = {
  top: { page: "flex-col", frame: "aspect-[16/10] max-h-[30svh] w-full sm:aspect-[2/1] sm:max-h-none", words: "" },
  bottom: { page: "flex-col-reverse", frame: "aspect-[16/10] max-h-[30svh] w-full sm:aspect-[2/1] sm:max-h-none", words: "" },
  left: { page: "flex-col sm:flex-row sm:items-center", frame: "aspect-[16/10] max-h-[30svh] w-full sm:aspect-[3/4] sm:max-h-none sm:w-[44%] sm:shrink-0", words: "sm:my-auto" },
  right: { page: "flex-col-reverse sm:flex-row-reverse sm:items-center", frame: "aspect-[16/10] max-h-[30svh] w-full sm:aspect-[3/4] sm:max-h-none sm:w-[44%] sm:shrink-0", words: "sm:my-auto" },
};

function StoryPage({ book, sentences, picture, at = "top", scale, playing, playingWord, peek, onWord, end }: {
  book: Passage;
  sentences: SetSentence[];
  /** The reader's text size, as a multiple of the page's own. */
  scale: number;
  /** The page's illustration, drawn with the words as in a picture book. */
  picture: string | null;
  /** Where the illustration sits. */
  at?: PicturePlace;
  playing: string | null;
  playingWord: { sentence: string; index: number } | null;
  peek: string | null;
  onWord(w: string, target: HTMLElement): void;
  end: boolean;
}) {
  const km = book.language === "km";
  // Sentences run on as one paragraph, as in a book; a heading starts a new one.
  const blocks: Array<{ heading: string | null; sentences: SetSentence[] }> = [];
  for (const s of sentences) {
    if (s.heading || !blocks.length) blocks.push({ heading: s.heading, sentences: [s] });
    else blocks[blocks.length - 1].sentences.push(s);
  }
  // Sized for a phone first and growing with the screen, then by the reader's
  // own choice of size. Younger readers get the larger type.
  const base = book.band === "A" ? "clamp(1.3rem, 1.05rem + 1.1vw, 1.65rem)" : "clamp(1.15rem, 0.95rem + 0.9vw, 1.45rem)";
  const type = km ? `${KHMER} leading-[2.1]` : `${SERIF} leading-[1.7]`;

  return (
    <div className="flex flex-1 flex-col">
      <div data-picture-at={picture ? at : undefined} className={`flex gap-6 sm:gap-8 ${picture ? PLACE[at].page : "my-auto flex-col"} ${picture && at !== "top" ? "my-auto" : ""}`}>
      {picture && (
        <div className={`overflow-hidden rounded-3xl ${PLACE[at].frame}`}>
          <Picture name={picture} className="h-full w-full p-5" />
        </div>
      )}
      <div className={`mx-auto grid w-full max-w-[34em] gap-6 px-1 ${picture ? PLACE[at].words : ""}`}>
        {blocks.map((b, i) => (
          <div key={i}>
            {b.heading && (
              <h2 className={`mb-3 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400 ${km ? KHMER : ""}`}>
                {b.sentences[0].sentence.words.slice(0, b.sentences[0].sentence.words.length - b.sentences[0].tokens.length).map((word, wordIndex, heading) => (
                  <span
                    key={wordIndex}
                    data-speaking={playingWord?.sentence === b.sentences[0].sentence.id && playingWord.index === wordIndex || undefined}
                    className={`rounded-sm transition-colors ${playingWord?.sentence === b.sentences[0].sentence.id && playingWord.index === wordIndex ? "bg-amber-200 text-neutral-950 dark:bg-amber-400" : ""}`}
                  >
                    {wordIndex === heading.length - 1 ? word.replace(/:$/, "") : word}{wordIndex === heading.length - 1 ? "" : " "}
                  </span>
                ))}
              </h2>
            )}
            <p className={`m-0 ${type} text-pretty`} data-text-scale={scale} style={{ fontSize: `calc(${base} * ${scale})` }}>
              {b.sentences.map((s, j) => (
                <span key={s.sentence.id}>
                  <span
                    data-sentence={s.sentence.id}
                    data-playing={playing === s.sentence.id || undefined}
                    className="rounded-sm box-decoration-clone"
                  >
                    {s.tokens.map((t, k) => (
                      <span key={k}>
                        <Word
                          token={t}
                          active={peek === t.word}
                          speaking={playingWord?.sentence === s.sentence.id && playingWord.index === s.sentence.words.length - s.tokens.length + k}
                          onWord={onWord}
                        />
                        {km || k === s.tokens.length - 1 ? "" : " "}
                      </span>
                    ))}
                  </span>
                  {km || j === b.sentences.length - 1 ? "" : " "}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
      </div>
      {end && (
        <p className={`mt-auto pt-10 text-center text-base italic text-neutral-500 dark:text-neutral-400 ${km ? KHMER : SERIF}`}>
          <span className="mx-auto mb-4 block h-px w-12 bg-neutral-300 dark:bg-neutral-700" aria-hidden="true" />
          {km ? "ចប់" : "The end"}
        </p>
      )}
    </div>
  );
}

/**
 * A word on the page. Every word answers a tap, but only the bold ones — the
 * words the quiz asks about — are buttons a keyboard stops on; a Tab through
 * every word of a story would be a chore, not help.
 */
function Word({ token, active, speaking, onWord }: { token: SetToken; active: boolean; speaking: boolean; onWord(w: string, target: HTMLElement): void }) {
  const mark = active ? "underline decoration-2 underline-offset-[0.2em]" : "";
  const spoken = speaking ? "bg-amber-200 text-neutral-950 dark:bg-amber-400 dark:text-neutral-950" : "";
  if (token.emphasis === "key") {
    return (
      <button type="button" onClick={(event) => onWord(token.word, event.currentTarget)} aria-label={token.word} data-speaking={speaking || undefined} className={`cursor-pointer rounded-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${mark} ${spoken}`}>
        {token.text}
      </button>
    );
  }
  return (
    <span
      onClick={(event) => onWord(token.word, event.currentTarget)}
      data-word={token.word}
      data-speaking={speaking || undefined}
      className={`cursor-pointer rounded-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900 ${token.emphasis === "name" ? "italic" : ""} ${mark} ${spoken}`}
    >
      {token.text}
    </span>
  );
}
