/**
 * The trace player — where a child writes or draws one item.
 *
 * Steps mode walks the writing steps (watch → … → from memory) with the help
 * each step allows. My way lets the child choose the help; Just draw (for
 * drawings) scores nothing. Scoring, the ladder and the coach are the pure
 * modules beside this one; this file is only the screen.
 * See docs/TRACE_STUDIO_BUILD_PLAN.md §3.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Check, CircleDot, Eraser, Eye, Flag, Ghost, Grid3x3, Hash, ListOrdered, MoveRight, Palette, RotateCcw, Route, SlidersHorizontal, Sparkles, Undo2, ChevronDown } from "lucide-react";
import { useT } from "../../lib/i18n";
import { UIButton } from "../../components/ui";
import { playSound } from "../../utils/audio";
import type { AgeBand, Sensitivity, StepId, TraceItem } from "../geometry/types";
import { isGuidedStep, modeOf } from "../geometry/types";
import type { InkPoint } from "../score/capture";
import { cleanInk } from "../score/capture";
import type { AttemptResult, Feedback } from "../score/score";
import { prepareItem, scoreAttempt } from "../score/score";
import { radius } from "../score/tolerance";
import { applyTransform } from "../score/fitInk";
import type { Point } from "../geometry/types";
import type { CoachState, Suggestion } from "../progress/coach";
import { aidsFor, coachAttempt, coachStroke, initialCoach } from "../progress/coach";
import type { LadderEvent, StepPlan } from "../progress/ladder";
import { RECHECK_DAYS, applyAttempt, defaultPlan, isRecheckDue, ruleFor } from "../progress/ladder";
import { TraceProgress } from "../progress/store";
import type { ReportReason } from "../data/api";
import { reportProblem } from "../data/shelf";
import type { PlayMode, Switch, Switches } from "./help";
import { SWITCHES, myWayScoring, stepSwitches } from "./help";
import type { Scene, SceneInk } from "./render";
import { badge, drawScene, drawWatch } from "./render";

interface Props {
  item: TraceItem;
  onExit(): void;
  onAwardXp?(xp: number): void;
  ageBand?: AgeBand;
  /** The item's own writing-step plan (from the Studio); default by kind. */
  plan?: StepPlan;
  /** Studio test: play exactly this step, save no progress, report the result. */
  forceStep?: StepId;
  onResult?(step: StepId, result: { accepted: boolean; score: number }): void;
  /** The published collection this item was opened from — sent with a report. */
  source?: { collectionId: string; rev: number };
}

type Translate = ReturnType<typeof useT>["t"];

const SWITCH_ICON: Record<Switch, React.ReactNode> = {
  ghost: <Ghost className="h-5 w-5" />,
  strokes: <Route className="h-5 w-5" />,
  arrows: <MoveRight className="h-5 w-5" />,
  numbers: <Hash className="h-5 w-5" />,
  startDot: <CircleDot className="h-5 w-5" />,
  grid: <Grid3x3 className="h-5 w-5" />,
};
const MODE_ICON: Record<PlayMode, React.ReactNode> = {
  steps: <ListOrdered className="h-4 w-4" />,
  myWay: <SlidersHorizontal className="h-4 w-4" />,
  justDraw: <Palette className="h-4 w-4" />,
};

const LOOSER: Record<Sensitivity, Sensitivity> = { strict: "balanced", balanced: "relaxed", relaxed: "relaxed" };

export function faultText(t: Translate, f: Feedback, item: TraceItem, unguided = false): string {
  const vars = { n: badge(f.order, item), m: f.expected !== undefined ? badge(f.expected, item) : "" };
  // Copy and From memory have no green dot or arrows on the slate: point to the model instead.
  if (unguided && (f.fault === "start" || f.fault === "direction")) return t(`trace.faultFree.${f.fault}`, vars);
  if (f.fault === "direction" && f.shape === "loop") return t("trace.fault.directionLoop", vars);
  if (f.fault === "checkpoint" && f.shape === "loop") return t("trace.fault.checkpointLoop", vars);
  if (f.fault === "checkpoint" && f.shape === "hook") return t("trace.fault.checkpointHook", vars);
  return t(`trace.fault.${f.fault}`, vars);
}

interface InkEntry extends SceneInk {
  raw: InkPoint[];
  hidden?: boolean;
}

export function TracePlayer({ item, onExit, onAwardXp, ageBand = "B", plan: planProp, forceStep, onResult, source }: Props) {
  const { t } = useT();
  const plan = useMemo(() => planProp ?? defaultPlan(item), [item, planProp]);
  const sandbox = forceStep !== undefined;
  const mode = modeOf(item.kind);
  useSyncExternalStore(TraceProgress.subscribe, TraceProgress.version);
  const progress = TraceProgress.get(item.id);
  const [recheck, setRecheck] = useState(() => isRecheckDue(TraceProgress.get(item.id)));

  const [play, setPlay] = useState<PlayMode>("steps");
  const [mySwitches, setMySwitches] = useState<Switches>(() => stepSwitches(progress.step));
  const [drill, setDrill] = useState<number | null>(null);
  const [watchOnly, setWatchOnly] = useState<number | null>(null);
  const [coach, setCoach] = useState<CoachState>(initialCoach);
  const [message, setMessage] = useState<{ text: string; tone: "good" | "fix" | "info" } | null>(null);
  const [outcome, setOutcome] = useState<{
    result: AttemptResult | null;
    event: LadderEvent | null;
    counted: boolean;
    /** The step was passed this many times of the times it needs (when it needs more than one). */
    passes?: { done: number; of: number };
  } | null>(null);
  /** The card that opens each step: what it is, where it sits in the journey, and Start. */
  const [intro, setIntro] = useState(forceStep === undefined);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  /** After checking a Copy / From memory attempt: the child's ink moved onto the model, shown over the answer. */
  const [review, setReview] = useState<Point[][] | null>(null);
  const [reporting, setReporting] = useState<{ reason: ReportReason | null; note: string; sent: boolean } | null>(null);
  const [memoryLeft, setMemoryLeft] = useState(0);
  const [inkCount, setInkCount] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());

  // The item being written: the whole item, or one stroke of it while drilling.
  const active = useMemo<TraceItem>(() => {
    if (drill === null) return item;
    const stroke = [...item.strokes].sort((a, b) => a.order - b.order)[drill];
    return { ...item, id: `${item.id}#drill`, strokes: [{ ...stroke, order: 1, join: "lift" }] };
  }, [item, drill]);
  const prepared = useMemo(() => prepareItem(active), [active]);

  const step: StepId =
    drill !== null ? "guided" : forceStep ? forceStep : play === "steps" ? (recheck ? plan.canDoAt : progress.step) : play === "myWay" ? myWayScoring(mySwitches).step : "guided";
  // The intro card is on screen only in Steps, for the item itself (not a drill), before the attempt.
  const introShown = intro && play === "steps" && drill === null && !sandbox;
  const watching = watchOnly !== null || (play === "steps" && drill === null && step === "watch" && !introShown);
  const guided = isGuidedStep(step);
  const current = guided && play !== "justDraw" ? prepared.findIndex((_, i) => !done.has(i)) : -1;
  const aids = current >= 0 && !(step === "copy" || step === "memory") ? aidsFor(coach, prepared[current].stroke.order) : [];
  const sensitivity = aids.includes("widerBand") ? LOOSER[item.sensitivity] : item.sensitivity;
  const opts = { step, sensitivity, ageBand };

  const switches: Switches =
    play === "myWay" && drill === null
      ? mySwitches
      : play === "justDraw"
        ? { ghost: mySwitches.ghost, strokes: false, arrows: false, numbers: false, startDot: false, grid: true }
        : memoryLeft > 0
          ? { ...stepSwitches("memory"), ghost: true }
          : stepSwitches(step);

  /* ------------------------------------------------------------ canvas */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(1);
  const inkRef = useRef<InkEntry[]>([]);
  const drawingRef = useRef<InkPoint[] | null>(null);
  const watchRef = useRef({ progress: 0 });
  const sceneRef = useRef<Omit<Scene, "ink" | "pulse"> | null>(null);

  const reviewing = review !== null && outcome !== null;
  sceneRef.current = {
    item: active,
    prepared,
    // Reveal the answer — numbered strokes with arrows — under the child's ink.
    switches: reviewing ? { ...switches, ghost: false, strokes: true, arrows: true, numbers: true, startDot: false } : switches,
    current: reviewing ? -1 : current,
    done,
    aids,
    radii: prepared.map((p) => radius(p.stroke.width, opts)),
    assist: play === "justDraw" ? 0 : step === "big" ? 0.5 : step === "guided" ? 0.25 : 0,
    dotted: step === "faded" || (play === "myWay" && !mySwitches.strokes),
    dimOthers: aids.includes("numbersDim"),
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(w * dpr);
      scaleRef.current = (w * dpr) / 1000;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let frame = 0;
    const loop = (now: number) => {
      const ctx = canvas.getContext("2d");
      const scene = sceneRef.current;
      if (ctx && scene) {
        const s = scaleRef.current;
        if (watchingRef.current) {
          drawWatch(ctx, scene.item, scene.prepared, watchRef.current.progress, s, watchOnlyRef.current ?? undefined);
        } else {
          const shown = reviewRef.current;
          const ink: SceneInk[] = shown
            ? shown.ink.map((points) => ({ points, state: shown.accepted ? "ok" : "pending" }))
            : inkRef.current.filter((e) => !e.hidden);
          if (drawingRef.current) ink.push({ points: drawingRef.current, state: "pending" });
          drawScene(ctx, { ...scene, ink, pulse: (Math.sin(now / 260) + 1) / 2 }, s);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  const reviewRef = useRef<{ ink: Point[][]; accepted: boolean } | null>(null);
  reviewRef.current = reviewing ? { ink: review!, accepted: Boolean(outcome?.result?.accepted) } : null;
  const watchingRef = useRef(watching);
  watchingRef.current = watching;
  const watchOnlyRef = useRef(watchOnly);
  watchOnlyRef.current = watchOnly;

  /* ------------------------------------------------------------ watch */
  const [watchKey, setWatchKey] = useState(0);
  const [watchDone, setWatchDone] = useState(false);
  useEffect(() => {
    if (!watching) return;
    setWatchDone(false);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const count = watchOnly !== null ? 1 : prepared.length;
    // Longer strokes take longer; a pause between strokes; reduced motion jumps stroke by stroke.
    const lengths = (watchOnly !== null ? [prepared[watchOnly]] : prepared).map((p) => Math.max(0.35, (p.dot ? 120 : p.length) / 650));
    let start = 0;
    let frame = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = (now - start) / 1000;
      let acc = 0;
      let value = count;
      for (let i = 0; i < count; i++) {
        const dur = reduce ? 0.01 : lengths[i];
        const pause = reduce ? 0.8 : 0.35;
        if (elapsed < acc + dur) {
          value = i + (elapsed - acc) / dur;
          break;
        }
        if (elapsed < acc + dur + pause) {
          value = i + 1;
          break;
        }
        acc += dur + pause;
      }
      watchRef.current.progress = value;
      if (value >= count) setWatchDone(true);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [watching, watchKey, watchOnly, prepared]);

  /* ------------------------------------------------------------ attempts */
  const resetAttempt = useCallback(() => {
    inkRef.current = [];
    drawingRef.current = null;
    setInkCount(0);
    setDone(new Set());
    setOutcome(null);
    setMessage(null);
    setReview(null);
  }, []);

  // From memory: show the item for 3 seconds, then hide it.
  useEffect(() => {
    if (play !== "steps" || drill !== null || step !== "memory" || outcome || introShown) return;
    setMemoryLeft(3);
    const id = window.setInterval(() => setMemoryLeft((s) => (s <= 1 ? (window.clearInterval(id), 0) : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [play, drill, step, outcome, introShown]);

  // A new step opens with its card.
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current !== step && play === "steps" && drill === null && !sandbox) setIntro(true);
    lastStep.current = step;
  }, [step, play, drill, sandbox]);
  const bar = ruleFor(plan, step)?.pass ?? 0;

  const finish = (result: AttemptResult | null) => {
    let event: LadderEvent | null = null;
    let counted = false;
    let passes: { done: number; of: number } | undefined;
    if (result) {
      const c = coachAttempt(coach, result.accepted);
      setCoach(c.state);
      if (c.suggestion) setSuggestion(c.suggestion);
    }
    if (sandbox && drill === null) {
      soundFor(result, null);
      if (result) onResult?.(step, { accepted: result.accepted, score: result.score });
      setOutcome({ result, event: null, counted: false });
      return;
    }
    if (drill !== null) {
      if (result?.accepted) {
        setDrill(null);
        resetAttempt();
        setMessage({ text: t("trace.coach.drillDone"), tone: "good" });
      } else setOutcome({ result, event: null, counted: false });
      return;
    }
    if (result && play !== "justDraw") {
      const ladderStep = play === "steps" ? step : myWayScoring(mySwitches).counts && progress.step === plan.canDoAt ? plan.canDoAt : null;
      if (ladderStep) {
        const r = applyAttempt(
          progress,
          plan,
          { step: ladderStep, accepted: result.accepted, score: result.score, fault: result.feedback?.fault },
          Date.now(),
          recheck && play === "steps",
        );
        TraceProgress.set(item.id, { ...r.progress, title: item.title, kind: item.kind });
        event = r.event;
        counted = true;
        if (recheck) setRecheck(false);
        const times = ruleFor(plan, ladderStep).times;
        if (event === "stay" && r.progress.passes > 0 && times > 1) passes = { done: r.progress.passes, of: times };
      }
      if (result.accepted && result.stars > 0) onAwardXp?.(result.stars * 5);
    }
    soundFor(result, event);
    setOutcome({ result, event, counted, passes });
  };

  /** One sound per attempt, by how it went against this step's bar. */
  const soundFor = (result: AttemptResult | null, event: LadderEvent | null) => {
    if (!result || play === "justDraw") return;
    if (event === "canDo" || event === "learned" || event === "rechecked" || event === "up") playSound("levelup");
    else if (result.accepted && result.score >= bar) playSound("success");
    else if (result.accepted) playSound("clink");
    else playSound("hint");
  };

  const score = (entries: InkEntry[]) => scoreAttempt(active, cleanInk(entries.map((e) => e.raw)), opts);

  const penUp = () => {
    const raw = drawingRef.current;
    drawingRef.current = null;
    if (!raw || raw.length === 0) return;
    const entry: InkEntry = { raw, points: raw, state: "pending" };
    inkRef.current = [...inkRef.current, entry];
    setInkCount(inkRef.current.length);
    if (play === "justDraw") {
      entry.state = "ok";
      return;
    }
    if (!guided) return; // copy / memory: written freely, checked on "Check"

    const result = score(inkRef.current);
    const accepted = new Set(result.strokes.flatMap((s, i) => (s.accepted ? [i] : [])));
    const gained = [...accepted].filter((i) => !done.has(i));
    if (gained.length > 0) {
      entry.state = "ok";
      let c = coach;
      for (const i of gained) c = coachStroke(c, prepared[i].stroke.order, null, prepared[i].stroke.shape).state;
      setCoach(c);
      setDone(accepted);
      setMessage(null);
      if (accepted.size === prepared.length) {
        finish(result);
        return;
      }
      // A stroke done: brighter the closer it stayed to the path.
      const best = Math.max(...gained.map((i) => result.strokes[i].score));
      playSound(best >= 90 ? "clink" : "pop");
      return;
    }
    // A failed try: say why, fade the ink away — and a gentle sound, never a buzzer.
    entry.state = "rejected";
    playSound("hint");
    const failed = result.strokes.find((s) => !s.accepted && s.fault && s.tries > 0);
    if (failed?.fault) {
      const at = prepared.findIndex((p) => p.stroke.order === failed.order);
      const c = coachStroke(coach, failed.order, failed.fault, prepared[at]?.stroke.shape ?? "free");
      setCoach(c.state);
      if (c.suggestion) setSuggestion(c.suggestion);
      const fb: Feedback =
        failed.fault === "order" && failed.drewInstead !== undefined
          ? { fault: "order", order: failed.drewInstead, expected: failed.order, shape: prepared[at]?.stroke.shape ?? "free" }
          : { fault: failed.fault, order: failed.order, shape: prepared[at]?.stroke.shape ?? "free" };
      setMessage({ text: faultText(t, fb, active), tone: "fix" });
    }
    window.setTimeout(() => {
      entry.hidden = true;
    }, 700);
  };

  const check = () => {
    const entries = inkRef.current;
    if (entries.length === 0) return;
    const result = score(entries);
    let c = coach;
    for (const s of result.strokes) {
      const shape = prepared.find((p) => p.stroke.order === s.order)?.stroke.shape ?? "free";
      c = coachStroke(c, s.order, s.accepted ? null : (s.fault ?? "missing"), shape).state;
    }
    setCoach(c);
    for (const e of entries) e.state = result.accepted ? "ok" : "pending";
    if (result.transform) {
      const tr = result.transform;
      setReview(cleanInk(entries.map((e) => e.raw)).map((s) => s.map((p) => applyTransform(p, tr))));
    }
    finish(result);
  };

  const undo = () => {
    // Guided: only the last visible stroke of ink; scoring re-runs from what is left.
    const visible = inkRef.current.filter((e) => !e.hidden);
    const last = visible[visible.length - 1];
    if (!last) return;
    inkRef.current = inkRef.current.filter((e) => e !== last);
    setInkCount(inkRef.current.length);
    if (guided && play !== "justDraw") {
      const result = score(inkRef.current.filter((e) => e.state !== "rejected"));
      setDone(new Set(result.strokes.flatMap((s, i) => (s.accepted ? [i] : []))));
    }
  };

  /* ------------------------------------------------------------ pointer */
  const canDraw = !watching && !outcome && memoryLeft === 0 && !introShown;
  const toUnits = (e: { clientX: number; clientY: number }): InkPoint => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1000, y: ((e.clientY - r.top) / r.height) * 1000, t: performance.now() };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    if (drawingRef.current) return; // a second finger or the palm: ignore while a pen is down
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = [toUnits(e)];
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drawingRef.current;
    if (!d) return;
    const events = coalesced(e.nativeEvent);
    for (const ev of events) d.push(toUnits(ev));
  };

  /* ------------------------------------------------------------ actions */
  const watched = () => {
    if (watchOnly !== null) {
      setWatchOnly(null);
      return;
    }
    if (sandbox) {
      onResult?.("watch", { accepted: true, score: 100 });
      setWatchKey((k) => k + 1);
      return;
    }
    const r = applyAttempt(progress, plan, { step: "watch", accepted: true, score: 100 });
    TraceProgress.set(item.id, { ...r.progress, title: item.title, kind: item.kind });
    resetAttempt();
    setMessage({ text: t("trace.event.up", { step: t(`trace.step.${r.progress.step}`) }), tone: "info" });
  };

  const takeSuggestion = () => {
    if (!suggestion) return;
    if (suggestion.kind === "drill") {
      const idx = prepared.findIndex((p) => p.stroke.order === suggestion.order);
      setDrill(idx >= 0 ? idx : null);
      resetAttempt();
    } else if (suggestion.kind === "watch") {
      const idx = prepared.findIndex((p) => p.stroke.order === suggestion.order);
      setWatchOnly(idx >= 0 ? idx : 0);
      setWatchKey((k) => k + 1);
    } else onExit();
    setSuggestion(null);
  };

  const eventText = (event: LadderEvent | null) => {
    if (!event || event === "stay") return null;
    if (event === "canDo") return t(mode === "writing" ? "trace.event.canWrite" : "trace.event.canDraw");
    if (event === "up") return t("trace.event.up", { step: t(`trace.step.${TraceProgress.get(item.id).step}`) });
    return t(`trace.event.${event}`);
  };

  const hint =
    drill !== null
      ? t("trace.hint.drill")
      : play === "myWay"
        ? t("trace.hint.myWay")
        : play === "justDraw"
          ? t("trace.hint.justDraw")
          : recheck
            ? t("trace.checkUpIntro")
            : t(`trace.hint.${step}`);

  const stepIndex = plan.steps.findIndex((s) => s.id === progress.step);
  const status =
    progress.status === "canDo" ? (mode === "writing" ? "canWrite" : "canDraw") : progress.status === "learning" ? null : progress.status;

  /* ------------------------------------------------------------ view */
  const helpList = play === "justDraw" ? (["ghost"] as Switch[]) : [...SWITCHES];
  const locked = play === "steps" || drill !== null;

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-4 pb-8">
      {!sandbox && (
        <header className="flex items-start gap-3">
          <RoundIcon label={t("trace.action.backToList")} onClick={onExit}>
            <ArrowLeft className="h-5 w-5" />
          </RoundIcon>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold leading-tight text-slate-900 dark:text-white" lang={item.script === "khmer" ? "km" : undefined}>
                {item.title}
              </h1>
              {status && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  <Check className="h-3.5 w-3.5" />
                  {t(`trace.status.${status}`)}
                </span>
              )}
              {recheck && play === "steps" && <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">{t("trace.checkUp")}</span>}
            </div>
            {play === "steps" && (
              <StepTrack
                steps={plan.steps.map((x) => t(`trace.step.${x.id}`))}
                at={stepIndex}
                allDone={progress.status !== "learning"}
                label={t("trace.stepProgress", { n: stepIndex + 1, total: plan.steps.length })}
              />
            )}
          </div>
        </header>
      )}

      <div className="grid items-start gap-5 @3xl:grid-cols-[minmax(0,1fr)_300px] [@media(orientation:landscape)_and_(max-height:640px)]:grid-cols-1">
        {/* The slate, as large as the screen allows */}
        <section className="flex min-w-0 flex-col items-center gap-3 [@media(orientation:landscape)_and_(max-height:640px)]:flex-row [@media(orientation:landscape)_and_(max-height:640px)]:items-center [@media(orientation:landscape)_and_(max-height:640px)]:justify-center">
          <p className={`w-full text-center text-base font-medium text-slate-700 dark:text-slate-200 [@media(orientation:landscape)_and_(max-height:640px)]:hidden ${introShown && !outcome ? "invisible" : ""}`}>{hint}</p>
          <div className="relative aspect-square w-[min(100%,calc(100dvh_-_16rem))] shrink-0 [@media(orientation:landscape)_and_(max-height:640px)]:w-[calc(100dvh_-_8rem)]">
            <canvas
              ref={canvasRef}
              aria-label={t("trace.slate")}
              className="absolute inset-0 block h-full w-full touch-none rounded-3xl shadow-[0_18px_40px_-20px_rgba(91,63,217,0.45)] ring-1 ring-slate-200 dark:ring-slate-700"
              style={{ cursor: canDraw ? "crosshair" : "default" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={penUp}
              onPointerCancel={penUp}
            />
            {memoryLeft > 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                <span className="rounded-full bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg">{t("trace.remember", { s: memoryLeft })}</span>
              </div>
            )}
            {introShown && !outcome && (
              <StepIntro
                steps={plan.steps.map((x) => ({ id: x.id, name: t(`trace.step.${x.id}`) }))}
                at={plan.steps.findIndex((x) => x.id === step)}
                allDone={progress.status !== "learning"}
                title={recheck ? t("trace.checkUp") : t(`trace.step.${step}`)}
                text={hint}
                start={t(step === "watch" ? "trace.flow.watch" : "trace.flow.start")}
                onStart={() => setIntro(false)}
              />
            )}
            {message && !outcome && (
              <div role="status" className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
                <span
                  className={`max-w-full rounded-2xl px-4 py-2 text-center text-sm font-semibold text-white shadow-lg motion-safe:animate-[trace-pop_200ms_ease-out] ${
                    message.tone === "fix" ? "bg-rose-600" : message.tone === "good" ? "bg-emerald-600" : "bg-violet-600"
                  }`}
                >
                  {message.text}
                </span>
              </div>
            )}
          </div>

          {outcome && (
            <div role="status" className="flex w-full max-w-xl items-start gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
              {outcome.result && <ScoreRing score={outcome.result.score} label={t("trace.accuracy")} />}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {outcome.result && (
                  <span className="text-2xl tracking-widest text-violet-600" aria-label={t("trace.starsLabel", { count: outcome.result.stars })}>
                    {"★".repeat(outcome.result.stars)}
                    <span className="text-slate-300 dark:text-slate-600">{"★".repeat(3 - outcome.result.stars)}</span>
                  </span>
                )}
                {eventText(outcome.event) &&
                  (outcome.event === "down" || outcome.event === "lost" ? (
                    // Moving back a step is help, not a prize: said plainly.
                    <p className="text-base font-semibold text-violet-700 dark:text-violet-300">{eventText(outcome.event)}</p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-base font-bold text-emerald-700 dark:text-emerald-300">
                      <Sparkles className="h-4 w-4" />
                      {eventText(outcome.event)}
                    </p>
                  ))}
                {outcome.passes && <p className="text-base font-bold text-violet-700 dark:text-violet-300">{t("trace.flow.onceMore", { done: outcome.passes.done, total: outcome.passes.of })}</p>}
                {outcome.event === "canDo" && <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t("trace.flow.checkUpIn", { days: RECHECK_DAYS[0] })}</p>}
                <p className="text-sm text-slate-700 dark:text-slate-200">{outcome.result?.feedback ? faultText(t, outcome.result.feedback, active, !guided) : t("trace.good")}</p>
                {outcome.result && outcome.result.strokes.length > 1 && (
                  <ul className="flex flex-wrap gap-1" aria-label={t("trace.perStroke")}>
                    {outcome.result.strokes.map((r) => (
                      <li
                        key={r.order}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.accepted ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                        }`}
                      >
                        <span className="text-sm">{badge(r.order, active)}</span>
                        {r.accepted ? `✓ ${r.score}` : `✗ ${t(`trace.faultShort.${r.fault ?? "missing"}`)}`}
                      </li>
                    ))}
                  </ul>
                )}
                {reviewing && !outcome.result?.accepted && <p className="text-xs text-slate-500 dark:text-slate-400">{t("trace.reviewNote")}</p>}
                {!outcome.counted && play === "myWay" && <p className="text-xs text-slate-500 dark:text-slate-400">{t("trace.practiceOnly")}</p>}
              </div>
            </div>
          )}

          {/* Actions: big round touch targets, the main one wide — a column beside the slate on a short landscape screen */}
          <div className="flex w-full max-w-xl items-center justify-center gap-2.5 [@media(orientation:landscape)_and_(max-height:640px)]:w-auto [@media(orientation:landscape)_and_(max-height:640px)]:flex-col [@media(orientation:landscape)_and_(max-height:640px)]:[&>button]:flex-none">
            {watching ? (
              <>
                <RoundIcon label={t("trace.action.watchAgain")} onClick={() => setWatchKey((k) => k + 1)}>
                  <RotateCcw className="h-5 w-5" />
                </RoundIcon>
                <MainButton onClick={watched} disabled={!watchDone} icon={<Check className="h-5 w-5" />}>
                  {watchOnly !== null ? t("trace.action.continue") : t("trace.action.watched")}
                </MainButton>
              </>
            ) : outcome ? (
              <MainButton onClick={resetAttempt} icon={outcome.result?.accepted ? <ArrowRight className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}>
                {outcome.event === "up" || outcome.event === "down" || outcome.event === "lost"
                  ? t("trace.flow.goTo", { step: t(`trace.step.${TraceProgress.get(item.id).step}`) })
                  : outcome.passes
                    ? t("trace.flow.again")
                    : outcome.result?.accepted
                      ? t("trace.action.next")
                      : t("trace.action.tryAgain")}
              </MainButton>
            ) : (
              <>
                {play !== "justDraw" && (
                  <RoundIcon
                    label={t("trace.action.watchAgain")}
                    onClick={() => {
                      setWatchOnly(current >= 0 ? current : 0);
                      setWatchKey((k) => k + 1);
                    }}
                  >
                    <Eye className="h-5 w-5" />
                  </RoundIcon>
                )}
                <RoundIcon label={t("trace.action.undo")} onClick={undo} disabled={inkCount === 0}>
                  <Undo2 className="h-5 w-5" />
                </RoundIcon>
                <RoundIcon label={t("trace.action.clear")} onClick={resetAttempt} disabled={inkCount === 0}>
                  <Eraser className="h-5 w-5" />
                </RoundIcon>
                {!guided && play !== "justDraw" && (
                  <MainButton onClick={check} disabled={inkCount === 0} icon={<Check className="h-5 w-5" />}>
                    {t("trace.action.check")}
                  </MainButton>
                )}
              </>
            )}
          </div>
        </section>

        {/* How to practise, help, and what the coach suggests */}
        <aside className="@container/aside flex min-w-0 flex-col gap-3">
          <p className="hidden text-base font-medium text-slate-700 dark:text-slate-200 [@media(orientation:landscape)_and_(max-height:640px)]:block">{hint}</p>
          {suggestion && (
            <div className="flex flex-col gap-3 rounded-3xl bg-violet-600 p-4 text-white shadow-lg">
              <p className="flex items-start gap-2 text-base font-semibold">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
                {suggestion.kind === "rest" ? t("trace.coach.rest") : t(`trace.coach.${suggestion.kind}`, { n: badge(suggestion.order, item) })}
              </p>
              <div className="flex gap-2">
                <button onClick={takeSuggestion} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50">
                  {suggestion.kind === "rest" ? t("trace.action.backToList") : t("trace.action.continue")}
                </button>
                <button onClick={() => setSuggestion(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10">
                  {t("trace.action.notNow")}
                </button>
              </div>
            </div>
          )}

          {/* Copy: the model beside the empty grid */}
          {step === "copy" && play === "steps" && drill === null && !watching && (
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
              <ModelPreview item={item} />
            </div>
          )}

          <details
            className="group rounded-3xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
            open={sandbox || play !== "steps" || undefined}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <SlidersHorizontal className="h-4 w-4 text-violet-600" />
              <span className="flex-1">{t("trace.flow.moreOptions")}</span>
              <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-3 px-3 pb-3">
          {!sandbox && (
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label={t("trace.mode.label")}>
              {(["steps", "myWay", ...(mode === "drawing" ? (["justDraw"] as const) : [])] as PlayMode[]).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={play === m}
                  onClick={() => {
                    setPlay(m);
                    setDrill(null);
                    resetAttempt();
                  }}
                  className={`flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-xs font-semibold transition @min-[20rem]/aside:flex-row @min-[20rem]/aside:justify-center @min-[20rem]/aside:gap-1.5 @min-[20rem]/aside:text-sm ${
                    play === m ? "bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  }`}
                >
                  {MODE_ICON[m]}
                  {t(`trace.mode.${m}`)}
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="grid grid-cols-2 gap-1 @min-[13rem]/aside:grid-cols-3 @min-[26rem]/aside:grid-cols-6">
              {helpList.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  role="switch"
                  aria-checked={switches[sw]}
                  aria-label={`${t(`trace.switch.${sw}`)} · ${switches[sw] ? t("trace.on") : t("trace.off")}`}
                  disabled={locked}
                  onClick={() => {
                    setMySwitches((x) => ({ ...x, [sw]: !x[sw] }));
                    resetAttempt();
                  }}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold leading-tight transition disabled:cursor-default ${
                    switches[sw] ? "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200" : "text-slate-400 dark:text-slate-500"
                  } ${locked ? "" : "hover:bg-violet-100 dark:hover:bg-violet-900/40"}`}
                >
                  {SWITCH_ICON[sw]}
                  <span className="truncate">{t(`trace.switch.${sw}`)}</span>
                </button>
              ))}
            </div>
            {locked && !sandbox && <p className="mt-2 px-1 text-xs text-slate-500 dark:text-slate-400">{t("trace.switchesLocked")}</p>}
          </div>

            </div>
          </details>

          {!sandbox && (
            <div className="flex justify-end">
              <button
                onClick={() => setReporting(reporting ? null : { reason: null, note: "", sent: false })}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Flag className="h-3.5 w-3.5" />
                {t("trace.report.button")}
              </button>
            </div>
          )}
          {reporting && (
            <div className="flex flex-col gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
              {reporting.sent ? (
                <p role="status" className="text-base text-emerald-800 dark:text-emerald-200">
                  {t("trace.report.thanks")}
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("trace.report.title")}</p>
                  <div role="radiogroup" className="flex flex-wrap gap-2">
                    {(["strokes_wrong", "too_hard", "not_for_children", "other"] as ReportReason[]).map((r) => (
                      <button
                        key={r}
                        role="radio"
                        aria-checked={reporting.reason === r}
                        onClick={() => setReporting({ ...reporting, reason: r })}
                        className={`rounded-full border px-3 py-1.5 text-sm ${reporting.reason === r ? "border-violet-500 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
                      >
                        {t(`trace.report.reason.${r}`)}
                      </button>
                    ))}
                  </div>
                  <textarea
                    aria-label={t("trace.report.note")}
                    placeholder={t("trace.report.note")}
                    maxLength={400}
                    value={reporting.note}
                    onChange={(e) => setReporting({ ...reporting, note: e.target.value })}
                    className="min-h-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <div>
                    <UIButton
                      size="sm"
                      icon={<Flag className="h-4 w-4" />}
                      disabled={!reporting.reason}
                      onClick={async () => {
                        if (!reporting.reason) return;
                        await reportProblem({ itemId: item.id, collectionId: source?.collectionId, rev: source?.rev, reason: reporting.reason, note: reporting.note.trim() });
                        setReporting({ ...reporting, sent: true });
                      }}
                    >
                      {t("trace.report.send")}
                    </UIButton>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ pieces */

/** A large, round, touch-sized icon button with a tooltip. */
function RoundIcon({ label, onClick, disabled, children }: { label: string; onClick(): void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:scale-95 disabled:opacity-35 disabled:hover:bg-white dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-violet-950/50"
    >
      {children}
    </button>
  );
}

/** The one thing to press next. */
function MainButton({ onClick, disabled, icon, children }: { onClick(): void; disabled?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 min-w-0 max-w-xs flex-1 items-center justify-center gap-2 rounded-full bg-violet-600 px-6 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(91,63,217,0.8)] transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Where the child is on the writing steps: a slim segmented bar and its name. */
function StepTrack({ steps, at, allDone, label }: { steps: string[]; at: number; allDone: boolean; label: string }) {
  return (
    <div className="flex flex-col gap-1" aria-label={label}>
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <span
            key={s}
            title={s}
            className={`h-1.5 flex-1 rounded-full ${allDone || i < at ? "bg-emerald-500" : i === at ? "bg-violet-600" : "bg-slate-200 dark:bg-slate-700"}`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label} · <span className="font-semibold text-slate-700 dark:text-slate-200">{steps[Math.max(0, at)]}</span>
      </span>
    </div>
  );
}

/** The card that opens a step: the journey so far, this step, and one button to begin. */
function StepIntro({
  steps,
  at,
  allDone,
  title,
  text,
  start,
  onStart,
}: {
  steps: { id: string; name: string }[];
  at: number;
  allDone: boolean;
  title: string;
  text: string;
  start: string;
  onStart(): void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/80 p-4 backdrop-blur-sm dark:bg-slate-950/70">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center motion-safe:animate-[trace-pop_220ms_ease-out]">
        <ol className="flex flex-wrap justify-center gap-1.5">
          {steps.map((s, i) => (
            <li
              key={s.id}
              title={s.name}
              className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold ${
                allDone || i < at ? "bg-emerald-500 text-white" : i === at ? "bg-violet-600 text-white ring-4 ring-violet-200 dark:ring-violet-900" : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              }`}
            >
              {allDone || i < at ? <Check className="h-4 w-4" /> : i + 1}
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-base text-slate-600 dark:text-slate-300">{text}</p>
        </div>
        <div className="flex w-full justify-center">
          <MainButton onClick={onStart} icon={<ArrowRight className="h-5 w-5" />}>
            {start}
          </MainButton>
        </div>
      </div>
    </div>
  );
}

/** Accuracy as a ring that fills up. */
function ScoreRing({ score, label }: { score: number; label: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);
  const r = 30;
  const c = 2 * Math.PI * r;
  const color = score >= 90 ? "#059669" : score >= 70 ? "#6d28d9" : score >= 40 ? "#2563eb" : "#e11d48";
  return (
    <div className="relative h-20 w-20 shrink-0" role="img" aria-label={`${score}% ${label}`}>
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-100 dark:text-slate-800" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{score}%</span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      </span>
    </div>
  );
}

/** The item drawn small, for the copy step. */
function ModelPreview({ item }: { item: TraceItem }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = canvas.width;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const prepared = prepareItem(item);
    drawWatch(ctx, item, prepared, prepared.length, canvas.width / 1000);
  }, [item]);
  return <canvas ref={ref} aria-hidden="true" className="aspect-square w-full max-w-64 rounded-xl border border-slate-200 dark:border-slate-700" />;
}

/** The pointer's in-between positions — or the event itself where a browser returns none (some do, and so do synthetic events). */
function coalesced(e: PointerEvent): PointerEvent[] {
  const list = e.getCoalescedEvents?.();
  return list && list.length ? list : [e];
}
