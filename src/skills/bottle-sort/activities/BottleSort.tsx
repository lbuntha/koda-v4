import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, playCopy, useMotionOK, useSkillRound, type RoundQuestion } from "../../kit";
import { isCorked, isDeadlock, isSolvedRack, legalPours, pour, pourSteps, refuseReason } from "../internal/pour";
import { rackFor } from "../internal/racks";
import { GLYPH, cssColour, nameOf, shapeOf } from "../internal/paint";
import { specFor } from "../internal/specs";
import { UNIFORM, bottleDone, goalFor, labelFor, numbered, type Goal } from "../internal/goal";
import { minimumPours } from "../internal/solve";
import { PIVOT_Y, POUR_ANGLE, aimPour, streamPath } from "../internal/bottle";
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
  /** Pours allowed, on the lessons that set one. Absent means unlimited. */
  budget?: number;
  /** What finished means here, and what may be poured onto what. */
  goal: Goal;
  /** The spec, so a segment can be labelled the way its lesson names it. */
  specId: string;
}

const wait = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); });

/*
 * A bottle in the shape the genre uses: a straight-sided cylinder with a short
 * neck and a darker collar, not a tapered wine bottle. Straight sides matter —
 * colour bands read as equal measures of liquid only when the width is
 * constant, which is the whole point of a bottle you sort by eye.
 */
const NECK_TOP = 7, NECK_H = 10, SHOULDER_H = 14, LAYER_H = 22, W = 60;
const NECK_L = 20, NECK_R = 40;
const BASE_CURVE = 9;
function geometry(cap: number) {
  const neckBottom = NECK_TOP + NECK_H;
  const bodyTop = neckBottom + SHOULDER_H;
  // The base curves below the straight sides, so the straight part is short by
  // exactly that much — otherwise the lowest band stops above the curve and the
  // bottle looks like it is standing in an empty glass foot.
  const bodyH = cap * LAYER_H - BASE_CURVE;
  const bodyBottom = bodyTop + bodyH;
  const outline = `M${NECK_L} ${NECK_TOP} v${NECK_H}`
    + ` C${NECK_L} ${neckBottom + 6} 6 ${bodyTop - 8} 6 ${bodyTop}`
    + ` v${bodyH} q0 9 9 9 h30 q9 0 9 -9 v-${bodyH}`
    + ` C54 ${bodyTop - 8} ${NECK_R} ${neckBottom + 6} ${NECK_R} ${neckBottom}`
    + ` V${NECK_TOP}`;
  // Liquid fills to the true inside of the base, not to where the sides stop.
  const liquidBottom = bodyBottom + BASE_CURVE;
  return { outline, body: `${outline} Z`, neckBottom, bodyTop, bodyBottom, liquidBottom, height: liquidBottom + 6 };
}

/**
 * Bubbles, which are what make a coloured band read as liquid.
 *
 * Placed from the segment's own index so they do not move about between
 * renders, and drawn only where there is liquid to hold them.
 */
function bubblesFor(seedIndex: number, y: number) {
  const spots = [
    { cx: 20, r: 2.0, delay: 0 },
    { cx: 38, r: 1.4, delay: 1.3 },
    { cx: 29, r: 1.1, delay: 2.4 },
  ];
  return spots.map((b, k) => ({ ...b, key: `${seedIndex}-${k}`, from: y + LAYER_H - 3, to: y + 3 }));
}

export function buildQuestion(params: BottleSortParams, index: number): BottleSortQuestion {
  const setup = { ...params, ...params.question };
  // A practice round cycles specs so the pace it measures spans the techniques
  // taught, rather than five draws of the same rack.
  const cycle = setup.specs?.length ? setup.specs : [setup.spec ?? "one-pour"];
  const spec = specFor(cycle[(index - 1) % cycle.length]) ?? specFor("one-pour")!;
  const goal = goalFor(spec);
  const { rack, hues, scramble } = rackFor(spec, setup.seed ?? "bottle-sort", index);
  // A budget is only meaningful against the *shortest* solution, so it is
  // measured, not guessed. If the search runs out of room the rack still has to
  // be playable, and undoing the scramble is always a solution — so that bound
  // stands in, with room to spare rather than a budget nobody could meet.
  let budget: number | undefined;
  if (spec.budget) {
    const shortest = minimumPours(rack, goal).moves;
    budget = shortest === null ? scramble + 2 : shortest + (spec.budget === "minimum+2" ? 2 : 0);
  }
  return {
    budget,
    goal,
    specId: spec.id,
    id: `bottle-sort-${spec.id}-${index}`,
    taskKind: `sort_${spec.id}`,
    // The goal is the lesson from 25 on, so the prompt has to say it.
    prompt: goal.kind === "order"
      ? `Put every bottle in order: ${goal.order.map((c) => labelFor(goal, spec, c)).join(", ")}.`
      : goal.kind === "group"
        ? "Sort the odd numbers and the even numbers into different bottles."
        : spec.colours === 2 ? "Sort both bottles." : `Sort all ${spec.colours} colours.`,
    // The answer is the property, not a signature of the dealt rack: a hint can
    // add a bottle mid-round and the goal has to survive that.
    expected: goal.kind === "uniform" ? "every bottle one colour" : "every bottle finished",
    itemCount: rack.length,
    rack,
    hues,
    scramble,
  };
}

/**
 * The hint ladder, per the kit's contract in `kit/round/hints.ts`.
 *
 * It used to return the same two lines whatever the lesson and whatever the
 * rack, which made the button useless from about level 11 on: a child stuck on
 * a cork was told to look for a bottle to empty. Now each rung does its own
 * job — the lesson's words, then this rack, then the actual move — and the
 * middle rung leads with whichever rule is the reason they are stuck.
 */
export function bottleHints(
  rack: Rack,
  state: { kidTip?: string; budget?: number; poured?: number; goal?: Goal } = {},
): string[] {
  const goal = state.goal ?? UNIFORM;
  const corked = rack.findIndex((b, i) => b.lockedBy !== undefined && isCorked(rack, i));
  const oneWay = rack.findIndex((b) => b.oneWay);
  const empty = rack.findIndex((b) => b.seg.length === 0);
  const left = state.budget === undefined ? undefined : state.budget - (state.poured ?? 0);

  // Rung 2: what to do *here*, read off this rack. The rule that is actually
  // biting comes first, and it names the bottles rather than describing them.
  const here = corked >= 0
    ? `Bottle ${corked + 1} is corked. Finish bottle ${(rack[corked].lockedBy ?? 0) + 1} to open it.`
    : oneWay >= 0
      ? `Bottle ${oneWay + 1} only receives. Pour into it once you are sure of the colour.`
      : left !== undefined && left <= 2
        ? `${left === 1 ? "One pour" : `${left} pours`} left. Work the rest out before you move.`
        : empty < 0
          ? "Nothing is empty. Find the bottle you can clear first."
          : `Bottle ${empty + 1} is free. Use it for the colour that is in the way.`;

  // Rung 3: the worked step. Sorting is done rather than chosen, so this names
  // a real pour instead of stopping short of one.
  const move = legalPours(rack, goal).find((m) => topRun(rack[m.from]).n < rack[m.from].seg.length)
    ?? legalPours(rack, goal)[0];

  return composeHints(
    state.kidTip ?? "Look for a bottle you could empty completely.",
    here,
    move ? `Try pouring bottle ${move.from + 1} onto bottle ${move.to + 1}.` : undefined,
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
  // Two switches, and they are not the same thing: the OS preference belongs to
  // the child, the feature belongs to the adult setting the skill up.
  const motionOK = useMotionOK();
  const animate = motionOK && koda.config.isEnabled("pour_animation", true);
  // Bubbles are ambient motion, so they follow the same preference.
  const bubbles = motionOK;
  const speechRate = koda.config.get("speechRate", 0.95);

  const [rack, setRack] = useState<Rack>([]);
  const [dealt, setDealt] = useState<Rack>([]);
  const [history, setHistory] = useState<Rack[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  /** Pours spent on this rack. Only the budget lessons show it. */
  const [poured, setPoured] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);
  /** The pour being drawn, and the stream that connects the two mouths. */
  const [pouring, setPouring] = useState<{ from: number; to: number; dir: number; angle: number; dx: number; dy: number } | null>(null);
  const [stream, setStream] = useState<{ d: string; colour: string; spine: string; length: number; end: { x: number; y: number }; fading?: boolean } | null>(null);
  const rackRef = useRef<HTMLDivElement | null>(null);
  const mouths = useRef(new Map<number, SVGCircleElement>());
  const bottles = useRef(new Map<number, HTMLButtonElement>());
  const alive = useRef(true);
  // Set true on *mount*, not just false on unmount. StrictMode mounts, unmounts
  // and remounts in development, so a cleanup-only guard latches false forever
  // and every pour bails after its first await — the bottle stays tilted in
  // mid-air with no stream, which is exactly what it did.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

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
  const spec = specFor(question.specId)!;

  // Keyed on the question id alone. `question.rack` is a fresh array on every
  // build, so depending on it re-ran this effect mid-play — wiping the undo
  // history and putting the liquid back while the child was pouring.
  useEffect(() => {
    setRack(question.rack);
    setDealt(question.rack);
    setHistory([]);
    setPicked(null);
    setPoured(0);
    setNudge(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  useEffect(() => { if (!round.feedback) setNudge(null); }, [round.feedback]);
  useEffect(() => () => koda.speech.stop(), [koda]);

  const chime = (type: "clink" | "pop" | "success" | "error" | "pour") => {
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

  /**
   * The rack from a keyboard.
   *
   * Enter and Space are left to the button, which already fires a click and so
   * runs `tap` — adding a second path here would pour twice on a real
   * keyboard. What a plain button cannot do is move between bottles without
   * tabbing through all eight, or let go of a bottle once it is picked up,
   * which is what the arrows and Escape are for.
   */
  const onRackKey = (e: React.KeyboardEvent) => {
    if (round.feedback || pouring) return;
    const focused = [...bottles.current.entries()].find(([, node]) => node === document.activeElement);
    const here = focused ? focused[0] : 0;
    const last = rack.length - 1;

    const go = (to: number) => {
      e.preventDefault();
      bottles.current.get(Math.max(0, Math.min(last, to)))?.focus();
    };

    switch (e.key) {
      // Wraps, because a rack is a ring of choices rather than a list with
      // ends, and running off the last bottle to reach the first is a step a
      // child should not have to count.
      case "ArrowRight": case "ArrowDown": return go(here === last ? 0 : here + 1);
      case "ArrowLeft": case "ArrowUp": return go(here === 0 ? last : here - 1);
      case "Home": return go(0);
      case "End": return go(last);
      case "Escape":
        if (picked === null) return;
        e.preventDefault();
        setPicked(null);
        setNudge(null);
        return;
      default:
    }
  };

  const tap = (index: number) => {
    if (round.feedback || pouring) return;
    if (picked === null) {
      const why = refuseReason(rack, index, index === 0 ? 1 : 0, question.goal);
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

    const why = refuseReason(rack, picked, index, question.goal);
    if (why) { refuse(why); return; }

    const from = picked;
    const next = pour(rack, from, index, question.goal);
    // Counted here rather than inside the animation, so a pour costs the same
    // whether or not it is drawn. Undo puts it back.
    const spent = poured + 1;
    setPoured(spent);
    setHistory((h) => [...h, rack]);
    setPicked(null);
    setNudge(null);
    void runPour(from, index, next, spent);
  };

  /**
   * Tips the bottle, runs the stream, and lets the liquid arrive.
   *
   * Every judgement below happens on `next`, which `pour` already decided — so
   * the animation can only change how long the same outcome takes to appear.
   * With motion off it is applied in one step, and the resulting rack is
   * identical either way.
   */
  /** Resolves when `el` has finished transforming, or when `ms` has passed. */
  const settled = (el: HTMLElement | undefined, ms: number) =>
    new Promise<void>((resolve) => {
      if (!el) { setTimeout(resolve, ms); return; }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.removeEventListener("transitionend", onEnd);
        resolve();
      };
      const onEnd = (e: TransitionEvent) => { if (e.propertyName === "transform") finish(); };
      el.addEventListener("transitionend", onEnd);
      // A transition that never fires — reduced motion, a backgrounded tab —
      // must not strand the pour.
      setTimeout(finish, ms + 140);
    });

  const runPour = async (from: number, to: number, next: Rack, spent?: number) => {
    const finish = () => {
      setRack(next);
      judge(next, spent);
    };
    if (!animate) { chime("pour"); finish(); return; }

    const steps = pourSteps(rack, from, to, question.goal);
    const dir: 1 | -1 = to >= from ? 1 : -1;
    let angle = dir * POUR_ANGLE;
    let dx = dir * 34, dy = -26;
    const srcBox = bottles.current.get(from)?.getBoundingClientRect();
    const srcMouth = mouths.current.get(from)?.getBoundingClientRect();
    const dstMouth = mouths.current.get(to)?.getBoundingClientRect();
    if (srcBox && srcMouth && dstMouth) {
      const aim = aimPour(srcBox, srcMouth, dstMouth, dir as 1 | -1);
      angle = aim.angle; dx = aim.dx; dy = aim.dy;
    }

    setPouring({ from, to, dir, angle, dx, dy });

    // Wait for the tilt to actually finish, not for a timer that guesses when.
    // A CSS transition only starts on the frame after React applies the style,
    // so a 340ms sleep measured the lip while the bottle still had a frame or
    // two to travel — the stream anchored about 11px short of the mouth and
    // then sat there, detached, for the whole pour.
    await settled(bottles.current.get(from), 340);
    if (!alive.current) return;

    const box = rackRef.current?.getBoundingClientRect();
    const a = mouths.current.get(from)?.getBoundingClientRect();
    const b = mouths.current.get(to)?.getBoundingClientRect();
    if (box && a && b) {
      const mouth = { x: a.left + a.width / 2 - box.left, y: a.top + a.height / 2 - box.top };
      const into = { x: b.left + b.width / 2 - box.left, y: b.top + b.height / 2 - box.top };
      // Liquid leaves the lip, not the middle of the mouth: with the bottle
      // tilted the mouth is nearly side-on, and the low outer edge is the only
      // part of it the liquid ever touches. Starting from the centre was why
      // the stream appeared to grow out of the neck rather than off the rim.
      const lip = { x: mouth.x + dir * a.width * 0.3, y: mouth.y + a.height * 0.22 };
      // Ending just below the rim reads as going in rather than stopping on it.
      const target = { x: into.x, y: into.y + 3 };
      setStream({
        colour: cssColour(question.hues, topRun(rack[from]).colour),
        end: target,
        ...streamPath(lip, target),
      });
    }

    chime("pour");

    // The stream has to reach the other mouth before liquid appears in it, or
    // the destination fills from nothing while the ribbon is still falling.
    await wait(70);
    if (!alive.current) return;

    // Segments leave close enough together to read as one continuous stream,
    // but far enough apart that a run of three is still visibly three.
    for (const step of steps) {
      await wait(115);
      if (!alive.current) return;
      setRack(step);
    }

    // Let the last of the liquid land, and let the stream run dry rather than
    // blink out — a ribbon that disappears mid-frame is the single thing that
    // most made the pour read as stepped rather than poured.
    setStream((s) => (s ? { ...s, fading: true } : s));
    await wait(200);
    if (!alive.current) return;
    setStream(null);
    setPouring(null);
    await wait(280);
    if (!alive.current) return;
    finish();
  };

  /** The scoring contract, applied once the liquid has landed. */
  const judge = (next: Rack, spent?: number) => {
    if (isSolvedRack(next, question.goal)) {
      chime("success");
      buzz("success");
      koda.speech.stop();
      round.submit({ correct: true, given: "every bottle one colour", expected: question.expected, title: "Sorted!", message: "Every bottle holds one colour." });
      return;
    }
    chime("clink");
    buzz("tap");
    if (isDeadlock(next, question.goal)) {
      koda.speech.stop();
      round.submit({ correct: false, given: "no pours left", expected: question.expected, errorKind: "miscounted_items", title: "No pours left", message: "That path ran out. The rack is back as it was dealt." });
      setRack(dealt);
      setHistory([]);
      setPoured(0);
      return;
    }
    // Spending the budget without sorting the rack ends the attempt the same
    // way a deadlock does: scored once, rack back as dealt. Checked after the
    // solved test above, so a pour that finishes on the very last of the
    // budget still counts as sorted.
    if (spent !== undefined && question.budget !== undefined && spent >= question.budget) {
      koda.speech.stop();
      round.submit({ correct: false, given: `${spent} pours`, expected: question.expected, errorKind: "miscounted_items", title: "Out of pours", message: "You are out of pours. The rack is back as it was dealt." });
      setRack(dealt);
      setHistory([]);
      setPoured(0);
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

  const hints = practising || !hintsEnabled
    ? []
    : bottleHints(rack, { kidTip: copy.kidTip, budget: question.budget, poured, goal: question.goal });

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
          {rack.filter((b) => bottleDone(question.goal, b)).length} of {rack.length} bottles sorted.
        </p>

        {/* Six per row is the phone ceiling; a seventh drops a bottle under 44px. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div ref={rackRef} onKeyDown={onRackKey} className="relative grid grid-cols-[repeat(auto-fit,minmax(48px,64px))] items-end justify-center gap-3 rounded-2xl bg-slate-100 px-2 py-6 dark:bg-slate-900/50">
          {stream && (
            <svg key={`${pouring?.from}-${pouring?.to}`}
              className="pointer-events-none absolute inset-0 z-[4] h-full w-full overflow-visible" aria-hidden="true">
              <defs>
                <path id="bs-flow" d={stream.spine} fill="none" />
                {/* Revealed along its own length, so the liquid travels out of
                    the lip and falls into the other bottle. A top-down wipe
                    used to uncover the whole near-horizontal first half of the
                    arc in a single frame, which is what made the stream look
                    like it was simply switched on. A mask, not a clip, because
                    clipping ignores stroke geometry. */}
                <mask id="bs-fall" maskUnits="userSpaceOnUse">
                  {/* The same dash does both ends of the pour. Running the
                      offset down to 0 reveals the arc from the lip forward;
                      running it on to -length retracts it from the lip while
                      the tail keeps falling into the bottle, which is how a
                      pour actually stops. Fading the whole ribbon out at once
                      was the last thing that read as a switch rather than
                      liquid. */}
                  <path key={stream.fading ? "drain" : "fall"}
                    d={stream.spine} fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round"
                    strokeDasharray={stream.length}
                    strokeDashoffset={animate && !stream.fading ? stream.length : 0}>
                    {animate && (
                      <animate attributeName="stroke-dashoffset"
                        from={stream.fading ? 0 : stream.length} to={stream.fading ? -stream.length : 0}
                        dur={stream.fading ? "0.19s" : "0.16s"} fill="freeze"
                        calcMode="spline" keySplines={stream.fading ? "0.4 0 1 1" : "0.35 0 0.7 1"} keyTimes="0;1" />
                    )}
                  </path>
                </mask>
              </defs>
              <g mask="url(#bs-fall)">
                <path d={stream.d} fill={stream.colour} opacity=".95" data-stream="" />
                {/* The surface of the falling liquid. A dash running down the
                    spine is what reads as flow: without it the ribbon is a
                    rope, however fast the liquid behind it arrives. */}
                {animate && (
                  <path d={stream.spine} fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6"
                    strokeLinecap="round" strokeDasharray="5 9">
                    <animate attributeName="stroke-dashoffset" from="14" to="0" dur="0.3s" repeatCount="indefinite" />
                  </path>
                )}
                {/* Where it lands. Liquid falling onto liquid throws a little
                    back up, and without it the stream just ended in mid-air at
                    the mouth — the eye reads an arrival, or it reads a pasted
                    shape. Drops arc out and fall back, and a ring spreads on
                    the surface underneath them. */}
                {animate && !stream.fading && (
                  <g>
                    <ellipse cx={stream.end.x} cy={stream.end.y} rx="1" ry="0.5"
                      fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.2">
                      <animate attributeName="rx" values="1;7" dur="0.42s" repeatCount="indefinite" />
                      <animate attributeName="ry" values="0.5;2.4" dur="0.42s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values=".5;0" dur="0.42s" repeatCount="indefinite" />
                    </ellipse>
                    {[-1, 1, -1].map((side, n) => (
                      <circle key={n} r={1.5 - n * 0.25} fill={stream.colour} opacity=".85">
                        <animate attributeName="cx" dur="0.4s" begin={`${n * 0.13}s`} repeatCount="indefinite"
                          values={`${stream.end.x};${stream.end.x + side * (4 + n)};${stream.end.x + side * (6 + n)}`} />
                        {/* Up, then down: the drop is thrown, not slid. */}
                        <animate attributeName="cy" dur="0.4s" begin={`${n * 0.13}s`} repeatCount="indefinite"
                          values={`${stream.end.y};${stream.end.y - 5 - n};${stream.end.y + 2}`} />
                        <animate attributeName="opacity" values=".85;.7;0" dur="0.4s"
                          begin={`${n * 0.13}s`} repeatCount="indefinite" />
                      </circle>
                    ))}
                  </g>
                )}
                {/* Bubbles carried down with it, staggered so the stream never
                    shows a gap. */}
                {animate && [0, 0.11, 0.22, 0.33, 0.44].map((begin) => (
                  <circle key={begin} r="1.6" fill="#fff" opacity=".5">
                    <animateMotion dur="0.55s" begin={`${begin}s`} repeatCount="indefinite">
                      <mpath href="#bs-flow" />
                    </animateMotion>
                  </circle>
                ))}
              </g>
            </svg>
          )}
          {rack.map((b, i) => {
            const geo = geometry(b.cap);
            const shown = b.shown ?? b.seg.length;
            // Hidden segments sit underneath, so they are the low indices.
            const buried = b.seg.length - shown;
            const sorted = b.seg.length > 0 && bottleDone(question.goal, b);
            return (
              <button key={i} type="button" onClick={() => tap(i)}
                ref={(node) => { if (node) bottles.current.set(i, node); else bottles.current.delete(i); }}
                data-bottle={i} data-picked={picked === i} data-sorted={sorted}
                // Announces "pressed" when a bottle is picked up, so the
                // selection is audible and not only a raised bottle.
                aria-pressed={picked === i}
                aria-label={`Bottle ${i + 1}, holds ${b.cap}. ${b.seg.length ? b.seg.map((c, k) => (k < buried ? "hidden" : numbered(spec) ? labelFor(question.goal, spec, c) : nameOf(c))).join(", ") : "Empty"}.`
                  + (showRunCount && picked === i ? ` ${topRun(b).n} will pour.` : "")
                  // A child using the label instead of the picture has to be
                  // told the same rules the badges show.
                  + (b.lockedBy !== undefined && isCorked(rack, i) ? ` Corked until bottle ${b.lockedBy + 1} is finished.` : "")
                  + (b.oneWay ? " Receives only." : "")}
                data-pouring={pouring?.from === i || undefined}
                style={pouring?.from === i
                  ? { transform: `translate(${pouring.dx}px, ${pouring.dy}px) rotate(${pouring.angle}deg)`, transformOrigin: `50% ${PIVOT_Y * 100}%`, zIndex: 6 }
                  : pouring?.to === i ? { zIndex: 5 } : undefined}
                className={`block w-full min-w-11 cursor-pointer leading-none focus:outline-none ${pouring ? "" : "focus-visible:ring-2 focus-visible:ring-indigo-500"} ${picked === i && !pouring ? "-translate-y-2" : ""} ${animate ? "transition-transform duration-[340ms] ease-in-out" : ""}`}>
                <svg viewBox={`0 0 ${W} ${geo.height}`} className="h-auto w-full" aria-hidden="true">
                  <defs>
                    <clipPath id={`bs-clip-${i}`}><path d={geo.body} /></clipPath>
                    {/* Glass turns away at both edges, so a band is darker there. */}
                    <linearGradient id={`bs-sheen-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#fff" stopOpacity=".22" />
                      <stop offset=".35" stopColor="#fff" stopOpacity=".05" />
                      <stop offset="1" stopColor="#000" stopOpacity=".07" />
                    </linearGradient>
                    <linearGradient id={`bs-round-${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#000" stopOpacity=".26" />
                      <stop offset=".22" stopColor="#fff" stopOpacity=".22" />
                      <stop offset=".58" stopColor="#000" stopOpacity="0" />
                      <stop offset="1" stopColor="#000" stopOpacity=".24" />
                    </linearGradient>
                  </defs>

                  {/* Depth, without a filter. The Observation skill learned
                      what `feDropShadow` on every object costs a phone, so this
                      is two plain shapes: a contact shadow that sits the bottle
                      on the shelf rather than floating it, and a sheen down the
                      glass. Both are outside the liquid clip — they are the
                      glass, not what is in it. */}
                  <ellipse cx="30" cy={geo.liquidBottom + 3} rx="21" ry="2.6"
                    className="fill-slate-900/15 dark:fill-black/40" />
                  <path d={geo.body} className="fill-white/70 dark:fill-white/10" />

                  {/* Two groups, not one. `clip-path` resolves in the user
                      space the element's own `transform` establishes, so a clip
                      and a rotation on the same <g> rotate together: the tilted
                      bottle's liquid was being clipped to a spun copy of the
                      body outline, which let it draw outside the glass. The
                      clip stays still on the outer group; only the liquid
                      counter-rotates inside it. */}
                  <g clipPath={`url(#bs-clip-${i})`}>
                  <g transform={pouring?.from === i ? `rotate(${-pouring.angle} 30 ${geo.liquidBottom - 4})` : undefined}>
                    {b.seg.map((colour, k) => {
                      const y = geo.liquidBottom - (k + 1) * LAYER_H;
                      if (k < buried) {
                        return (
                          <g key={k}>
                            <rect x="0" y={y} width={W} height={LAYER_H} className="fill-slate-300 dark:fill-slate-700" />
                            {/* A question mark, so a covered segment reads as
                                "not known yet" rather than as a grey colour the
                                child is meant to sort. */}
                            <text x="30" y={y + LAYER_H / 2 + 5} textAnchor="middle"
                              className="fill-slate-500 text-[14px] font-bold dark:fill-slate-400">?</text>
                          </g>
                        );
                      }
                      const arriving = pouring?.to === i && k === b.seg.length - 1;
                      const draining = pouring?.from === i && k === b.seg.length - 1;
                      return (
                        <g key={k}>
                          <rect x="0" y={y} width={W} height={LAYER_H} fill={cssColour(question.hues, colour)}>
                            {animate && arriving && (
                              <>
                                <animate attributeName="y" from={y + LAYER_H} to={y} dur="0.11s" fill="freeze"
                                  calcMode="spline" keySplines="0.2 0.8 0.3 1" keyTimes="0;1" />
                                <animate attributeName="height" from="0" to={LAYER_H} dur="0.11s" fill="freeze"
                                  calcMode="spline" keySplines="0.2 0.8 0.3 1" keyTimes="0;1" />
                              </>
                            )}
                            {/* The band leaving the tilted bottle thins out as
                                it goes, so the two ends of the stream move
                                together instead of the source snapping empty. */}
                            {animate && draining && (
                              <animate attributeName="height" from={LAYER_H} to={LAYER_H * 0.55} dur="0.11s" fill="freeze" />
                            )}
                          </rect>
                          {/* The surface of a band, and the shadow under the one above it. */}
                          <rect x="0" y={y} width={W} height="2.5" fill="#fff" opacity=".3" />
                          <rect x="0" y={y + LAYER_H - 1.5} width={W} height="1.5" fill="#000" opacity=".12" />
                          <rect x="0" y={y} width={W} height={LAYER_H} fill={`url(#bs-round-${i})`} />
                          {bubbles && bubblesFor(k, y).map((bub) => (
                            <circle key={bub.key} cx={bub.cx} cy={bub.from} r={bub.r} fill="#fff" opacity=".45">
                              <animate attributeName="cy" from={bub.from} to={bub.to} dur="3.6s" begin={`${bub.delay}s`} repeatCount="indefinite" />
                              <animate attributeName="opacity" values=".05;.5;0" dur="3.6s" begin={`${bub.delay}s`} repeatCount="indefinite" />
                            </circle>
                          ))}
                          {/* A shape says which colour; a number says which
                              *order*. From level 25 the order is the lesson, so
                              the segment wears the thing being sorted — 1 2 3 4,
                              or the fraction — and the shape would only be
                              another name for the same colour. */}
                          {!numbered(spec) ? (
                            <path d={GLYPH[shapeOf(colour)]} transform={`translate(30 ${y + LAYER_H / 2})`} fill="#fff" fillOpacity=".92" />
                          ) : (
                            <text x="30" y={y + LAYER_H / 2 + 5} textAnchor="middle"
                              className="fill-white text-[13px] font-bold tabular-nums">
                              {labelFor(question.goal, spec, colour)}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                    {/* Gloss, over the liquid: it is the glass in front of it. */}
                    <rect x="11" y={geo.bodyTop + 4} width="6" height={b.cap * LAYER_H - 18} rx="3" fill="#fff" opacity=".42" />
                    <rect x="46" y={geo.bodyTop + 10} width="2.6" height={b.cap * LAYER_H - 30} rx="1.3" fill="#fff" opacity=".2" />
                    <rect x="24" y={NECK_TOP + 8} width="3" height={NECK_H + 6} rx="1.5" fill="#fff" opacity=".35" />
                    {/* The sheen: brightest where the glass turns toward the
                        light, fading before it reaches the far edge. */}
                    <rect x="6" y={geo.bodyTop} width="48" height={b.cap * LAYER_H} fill={`url(#bs-sheen-${i})`} />
                  </g>

                  <path d={geo.outline} fill="none" strokeWidth="2.5" strokeLinecap="round"
                    className={sorted ? "stroke-emerald-500" : picked === i ? "stroke-indigo-500" : "stroke-slate-400 dark:stroke-slate-500"} />
                  {/* The mouth. Read as an opening seen slightly from above,
                      not a cap: a glass rim ring, a genuinely darker bore
                      inside it, and a highlight where the light catches the
                      near edge. Earlier tries were a black disc, then a
                      swollen cap, then a rim so pale the bottle looked shut. */}
                  <g className={sorted ? "text-emerald-500" : picked === i ? "text-indigo-500" : "text-slate-500 dark:text-slate-400"}>
                    {/* Glass thickness below the lip, where the neck widens out. */}
                    <rect x={NECK_L - 0.5} y={NECK_TOP + 4.5} width={NECK_R - NECK_L + 1} height="3.5" rx="1.2"
                      fill="currentColor" opacity=".35" />
                    {/* The rim, drawn as a ring: outer edge, then the bore. */}
                    <ellipse cx="30" cy={NECK_TOP + 1} rx={(NECK_R - NECK_L) / 2 + 1.6} ry="3"
                      fill="currentColor" opacity=".7" />
                    <ellipse cx="30" cy={NECK_TOP + 0.2} rx={(NECK_R - NECK_L) / 2 + 1.6} ry="2.9"
                      className="fill-slate-100 dark:fill-slate-500" />
                    <ellipse cx="30" cy={NECK_TOP + 0.4} rx={(NECK_R - NECK_L) / 2 - 1.8} ry="1.7"
                      className="fill-slate-400 dark:fill-slate-900" opacity=".8" />
                    {/* Down the bore: darker at the back, so it reads as depth. */}
                    <ellipse cx="30" cy={NECK_TOP - 0.1} rx={(NECK_R - NECK_L) / 2 - 2.4} ry="1.1"
                      className="fill-slate-600 dark:fill-slate-950" opacity=".55" />
                    <ellipse cx="26.5" cy={NECK_TOP - 1} rx="2.6" ry=".8" fill="#fff" opacity=".75" />
                  </g>
                  {/* Level 9 asks the child to notice a run travels as one, so
                      the count appears the moment they commit to it. */}
                  {showRunCount && picked === i && topRun(b).n > 0 && (
                    <text x="30" y={geo.bodyTop - 8} textAnchor="middle" data-run-count={topRun(b).n}
                      className="fill-indigo-600 text-[13px] font-bold dark:fill-indigo-300">{topRun(b).n}</text>
                  )}
                  {/* A rule the child cannot see is a rule that feels unfair.
                      A corked bottle wears its cork until the bottle it waits
                      on is finished; a receive-only bottle wears the arrow
                      that says liquid goes in and never comes out. Both sit on
                      the shoulder, where a bottle has headroom whatever it
                      holds, on a disc so they stay legible over liquid. Both
                      are in the accessible name too, and the refusal explains
                      itself if the child tries anyway. */}
                  {b.lockedBy !== undefined && isCorked(rack, i) && (
                    <g data-locked={i}>
                      <circle cx="30" cy={geo.bodyTop + 9} r="11" className="fill-white/85 dark:fill-slate-900/85" />
                      <g className="text-rose-600 dark:text-rose-400">
                        <path d={`M26 ${geo.bodyTop + 6} v-2.5 a4 4 0 0 1 8 0 v2.5`} fill="none"
                          stroke="currentColor" strokeWidth="2.2" />
                        <rect x="23.5" y={geo.bodyTop + 6} width="13" height="9.5" rx="2" fill="currentColor" />
                      </g>
                    </g>
                  )}
                  {b.oneWay && (
                    <g data-one-way={i}>
                      <circle cx="30" cy={geo.bodyTop + 9} r="11" className="fill-white/85 dark:fill-slate-900/85" />
                      <path d={`M30 ${geo.bodyTop + 3} v9 M25.5 ${geo.bodyTop + 8} l4.5 4.5 4.5 -4.5`}
                        fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                        className="stroke-sky-600 dark:stroke-sky-400" />
                    </g>
                  )}
                  <circle r="0.4" cx="30" cy={NECK_TOP} fill="none" data-mouth={i}
                    ref={(node) => { if (node) mouths.current.set(i, node); else mouths.current.delete(i); }} />
                </svg>
              </button>
            );
          })}
        </div>

        {question.budget !== undefined && (
          <p data-budget={question.budget} aria-live="polite"
            className={`text-center text-sm font-semibold tabular-nums ${
              poured >= question.budget ? "text-rose-600 dark:text-rose-400"
                : poured >= question.budget - 2 ? "text-indigo-600 dark:text-indigo-300"
                : "text-slate-600 dark:text-slate-300"}`}>
            {`Pours: ${poured} of ${question.budget}`}
          </p>
        )}

        <div className="flex justify-center gap-2">
          <button type="button" data-action="undo" disabled={!history.length || !!round.feedback}
            onClick={() => stepBack("Stepped back.", () => { setRack(history[history.length - 1]); setHistory((h) => h.slice(0, -1)); setPoured((n) => Math.max(0, n - 1)); })}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">
            Undo
          </button>
          <button type="button" data-action="reset" disabled={!!round.feedback}
            onClick={() => stepBack("Back to the dealt rack.", () => { setRack(dealt); setHistory([]); setPoured(0); })}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">
            Start over
          </button>
        </div>
      </section>
    </SkillRound>
  );
};
