import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, playCopy, useSkillRound, type RoundQuestion } from "../../kit";
import { isDeadlock, isSolvedRack, legalPours, pour, refuseReason } from "../internal/pour";
import { POOL, rackFor } from "../internal/racks";
import { specFor } from "../internal/specs";
import { topRun, type Bottle, type Rack } from "../internal/types";

interface BottleSortSetup {
  /** One rack spec, or several for a practice round to cycle through. */
  spec?: string;
  specs?: string[];
  questionsPerRound?: number;
  practice?: boolean;
  seed?: string;
  /** Show how many segments a picked bottle will pour. */
  showRunCount?: boolean;
}

export interface BottleSortParams extends BottleSortSetup {
  question?: BottleSortSetup;
}

export interface BottleSortQuestion extends RoundQuestion {
  rack: Bottle[];
  hues: number[];
  /** Pours used to scramble: the upper bound on the solution. */
  scramble: number;
}

/** Shape is bound to the deal position, never the hue, so a redrawn palette
 *  leaves a colour-blind child playing exactly the same puzzle. */
const SHAPES = ["circle", "square", "triangle", "diamond", "cross", "bar"] as const;
const GLYPH: Record<string, string> = {
  circle: "M0-5A5 5 0 1 0 0 5 5 5 0 1 0 0-5Z",
  square: "M-4.4-4.4h8.8v8.8h-8.8Z",
  triangle: "M0-5.4 5.4 4.6H-5.4Z",
  diamond: "M0-5.6 5.6 0 0 5.6-5.6 0Z",
  cross: "M-1.8-5.4h3.6v3.6h3.6v3.6H1.8v3.6h-3.6V1.8h-3.6v-3.6h3.6Z",
  bar: "M-5.6-2h11.2v4h-11.2Z",
};
const shapeOf = (colour: number) => SHAPES[colour % SHAPES.length];
const nameOf = (colour: number) => `${shapeOf(colour)} ${colour + 1}`;
const cssColour = (hues: number[], colour: number) => {
  const [r, g, b] = POOL[hues[colour] ?? 0];
  return `rgb(${r} ${g} ${b})`;
};

/* Geometry. Phase 7 gives the glass its depth; this is the shape it hangs on. */
const NECK_TOP = 9, NECK_H = 18, SHOULDER_H = 18, LAYER_H = 22, W = 60;
function geometry(cap: number) {
  const bodyTop = NECK_TOP + NECK_H + SHOULDER_H;
  const bodyH = cap * LAYER_H;
  const bodyBottom = bodyTop + bodyH;
  // Open at the mouth on purpose: a line drawn across the top is what makes a
  // bottle read as a flat cut-out, so the rim ellipse caps it instead.
  const outline = `M23 ${NECK_TOP} v${NECK_H}`
    + ` C23 ${NECK_TOP + NECK_H + 6} 6 ${bodyTop - 10} 6 ${bodyTop}`
    + ` v${bodyH} q0 10 10 10 h28 q10 0 10 -10 v-${bodyH}`
    + ` C54 ${bodyTop - 10} 37 ${NECK_TOP + NECK_H + 6} 37 ${NECK_TOP + NECK_H}`
    + ` V${NECK_TOP}`;
  return { outline, body: `${outline} Z`, bodyTop, bodyBottom, height: bodyBottom + 14 };
}

export function buildQuestion(params: BottleSortParams, index: number): BottleSortQuestion {
  const setup = { ...params, ...params.question };
  // A practice round cycles specs so the pace it measures spans the techniques
  // taught, rather than five draws of the same rack.
  const cycle = setup.specs?.length ? setup.specs : [setup.spec ?? "one-pour"];
  const spec = specFor(cycle[(index - 1) % cycle.length]) ?? specFor("one-pour")!;
  const { rack, hues, scramble } = rackFor(spec, setup.seed ?? "bottle-sort", index);
  return {
    id: `bottle-sort-${spec.id}-${index}`,
    taskKind: `sort_${spec.id}`,
    prompt: spec.colours === 2 ? "Sort both bottles." : `Sort all ${spec.colours} colours.`,
    // The answer is the property, not a signature of the dealt rack: a hint can
    // add a bottle mid-round and the goal has to survive that.
    expected: "every bottle one colour",
    itemCount: rack.length,
    rack,
    hues,
    scramble,
  };
}

export function bottleHints(rack: Rack): string[] {
  const source = legalPours(rack).find((m) => topRun(rack[m.from]).n < rack[m.from].seg.length);
  return composeHints(
    "Look for a bottle you could empty completely.",
    source ? `Bottle ${source.from + 1} has somewhere to go.` : undefined,
  );
}

export const promptFor = (q: BottleSortQuestion): string => q.prompt ?? "Sort every bottle.";
export const printedFor = (): null => null;

export const BottleSort: React.FC<ActivityProps<BottleSortParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 3;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const hintsEnabled = koda.config.isEnabled("move_hints", true);
  const showRunCount = !!setup.showRunCount;
  const speechRate = koda.config.get("speechRate", 0.95);

  const [rack, setRack] = useState<Rack>([]);
  const [dealt, setDealt] = useState<Rack>([]);
  const [history, setHistory] = useState<Rack[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    answerSoundDelayMs: (correct) => (correct ? 560 : 240),
    nextQuestion: useCallback((index: number) => buildQuestion(setup, index), [setup]),
    onComplete,
  });
  const question = round.question as BottleSortQuestion;

  // Keyed on the question id alone. `question.rack` is a fresh array on every
  // build, so depending on it re-ran this effect mid-play — wiping the undo
  // history and putting the liquid back while the child was pouring.
  useEffect(() => {
    setRack(question.rack);
    setDealt(question.rack);
    setHistory([]);
    setPicked(null);
    setNudge(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  useEffect(() => { if (!round.feedback) setNudge(null); }, [round.feedback]);
  useEffect(() => () => koda.speech.stop(), [koda]);

  const chime = (type: "clink" | "pop" | "success" | "error") => {
    if (koda.config.isEnabled("sound_chimes", true) && koda.sound.isEnabled()) koda.sound.play(type);
  };
  const buzz = (kind: "tap" | "success" | "error") => {
    if (!koda.config.isEnabled("haptic_feedback", true)) return;
    if (kind === "tap") koda.haptics.tap();
    else if (kind === "success") koda.haptics.success();
    else koda.haptics.pulse("error");
  };

  /**
   * A refusal explains itself and scores nothing.
   *
   * This is the skill's first rule. Trying a pour to see what happens is the
   * method, so recording it as a wrong answer would teach a child to stop
   * exploring — which is the opposite of what the lesson is for.
   */
  const refuse = (why: string) => {
    setNudge(why);
    chime("error");
    buzz("error");
    if (speechEnabled) {
      koda.speech.stop();
      void koda.speech.say(why, { rate: speechRate }).catch(() => {});
    }
    setPicked(null);
  };

  const tap = (index: number) => {
    if (round.feedback) return;
    if (picked === null) {
      const why = refuseReason(rack, index, index === 0 ? 1 : 0);
      // Only the reasons that are about the source itself stop a pick-up.
      if (why === "That bottle is corked." || why === "That bottle is empty." || why === "That bottle only receives.") {
        refuse(why);
        return;
      }
      setPicked(index);
      setNudge(null);
      return;
    }
    if (picked === index) { setPicked(null); return; }

    const why = refuseReason(rack, picked, index);
    if (why) { refuse(why); return; }

    const next = pour(rack, picked, index);
    setHistory((h) => [...h, rack]);
    setRack(next);
    setPicked(null);
    setNudge(null);

    if (isSolvedRack(next)) {
      chime("success");
      buzz("success");
      koda.speech.stop();
      round.submit({ correct: true, given: "every bottle one colour", expected: question.expected, title: "Sorted!", message: "Every bottle holds one colour." });
      return;
    }
    chime("clink");
    buzz("tap");
    if (isDeadlock(next)) {
      koda.speech.stop();
      round.submit({ correct: false, given: "no pours left", expected: question.expected, errorKind: "miscounted_items", title: "No pours left", message: "That path ran out. The rack is back as it was dealt." });
      setRack(dealt);
      setHistory([]);
    }
  };

  /**
   * Undo and start-over change the rack, not the score.
   *
   * The plan says to record them as support, but the shared `SupportKind`
   * union has no term for a reversal — hint, audio_replay, reveal, walkthrough
   * — and filing them under `hint` would put a step backwards into the hint
   * statistics, which is worse than not counting them. What matters either way
   * is that neither submits an answer, and neither does. Adding a kind is a
   * change to the shared learning vocabulary, to propose rather than assume.
   */
  const stepBack = (label: string, action: () => void) => {
    chime("pop");
    action();
    setNudge(label);
    setPicked(null);
  };

  const hints = practising || !hintsEnabled ? [] : bottleHints(rack);

  return (
    <SkillRound koda={koda} lesson={lesson} fallbackTitle="Bottle Sort" round={round} totalQuestions={total}
      prompt={promptFor(question)} onExit={() => koda.ui.exit()} hints={hints} nudge={nudge}
      iconName="FlaskConical" iconTone="cyan"
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), { rate: speechRate });
      }}>
      <section aria-label="Bottle rack" className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
        <p className="sr-only" aria-live="polite">
          {rack.filter((b) => b.seg.length === 0 || new Set(b.seg).size === 1).length} of {rack.length} bottles sorted.
        </p>

        {/* Six per row is the phone ceiling; a seventh drops a bottle under 44px. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(48px,64px))] items-end justify-center gap-3 rounded-2xl bg-slate-100 px-2 py-6 dark:bg-slate-900/50">
          {rack.map((b, i) => {
            const geo = geometry(b.cap);
            const shown = b.shown ?? b.seg.length;
            const sorted = b.seg.length > 0 && b.seg.length === b.cap && new Set(b.seg).size === 1;
            return (
              <button key={i} type="button" onClick={() => tap(i)}
                data-bottle={i} data-picked={picked === i} data-sorted={sorted}
                aria-label={`Bottle ${i + 1}, holds ${b.cap}. ${b.seg.length ? b.seg.map((c, k) => (k < shown ? nameOf(c) : "hidden")).join(", ") : "Empty"}.`
                  + (showRunCount && picked === i ? ` ${topRun(b).n} will pour.` : "")}
                className={`block w-full min-w-11 cursor-pointer leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${picked === i ? "-translate-y-2" : ""} transition-transform`}>
                <svg viewBox={`0 0 ${W} ${geo.height}`} className="h-auto w-full" aria-hidden="true">
                  <defs><clipPath id={`bs-clip-${i}`}><path d={geo.body} /></clipPath></defs>
                  <path d={geo.body} className="fill-white/60 dark:fill-white/10" />
                  <g clipPath={`url(#bs-clip-${i})`}>
                    {b.seg.map((colour, k) => {
                      const y = geo.bodyBottom - (k + 1) * LAYER_H;
                      if (k >= shown) return <rect key={k} x="0" y={y} width={W} height={LAYER_H} className="fill-slate-300 dark:fill-slate-700" />;
                      return (
                        <g key={k}>
                          <rect x="0" y={y} width={W} height={LAYER_H} fill={cssColour(question.hues, colour)} />
                          <rect x="0" y={y} width={W} height="2.5" fill="#fff" opacity=".25" />
                          <path d={GLYPH[shapeOf(colour)]} transform={`translate(30 ${y + LAYER_H / 2})`} fill="#fff" fillOpacity=".9" />
                        </g>
                      );
                    })}
                  </g>
                  <path d={geo.outline} fill="none" strokeWidth="2.5" strokeLinecap="round"
                    className={sorted ? "stroke-emerald-500" : picked === i ? "stroke-indigo-500" : "stroke-slate-400 dark:stroke-slate-500"} />
                  <ellipse cx="30" cy={NECK_TOP} rx="7" ry="3.5" fill="none" strokeWidth="2.5"
                    className={picked === i ? "stroke-indigo-500" : "stroke-slate-400 dark:stroke-slate-500"} />
                  {/* Level 9 asks the child to notice that a run travels as one,
                      so the count is shown at the moment they commit to it. */}
                  {showRunCount && picked === i && topRun(b).n > 0 && (
                    <text x="30" y={geo.bodyTop - 6} textAnchor="middle" data-run-count={topRun(b).n}
                      className="fill-indigo-600 text-[13px] font-bold dark:fill-indigo-300">{topRun(b).n}</text>
                  )}
                </svg>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center gap-2">
          <button type="button" data-action="undo" disabled={!history.length || !!round.feedback}
            onClick={() => stepBack("Stepped back.", () => { setRack(history[history.length - 1]); setHistory((h) => h.slice(0, -1)); })}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">
            Undo
          </button>
          <button type="button" data-action="reset" disabled={!!round.feedback}
            onClick={() => stepBack("Back to the dealt rack.", () => { setRack(dealt); setHistory([]); })}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">
            Start over
          </button>
        </div>
      </section>
    </SkillRound>
  );
};
