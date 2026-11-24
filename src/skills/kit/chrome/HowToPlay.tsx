import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { CircleHelp, Pointer, RotateCcw } from "lucide-react";
import { UIButton, UIModal } from "../../../components/ui";
import { translate } from "../../../lib/i18n";
import { activeLearnerId } from "../../../lib/learning";
import { useMotionOK } from "../motion";

/**
 * "How to play": a short animated demo of a game, played by a pointing hand.
 *
 * Not a video. A skill supplies a script of steps and a `scene` that draws its
 * own little board for each step; the player moves the hand, shows the
 * caption, keeps time and owns Skip, Watch again and Let's play. So the demo
 * works offline, costs a few kilobytes, follows the language on screen, and
 * always looks like the game it explains, because it is drawn with the game's
 * own pieces.
 *
 * A step runs in three phases: `start` (the hand arrives at its first point),
 * `move` (it taps, or drags along its path, for `moveMs`) and `done` (the
 * step's result stays on screen for `holdMs`). With reduced motion the hand is
 * not drawn and each step shows its result straight away, for longer.
 */

export interface DemoStep {
  /** What the caption says while this step plays. Read aloud through `speak` when given. */
  caption: string;
  /** Where the hand goes, as fractions of the scene (0–1): one point taps, more points drag. */
  hand?: readonly (readonly [number, number])[];
  /** Taps at a one-point hand. Default 1. */
  taps?: number;
  /** How long the tap or drag takes. Default 1200ms. */
  moveMs?: number;
  /** How long the result stays before the next step. Default 1400ms. */
  holdMs?: number;
}

export type DemoPhase = "start" | "move" | "done";

export interface HowToPlayProps {
  open: boolean;
  steps: readonly DemoStep[];
  /** The skill's board at this step and phase. `moveMs` is the move's length, so a drawn line can keep pace with the hand. */
  scene(step: number, phase: DemoPhase, moveMs: number): React.ReactNode;
  onClose(): void;
  /** Says a caption. The skill gates it on its own voice switch. */
  speak?(line: string): void;
  title?: string;
}

const ARRIVE_MS = 450;
const MOVE_MS = 1200;
const HOLD_MS = 1400;
/** Without motion there is no hand to watch, so each result stays long enough to read. */
const STILL_MS = 2600;

export const HowToPlay: React.FC<HowToPlayProps> = ({ open, steps, scene, onClose, speak, title }) => {
  const motionOK = useMotionOK();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<DemoPhase>("start");
  const [run, setRun] = useState(0);
  const finished = step >= steps.length;
  const current = steps[Math.min(step, steps.length - 1)];
  const moveMs = current?.moveMs ?? MOVE_MS;

  // Every open starts from the beginning.
  useEffect(() => {
    if (open) {
      setStep(0);
      setPhase("start");
    }
  }, [open, run]);

  // The clock: start → move → done → next step. A step with nothing to watch
  // move (no hand, or reduced motion) shows its result at once, on one timer.
  const still = !motionOK || !current?.hand?.length;
  useEffect(() => {
    if (!open || finished || !current) return undefined;
    const next = () => {
      setStep((s) => s + 1);
      setPhase("start");
    };
    const hold = current.holdMs ?? HOLD_MS;
    const id = still
      ? window.setTimeout(next, current.hand?.length ? Math.max(hold, STILL_MS) : hold)
      : window.setTimeout(() => {
        if (phase === "start") setPhase("move");
        else if (phase === "move") setPhase("done");
        else next();
      }, phase === "start" ? ARRIVE_MS : phase === "move" ? moveMs : hold);
    return () => window.clearTimeout(id);
  }, [open, finished, current, phase, moveMs, still]);

  // Each caption is said once, as its step begins.
  const said = useRef(-1);
  useEffect(() => {
    if (!open) {
      said.current = -1;
      return;
    }
    if (!finished && phase === "start" && said.current !== step) {
      said.current = step;
      speak?.(current.caption);
    }
  }, [open, finished, phase, step, current, speak]);

  if (!open) return null;

  const t = (key: string, vars?: Record<string, string | number>) => translate(`round.howToPlay.${key}`, vars);
  const shown = finished ? steps.length - 1 : step;
  const caption = finished ? t("ready") : current.caption;

  return (
    <UIModal
      isOpen
      onClose={onClose}
      title={title ?? t("title")}
      maxWidth="max-w-md"
      footer={
        finished ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <UIButton type="button" variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setRun((r) => r + 1)}>
              {t("again")}
            </UIButton>
            <UIButton type="button" variant="primary" onClick={onClose} autoFocus>
              {t("play")}
            </UIButton>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-sm font-semibold text-muted" data-testid="how-to-play-step">{t("step", { n: step + 1, total: steps.length })}</span>
            <UIButton type="button" variant="secondary" onClick={onClose}>
              {t("skip")}
            </UIButton>
          </div>
        )
      }
    >
      <div className="flex flex-col items-center gap-4" data-testid="how-to-play">
        <div className="relative aspect-square w-full max-w-[17rem]">
          {scene(shown, finished || still ? "done" : phase, moveMs)}
          {!finished && motionOK && current.hand?.length ? <Hand step={step} run={run} phase={phase} points={current.hand} taps={current.taps ?? 1} moveMs={moveMs} /> : null}
        </div>
        <p className="min-h-[3.5rem] text-center text-lg font-extrabold leading-snug text-ink" aria-live="polite" data-testid="how-to-play-caption">
          {caption}
        </p>
        <div className="flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === shown ? "w-6 bg-violet-600" : i < shown ? "w-2 bg-violet-300" : "w-2 bg-line"}`} />
          ))}
        </div>
      </div>
    </UIModal>
  );
};

/** The pointing hand: arrives, then taps in place or drags along its path. */
const Hand: React.FC<{ step: number; run: number; phase: DemoPhase; points: readonly (readonly [number, number])[]; taps: number; moveMs: number }> = ({ step, run, phase, points, taps, moveMs }) => {
  const pct = (v: number) => `${v * 100}%`;
  const [x0, y0] = points[0];
  const last = points[points.length - 1];
  const dragging = points.length > 1;
  const at = phase === "start" ? { left: pct(x0), top: pct(y0) } : dragging ? { left: points.map(([x]) => pct(x)), top: points.map(([, y]) => pct(y)) } : { left: pct(x0), top: pct(y0) };
  const end = phase === "done" ? { left: pct(last[0]), top: pct(last[1]) } : at;
  const press = phase === "move"
    ? dragging ? { scale: 0.85 } : { scale: Array.from({ length: taps * 2 + 1 }, (_, i) => (i % 2 ? 0.75 : 1)) }
    : { scale: 1 };
  return (
    <motion.span
      key={`${run}-${step}`}
      className="pointer-events-none absolute z-30 -ml-2 -mt-1 text-ink drop-shadow-lg"
      data-testid="how-to-play-hand"
      initial={{ left: phase === "start" ? "110%" : pct(x0), top: phase === "start" ? "110%" : pct(y0), opacity: 0 }}
      animate={{ ...end, opacity: 1 }}
      transition={{ duration: (phase === "move" ? moveMs : ARRIVE_MS) / 1000, ease: "easeInOut" }}
      aria-hidden="true"
    >
      <motion.span className="block" animate={press} transition={{ duration: phase === "move" ? moveMs / 1000 : 0.2 }}>
        <Pointer className="h-10 w-10 fill-white stroke-[1.75]" />
      </motion.span>
    </motion.span>
  );
};

/* ---------- watched once, per learner and skill ---------- */

const SEEN_KEY = "koda.howToPlay.seen.v1";
const seenThisSession = new Set<string>();
const keyFor = (skillId: string) => `${activeLearnerId()}:${skillId}`;

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Whether this learner has watched (or skipped) the demo for this skill. */
export function hasSeenHowToPlay(skillId: string): boolean {
  const key = keyFor(skillId);
  return seenThisSession.has(key) || readSeen().includes(key);
}

export function markHowToPlaySeen(skillId: string): void {
  const key = keyFor(skillId);
  seenThisSession.add(key);
  try {
    const list = readSeen();
    if (!list.includes(key)) window.localStorage.setItem(SEEN_KEY, JSON.stringify([...list, key]));
  } catch {
    /* Blocked storage: the in-memory set still holds it for this visit. */
  }
}

/** For tests: forget every learner's watched demos. */
export function forgetHowToPlay(): void {
  seenThisSession.clear();
  try {
    window.localStorage.removeItem(SEEN_KEY);
  } catch {
    /* Nothing stored to forget. */
  }
}

/**
 * Whether the demo is showing. It opens by itself the first time a learner
 * plays the skill — but never in practice or a group race (`auto` false),
 * where it would cost time the child did not choose to spend.
 */
export function useHowToPlay(skillId: string, auto: boolean) {
  const [open, setOpen] = useState(() => auto && !hasSeenHowToPlay(skillId));
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    markHowToPlaySeen(skillId);
    setOpen(false);
  }, [skillId]);
  return { open, show, close };
}

/** The button that opens the demo again, beside the board. */
export const HowToPlayButton: React.FC<{ onClick(): void }> = ({ onClick }) => (
  <UIButton type="button" size="sm" variant="secondary" icon={<CircleHelp className="h-4 w-4" />} onClick={onClick} className="rounded-full">
    {translate("round.howToPlay.title")}
  </UIButton>
);
