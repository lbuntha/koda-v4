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
import { ArrowLeft, Check, CircleDot, Eraser, Eye, Flag, Ghost, Grid3x3, Hash, ListOrdered, MoveRight, Palette, RotateCcw, Route, SlidersHorizontal, Undo2 } from "lucide-react";
import { IconButton } from "../studio/ui";
import { useT } from "../../lib/i18n";
import { UIButton } from "../../components/ui";
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
import { applyAttempt, defaultPlan, isRecheckDue } from "../progress/ladder";
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
  const [outcome, setOutcome] = useState<{ result: AttemptResult | null; event: LadderEvent | null; counted: boolean } | null>(null);
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
  const watching = watchOnly !== null || (play === "steps" && drill === null && step === "watch");
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
    if (play !== "steps" || drill !== null || step !== "memory" || outcome) return;
    setMemoryLeft(3);
    const id = window.setInterval(() => setMemoryLeft((s) => (s <= 1 ? (window.clearInterval(id), 0) : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [play, drill, step, outcome]);

  const finish = (result: AttemptResult | null) => {
    let event: LadderEvent | null = null;
    let counted = false;
    if (result) {
      const c = coachAttempt(coach, result.accepted);
      setCoach(c.state);
      if (c.suggestion) setSuggestion(c.suggestion);
    }
    if (sandbox && drill === null) {
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
      }
      if (result.accepted && result.stars > 0) onAwardXp?.(result.stars * 5);
    }
    setOutcome({ result, event, counted });
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
      if (accepted.size === prepared.length) finish(result);
      return;
    }
    // A failed try: say why, fade the ink away.
    entry.state = "rejected";
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
  const canDraw = !watching && !outcome && memoryLeft === 0;
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
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
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
  return (
    <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-4 pb-10">
      {!sandbox && (
      <div className="flex flex-wrap items-center gap-3">
        <UIButton variant="secondary" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={onExit}>
          {t("trace.action.backToList")}
        </UIButton>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white" lang={item.script === "khmer" ? "km" : undefined}>
          {item.title}
        </h1>
        {status && <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">{t(`trace.status.${status}`)}</span>}
        {recheck && play === "steps" && <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">{t("trace.checkUp")}</span>}
      </div>
      )}

      {/* Step dots */}
      {!sandbox && (
      <ol className="flex flex-wrap gap-2" aria-label={t("trace.stepProgress", { n: stepIndex + 1, total: plan.steps.length })}>
        {plan.steps.map((s, i) => (
          <li
            key={s.id}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              i === stepIndex && play === "steps"
                ? "bg-violet-600 text-white"
                : i < stepIndex || progress.status !== "learning"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {t(`trace.step.${s.id}`)}
          </li>
        ))}
      </ol>
      )}

      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative">
            <canvas
              ref={canvasRef}
              aria-label={t("trace.slate")}
              className="block aspect-square w-full touch-none rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700"
              style={{ cursor: canDraw ? "crosshair" : "default" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={penUp}
              onPointerCancel={penUp}
            />
            {memoryLeft > 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-3 text-center">
                <span className="rounded-full bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white">{t("trace.remember", { s: memoryLeft })}</span>
              </div>
            )}
          </div>
          {message && (
            <p
              role="status"
              className={`rounded-xl px-4 py-3 text-base font-medium ${
                message.tone === "fix"
                  ? "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                  : message.tone === "good"
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
              }`}
            >
              {message.text}
            </p>
          )}

          {outcome && (
            <div role="status" className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              {outcome.result && (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-4xl font-bold tabular-nums text-slate-900 dark:text-white">{outcome.result.score}%</span>
                  <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("trace.accuracy")}</span>
                  <span className="ml-auto text-2xl tracking-widest text-violet-600" aria-label={t("trace.starsLabel", { count: outcome.result.stars })}>
                    {"★".repeat(outcome.result.stars)}
                    {"☆".repeat(3 - outcome.result.stars)}
                  </span>
                </div>
              )}
              <p className="text-base text-slate-800 dark:text-slate-100">
                {outcome.result?.feedback ? faultText(t, outcome.result.feedback, active, !guided) : t("trace.good")}
              </p>
              {outcome.result && outcome.result.strokes.length > 1 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={t("trace.perStroke")}>
                  {outcome.result.strokes.map((r) => (
                    <li
                      key={r.order}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        r.accepted ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                      }`}
                    >
                      <span className="text-sm">{badge(r.order, active)}</span>
                      {r.accepted ? `✓ ${r.score}` : `✗ ${t(`trace.faultShort.${r.fault ?? "missing"}`)}`}
                    </li>
                  ))}
                </ul>
              )}
              {reviewing && !outcome.result?.accepted && <p className="text-sm text-slate-500 dark:text-slate-400">{t("trace.reviewNote")}</p>}
              {eventText(outcome.event) && <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300">{eventText(outcome.event)}</p>}
              {!outcome.counted && play === "myWay" && <p className="text-sm text-slate-500 dark:text-slate-400">{t("trace.practiceOnly")}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {watching ? (
              <>
                <UIButton icon={<Check className="h-4 w-4" />} onClick={watched} disabled={!watchDone}>
                  {watchOnly !== null ? t("trace.action.continue") : t("trace.action.watched")}
                </UIButton>
                <IconButton label={t("trace.action.watchAgain")} onClick={() => setWatchKey((k) => k + 1)}>
                  <RotateCcw className="h-5 w-5" />
                </IconButton>
              </>
            ) : outcome ? (
              <UIButton onClick={resetAttempt}>{outcome.result?.accepted ? t("trace.action.next") : t("trace.action.tryAgain")}</UIButton>
            ) : (
              <>
                {!guided && play !== "justDraw" && (
                  <UIButton icon={<Check className="h-4 w-4" />} onClick={check} disabled={inkCount === 0}>
                    {t("trace.action.check")}
                  </UIButton>
                )}
                <IconButton label={t("trace.action.undo")} onClick={undo} disabled={inkCount === 0}>
                  <Undo2 className="h-5 w-5" />
                </IconButton>
                <IconButton label={t("trace.action.clear")} onClick={resetAttempt} disabled={inkCount === 0}>
                  <Eraser className="h-5 w-5" />
                </IconButton>
                {play !== "justDraw" && (
                  <IconButton
                    label={t("trace.action.watchAgain")}
                    onClick={() => {
                      setWatchOnly(current >= 0 ? current : 0);
                      setWatchKey((k) => k + 1);
                    }}
                  >
                    <Eye className="h-5 w-5" />
                  </IconButton>
                )}
              </>
            )}
            {!sandbox && (
              <span className="ml-auto">
                <IconButton label={t("trace.report.button")} active={reporting !== null} onClick={() => setReporting(reporting ? null : { reason: null, note: "", sent: false })}>
                  <Flag className="h-5 w-5" />
                </IconButton>
              </span>
            )}
          </div>
          {reporting && (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
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
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Mode */}
          <div className={`flex flex-wrap gap-2 ${sandbox ? "hidden" : ""}`} role="radiogroup" aria-label={t("trace.mode.label")}>
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
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold ${play === m ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
              >
                {MODE_ICON[m]}
                {t(`trace.mode.${m}`)}
              </button>
            ))}
          </div>

          {/* Help switches */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {(play === "justDraw" ? (["ghost"] as Switch[]) : [...SWITCHES]).map((sw) => {
                const locked = play === "steps" || drill !== null;
                return (
                  <IconButton
                    key={sw}
                    label={`${t(`trace.switch.${sw}`)} · ${switches[sw] ? t("trace.on") : t("trace.off")}`}
                    active={switches[sw]}
                    disabled={locked}
                    onClick={() => {
                      setMySwitches((x) => ({ ...x, [sw]: !x[sw] }));
                      resetAttempt();
                    }}
                  >
                    {SWITCH_ICON[sw]}
                  </IconButton>
                );
              })}
            </div>
            {play === "steps" && drill === null && <p className="text-xs text-slate-500 dark:text-slate-400">{t("trace.switchesLocked")}</p>}
          </div>

          <p className="text-base text-slate-700 dark:text-slate-200">{hint}</p>

          {/* Copy: the model beside the empty grid */}
          {step === "copy" && play === "steps" && drill === null && !watching && <ModelPreview item={item} />}

          {suggestion && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-violet-50 p-4 dark:bg-violet-950/50">
              <p className="text-base text-violet-900 dark:text-violet-100">
                {suggestion.kind === "rest" ? t("trace.coach.rest") : t(`trace.coach.${suggestion.kind}`, { n: badge(suggestion.order, item) })}
              </p>
              <UIButton size="sm" onClick={takeSuggestion}>
                {suggestion.kind === "rest" ? t("trace.action.backToList") : t("trace.action.continue")}
              </UIButton>
              <UIButton size="sm" variant="secondary" onClick={() => setSuggestion(null)}>
                {t("trace.action.notNow")}
              </UIButton>
            </div>
          )}
        </div>
      </div>
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
