/**
 * Trace Studio — where an admin makes trace items: set the guide (a typed
 * letter or a book-page picture), build the strokes in order with the stroke
 * tools, set the writing steps, and test-write every step. Drafts live on this
 * device until Phase 3 adds publishing. See docs/TRACE_STUDIO_BUILD_PLAN.md.
 *
 * Layout: tools on the left, the canvas in the middle, and on the right the
 * panels in the order an admin works: Guide → Strokes → Selected stroke → Checks.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  Scaling,
  Scissors,
  MoveVertical,
  MoveHorizontal,
  Maximize,
  AlignCenter,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Circle,
  Copy,
  Crosshair,
  CopyPlus,
  Diamond,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  Group as Group2,
  Hand,
  Hash,
  Eye,
  EyeOff,
  Link2,
  Magnet,
  MapPin,
  Maximize2,
  Minus,
  Palette,
  PenLine,
  MousePointer2,
  Pencil,
  Play,
  Plus,
  Redo2,
  Shapes,
  Spline,
  Square,
  Target,
  Trash2,
  Undo2,
  Ungroup,
  Unlink,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { VoiceRecord } from "./VoiceRecord";
import { useT } from "../../lib/i18n";
import { UIBadge, UIButton, UIPageHeader, UIStepper, UITabs } from "../../components/ui";
import type { FitHow } from "../geometry/edit";
import {
  addLoop,
  bendSegment,
  blendAll,
  connectToPrevious,
  fitStroke,
  strokeBox,
  transformStroke,
  deleteNode,
  splitStrokeAt,
  mirrorStroke,
  moveNode,
  reverseStroke,
  setNodeType,
  simplifyStroke,
  straighten,
} from "../geometry/edit";
import type { Activity, NodeType, Sensitivity, StepId, Stroke, StrokeShape, TraceItem, TraceKind, Zone } from "../geometry/types";
import { activityOf, hasArt, modeOf } from "../geometry/types";
import { PaintSteps } from "./PaintSteps";
import { fittedPixels, loadImage, pictureFrom } from "../paint/picture";
import { PaintPicture } from "./PaintPicture";
import { PaintPublish } from "./PaintPublish";
import { ColorPlayer } from "../paint/ColorPlayer";
import type { StepPlan } from "../progress/ladder";
import { defaultPlan } from "../progress/ladder";
import { TracePlayer } from "../player/TracePlayer";
import { badge } from "../player/render";
import { allPass, runChecks } from "./checks";
import { StrokeClipboard, pasteStrokes } from "./clipboard";
import { CollectionBoard, CollectionsList } from "./Collections";
import { ItemsList } from "./ItemsList";
import { AutoStrokesButton } from "./AutoStrokesPanel";
import { expandGroups, groupStrokes, mirrorSelection, remapGroups, ungroupStrokes } from "./groups";
import type { TraceDraft } from "./drafts";
import { TraceDrafts, blankItem, newDraft, strokesPrint } from "./drafts";
import type { Primitive } from "./primitives";
import { PRIMITIVES, makePrimitive } from "./primitives";
import type { EditMode, Magic, View } from "./StrokeEditor";
import { FULL_VIEW, StrokeEditor, zoomView } from "./StrokeEditor";
import { Divider, Field, Group, IconButton, IconSegment, Section, ShapeIcon, Slider, inputCls } from "./ui";

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ALL_STEPS: StepId[] = ["watch", "big", "guided", "faded", "copy", "memory"];
const KINDS: TraceKind[] = ["letter", "mark", "numeral", "word", "line", "drawing"];
const SHAPES: StrokeShape[] = ["line", "curve", "hook", "loop", "dot", "free"];
const GRIDS: TraceItem["grid"][] = ["4x3-moeys", "3x3", "baseline-4-lines", "dots", "none"];
const ZONES: Zone[] = ["above", "below", "left", "right", "around"];

const TOOLS: { mode: EditMode; key: string; icon: React.ReactNode }[] = [
  { mode: "adjust", key: "V", icon: <MousePointer2 className="h-5 w-5" /> },
  { mode: "add", key: "A", icon: <Plus className="h-5 w-5" /> },
  { mode: "pen", key: "P", icon: <Pencil className="h-5 w-5" /> },
  { mode: "pin", key: "K", icon: <MapPin className="h-5 w-5" /> },
  { mode: "cut", key: "C", icon: <Scissors className="h-5 w-5" /> },
  { mode: "hand", key: "H", icon: <Hand className="h-5 w-5" /> },
];

const renumber = (strokes: Stroke[]) => strokes.map((s, i) => ({ ...s, order: i + 1, join: i === 0 ? ("lift" as const) : s.join }));

/* ================================================================= list */

export function TraceStudio() {
  const { t } = useT();
  useSyncExternalStore(TraceDrafts.subscribe, TraceDrafts.version);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"collections" | "items">("collections");
  const [openCollection, setOpenCollection] = useState<string | null>(null);
  const [creatingCollection, setCreatingCollection] = useState(false);
  useEffect(() => {
    void TraceDrafts.pull();
  }, []);

  if (openId) return <DraftEditor key={openId} id={openId} onClose={() => setOpenId(null)} />;
  const sync = TraceDrafts.syncState();
  const itemCount = TraceDrafts.list().length;

  const create = (item: TraceItem) => {
    TraceDrafts.save(newDraft(item));
    setOpenId(item.id);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <UIPageHeader
        eyebrow={t("traceStudio.eyebrow")}
        title={t("traceStudio.title")}
        subtitle={t("traceStudio.subtitle")}
        action={
          view === "items" ? (
            <UIButton icon={<Plus className="h-4 w-4" />} onClick={() => create(blankItem(uid("t-")))}>
              {t("traceStudio.newItem")}
            </UIButton>
          ) : !openCollection && !creatingCollection ? (
            <UIButton icon={<Plus className="h-4 w-4" />} onClick={() => setCreatingCollection(true)}>
              {t("traceStudio.col.new")}
            </UIButton>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <UITabs<"collections" | "items">
          label={t("traceStudio.title")}
          value={view}
          onChange={(v) => {
            setView(v);
            setOpenCollection(null);
            setCreatingCollection(false);
          }}
          items={[
            { id: "collections", label: t("traceStudio.view.collections") },
            { id: "items", label: t("traceStudio.view.items"), count: itemCount },
          ]}
        />
        <UIBadge variant={sync === "offline" ? "danger" : "neutral"} className="ml-auto inline-flex items-center gap-1">
          {sync === "offline" ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {t(`traceStudio.sync.${sync}`)}
        </UIBadge>
      </div>

      {view === "collections" ? (
        openCollection ? (
          <CollectionBoard id={openCollection} onBack={() => setOpenCollection(null)} onOpenItem={setOpenId} />
        ) : (
          <CollectionsList onOpen={setOpenCollection} onOpenItem={setOpenId} creating={creatingCollection} onCreating={setCreatingCollection} />
        )
      ) : (
        <>
        <ItemsList kinds={KINDS} onOpen={setOpenId} onCreate={() => create(blankItem(uid("t-")))} />
        </>
      )}
    </div>
  );
}

/* =============================================================== editor */

/** A colouring item adds "picture"; its "shape" view (extra lines) opens from the Picture tab. */
type Tab = "picture" | "shape" | "steps" | "details" | "publish";
/** A colouring item is made in this order; the stepper and Back/Next walk it. */
const COLOR_FLOW = ["picture", "steps", "details", "publish"] as const;

function DraftEditor({ id, onClose }: { id: string; onClose(): void }) {
  const { t } = useT();
  const [draft, setDraft] = useState<TraceDraft>(() => TraceDrafts.get(id) ?? newDraft(blankItem(uid("t-"))));
  const [past, setPast] = useState<TraceItem[]>([]);
  const [future, setFuture] = useState<TraceItem[]>([]);
  const [tab, setTab] = useState<Tab>(() => (TraceDrafts.get(id)?.item.activity === "color" ? "picture" : "shape"));
  const [mode, setMode] = useState<EditMode>("adjust");
  const [magic, setMagic] = useState<Magic>({ snap: true, autoConnect: true, gridOnly: false });
  const [showCps, setShowCps] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [view, setView] = useState<View>(FULL_VIEW);
  const [selection, setSelection] = useState<number[]>([]);
  // One stroke selected = edit its points; several = act on them together.
  const sel = selection.length === 1 ? selection[0] : null;
  const [selNode, setSelNode] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const item = draft.item;

  // Autosave.
  useEffect(() => {
    const h = window.setTimeout(() => setSaveFailed(!TraceDrafts.save(draft)), 350);
    return () => window.clearTimeout(h);
  }, [draft]);

  const setItem = useCallback((next: TraceItem) => setDraft((d) => ({ ...d, item: next })), []);
  const itemRef = useRef(item);
  itemRef.current = item;
  const begin = useCallback(() => {
    setPast((p) => [...p.slice(-100), itemRef.current]);
    setFuture([]);
  }, []);
  const edit = (next: TraceItem) => {
    begin();
    setItem(next);
  };
  const setStrokes = useCallback((strokes: Stroke[]) => setItem({ ...itemRef.current, strokes: renumber(strokes) }), [setItem]);
  const editStroke = (fn: (s: Stroke) => Stroke) => {
    if (sel === null) return;
    edit({ ...item, strokes: renumber(item.strokes.map((s, i) => (i === sel ? fn(s) : s))) });
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture([item, ...future]);
    setItem(prev);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, item]);
    setItem(next);
  };
  const history = { undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
  const select = (s: number | null, n: number | null = null) => {
    setSelection(s === null ? [] : [s]);
    setSelNode(n);
  };
  /** Cut the selected stroke at the selected point: the rest becomes the next stroke, pen lifted. */
  const splitHere = () => {
    if (sel === null || selNode === null) return;
    const parts = splitStrokeAt(item.strokes[sel], selNode, uid("s"));
    if (!parts) return;
    edit({ ...item, strokes: renumber([...item.strokes.slice(0, sel), ...parts, ...item.strokes.slice(sel + 1)]) });
    select(parts.length === 2 ? sel + 1 : sel);
  };
  const selectMany = (indexes: number[]) => {
    setSelection([...new Set(indexes)].sort((a, b) => a - b));
    setSelNode(null);
  };
  const removeStroke = (i: number) => removeMany([i]);
  const removeMany = (indexes: number[]) => {
    const gone = new Set(indexes);
    edit({ ...item, strokes: renumber(item.strokes.filter((_, k) => !gone.has(k))) });
    select(null);
  };
  const group = () => {
    if (selection.length < 2) return;
    edit({ ...item, strokes: groupStrokes(item.strokes, selection, uid("g")) });
  };
  const ungroup = () => {
    if (selection.length === 0) return;
    edit({ ...item, strokes: ungroupStrokes(item.strokes, selection) });
  };
  const moveMany = (dx: number, dy: number) =>
    edit({ ...item, strokes: item.strokes.map((s, i) => (selection.includes(i) ? transformStroke(s, 1, 1, { x: 0, y: 0 }, dx, dy) : s)) });
  const duplicateMany = () => {
    if (selection.length === 0) return;
    const added = remapGroups(pasteStrokes(selection.map((i) => item.strokes[i]), item.strokes, () => uid("s")), () => uid("g"));
    edit({ ...item, strokes: renumber([...item.strokes, ...added]) });
    selectMany(added.map((_, k) => item.strokes.length + k));
  };
  const moveStroke = (i: number, dir: -1 | 1) => swapStrokes(i, i + dir);
  /** Trade two strokes' places in the order — 3 becomes 1 and 1 becomes 3; the rest stay put. */
  const swapStrokes = (i: number, j: number) => {
    if (i === j || j < 0 || j >= item.strokes.length) return;
    const next = [...item.strokes];
    [next[i], next[j]] = [next[j], next[i]];
    edit({ ...item, strokes: renumber(next) });
    select(j);
  };
  const [clipCount, setClipCount] = useState(() => StrokeClipboard.read().length);
  /** Copy the selection, or every stroke when nothing is selected. */
  const copy = (cut = false) => {
    const strokes = selection.length > 0 ? selection.map((i) => item.strokes[i]) : item.strokes;
    if (strokes.length === 0) return;
    StrokeClipboard.copy(strokes);
    setClipCount(strokes.length);
    if (cut && selection.length > 0) removeMany(selection);
  };
  const paste = () => {
    const copied = StrokeClipboard.read();
    if (copied.length === 0) return;
    const added = remapGroups(pasteStrokes(copied, item.strokes, () => uid("s")), () => uid("g"));
    edit({ ...item, strokes: renumber([...item.strokes, ...added]) });
    selectMany(added.map((_, k) => item.strokes.length + k));
    setMode("adjust");
  };

  const addPrimitive = (p: Primitive) => {
    edit({ ...item, strokes: renumber([...item.strokes, makePrimitive(p, uid("s"), item.strokes.length + 1)]) });
    select(item.strokes.length);
    setMode("adjust");
  };

  // Keyboard shortcuts.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
    const key = e.key.toLowerCase();
    // Undo works wherever the item is edited on a canvas: strokes, and a colouring item's picture and steps.
    if ((e.metaKey || e.ctrlKey) && key === "z" && (tab === "shape" || tab === "picture" || (tab === "steps" && activity === "color"))) {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (tab !== "shape") return;
    if ((e.metaKey || e.ctrlKey) && key === "g") {
      e.preventDefault();
      return e.shiftKey ? ungroup() : group();
    }
    if ((e.metaKey || e.ctrlKey) && key === "a") {
      e.preventDefault();
      return selectMany(item.strokes.map((_, i) => i));
    }
    if ((e.metaKey || e.ctrlKey) && (key === "c" || key === "x" || key === "v" || key === "d")) {
      // Leave the page's own copy alone when text is selected.
      if (key !== "v" && window.getSelection()?.toString()) return;
      e.preventDefault();
      if (key === "c") return copy();
      if (key === "x") return copy(true);
      if (key === "d") return duplicateMany();
      return paste();
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tool = TOOLS.find((x) => x.key.toLowerCase() === key);
    if (tool) return setMode(tool.mode);
    if (key === "x") return splitHere();
    if (key === "=" || key === "+") return setView((v) => zoomView(v, 1.25));
    if (key === "-") return setView((v) => zoomView(v, 0.8));
    if (key === "0") return setView(FULL_VIEW);
    if (key === "escape") return select(null);
    if (key === "g") return setShowGrid((v) => !v);
    if (key === "[" || key === "]") {
      if (item.strokes.length === 0) return;
      const n = item.strokes.length;
      return select(sel === null ? 0 : (sel + (key === "]" ? 1 : n - 1)) % n);
    }
    const step = e.shiftKey ? 10 : 1;
    const d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[key];
    if (selection.length > 1) {
      if (d) {
        e.preventDefault();
        moveMany(d[0], d[1]);
      } else if (key === "delete" || key === "backspace") {
        e.preventDefault();
        removeMany(selection);
      }
      return;
    }
    if (sel === null) return;
    const s = item.strokes[sel];
    if (d && selNode !== null && s?.nodes[selNode]) {
      e.preventDefault();
      const n = s.nodes[selNode];
      editStroke((x) => moveNode(x, selNode, { x: n.x + d[0], y: n.y + d[1] }));
    } else if (d && s) {
      // No point selected: arrows move the whole stroke.
      e.preventDefault();
      editStroke((x) => transformStroke(x, 1, 1, { x: 0, y: 0 }, d[0], d[1]));
    } else if (key === "delete" || key === "backspace") {
      e.preventDefault();
      if (selNode !== null && s && s.nodes.length > 2) {
        editStroke((x) => deleteNode(x, selNode));
        setSelNode(null);
      } else removeStroke(sel);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const checks = useMemo(() => runChecks(draft), [draft]);
  const issues = checks.filter((c) => !c.ok).length;
  const selected = sel !== null ? item.strokes[sel] : undefined;
  const node = selected && selNode !== null ? selected.nodes[selNode] : undefined;
  const activity = activityOf(item);
  // A picture made before its real lines were kept: find them once (no undo step — nothing the author did).
  const upgrading = useRef(false);
  useEffect(() => {
    const picture = item.paint?.picture;
    const src = item.guide?.image?.src;
    if (activity !== "color" || !picture || picture.raw || !src || upgrading.current) return;
    upgrading.current = true;
    void loadImage(src)
      .then((img) => {
        const fresh = pictureFrom(fittedPixels(img), picture.strength, picture.gap ?? 0, picture.erase ?? []);
        const cur = itemRef.current;
        if (cur.paint?.picture?.walls === picture.walls) setItem({ ...cur, paint: { ...cur.paint, steps: cur.paint.steps, picture: { ...fresh, smooth: picture.smooth } } });
      })
      .catch(() => undefined);
  }, [activity, item.paint?.picture, item.guide?.image?.src, setItem]);
  const [tryingColor, setTryingColor] = useState(false);
  /** Where a colouring item is in its flow: drawing extra lines belongs to the Picture step. */
  const flowAt: (typeof COLOR_FLOW)[number] = tab === "shape" || tab === "picture" ? "picture" : tab;
  const paintSteps = item.paint?.steps ?? [];
  const flowDone: Record<(typeof COLOR_FLOW)[number], boolean> = {
    picture: hasArt(item),
    steps: paintSteps.length > 0 && checks.every((c) => c.id !== "paintAreas" || c.ok),
    details: item.title.trim().length > 0,
    publish: issues === 0,
  };
  /** Trace or Color. Colouring a picture is drawing, so a writing kind becomes a drawing; the grid goes, and the colour steps are kept either way. */
  const setActivity = (next: Activity) => {
    if (next === activity) return;
    edit(
      next === "color"
        ? { ...item, activity: "color", kind: modeOf(item.kind) === "writing" ? "drawing" : item.kind, grid: "none", paint: item.paint ?? { steps: [] } }
        : { ...item, activity: "trace" },
    );
    setTab(next === "color" ? "picture" : tab === "picture" ? "shape" : tab);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-10">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <IconButton label={t("traceStudio.allItems")} onClick={onClose} tip="right">
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-bold leading-tight text-ink" lang={item.script === "khmer" ? "km" : undefined}>
            {item.title || t("traceStudio.untitled")}
          </h1>
          <span className={`flex items-center gap-1 text-xs ${saveFailed ? "text-rose-700 dark:text-rose-300" : "text-muted"}`}>
            {saveFailed ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {t(`traceStudio.kind.${item.kind}`)} · {saveFailed ? t("traceStudio.saveFailed") : t("traceStudio.saved")}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ActivitySwitch value={activity} onChange={setActivity} />
          {activity === "trace" && (
            <UITabs<Tab>
              label={t("traceStudio.title")}
              onChange={setTab}
              value={tab}
              items={(["shape", "steps", "details"] as const).map((x) => ({ id: x, label: t(`traceStudio.tab.${x}`) }))}
            />
          )}
          <UIBadge variant={issues ? "danger" : "success"} className="inline-flex items-center gap-1">
            {issues ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {issues ? t("traceStudio.issues", { count: issues }) : t("traceStudio.ready")}
          </UIBadge>
        </div>
      </div>

      {activity === "color" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <UIStepper
            label={t("traceStudio.flow.label")}
            current={COLOR_FLOW.indexOf(flowAt)}
            onSelect={(i) => {
              setTryingColor(false);
              setTab(COLOR_FLOW[i]);
            }}
            steps={COLOR_FLOW.map((x) => ({ id: x, label: t(`traceStudio.flow.${x}`), complete: flowDone[x] }))}
          />
          <p className="text-sm text-muted">{t(`traceStudio.flow.${flowAt}Hint`)}</p>
        </div>
      )}

      {activity === "color" && tab === "shape" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-indigo-50/60 px-4 py-2.5 text-sm text-body dark:bg-indigo-950/30">
          <PenLine className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
          <span className="min-w-0 flex-1">{t("traceStudio.flow.linesNote")}</span>
          <UIButton size="sm" onClick={() => setTab("picture")}>
            {t("traceStudio.flow.linesDone")}
          </UIButton>
        </div>
      )}

      {tab === "shape" && (
        <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_360px]">
          {/* Tool rail */}
          <nav aria-label={t("traceStudio.tools")} className="flex flex-row items-center justify-between self-stretch rounded-2xl border border-line bg-surface p-1.5 sm:flex-wrap sm:justify-start sm:gap-1 lg:sticky lg:top-4 lg:flex-col lg:self-start">
            {TOOLS.map((tool) => (
              <IconButton key={tool.mode} label={t(`traceStudio.mode.${tool.mode}`)} shortcut={tool.key} active={mode === tool.mode} onClick={() => setMode(tool.mode)} tip="right">
                {tool.icon}
              </IconButton>
            ))}
            <span className="hidden lg:block">
              <Divider />
            </span>
            <span className="lg:hidden">
              <Divider vertical />
            </span>
            <ShapePicker onPick={addPrimitive} />
            <AutoStrokesButton
              item={item}
              onStrokes={(strokes) => {
                edit({ ...item, strokes: renumber(strokes) });
                select(strokes.length ? 0 : null);
                setMode("adjust");
              }}
            />
          </nav>

          {/* Canvas */}
          <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {/* One row on a phone, scrolled sideways (wrapped, it would take rows off the canvas); the voice stays pinned at the end. */}
            <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:[mask-image:none] [&>*]:shrink-0">
                <IconButton size="sm" label={t("traceStudio.undo")} shortcut="⌘Z" onClick={undo} disabled={past.length === 0}>
                  <Undo2 className="h-4 w-4" />
                </IconButton>
                <IconButton size="sm" label={t("traceStudio.redo")} shortcut="⇧⌘Z" onClick={redo} disabled={future.length === 0}>
                  <Redo2 className="h-4 w-4" />
                </IconButton>
                <Divider vertical />
                <IconButton size="sm" label={sel !== null ? t("traceStudio.copyStroke") : t("traceStudio.copyAll")} shortcut="⌘C" onClick={() => copy()} disabled={item.strokes.length === 0}>
                  <CopyPlus className="h-4 w-4" />
                </IconButton>
                <IconButton size="sm" label={t("traceStudio.paste", { count: clipCount })} shortcut="⌘V" onClick={paste} disabled={clipCount === 0}>
                  <ClipboardPaste className="h-4 w-4" />
                </IconButton>
                <Divider vertical />
                <IconButton size="sm" label={t("traceStudio.zoomOut")} shortcut="−" onClick={() => setView((v) => zoomView(v, 0.8))} disabled={view.size >= 1000}>
                  <ZoomOut className="h-4 w-4" />
                </IconButton>
                <span className="w-12 text-center font-mono text-xs tabular-nums text-muted">{Math.round((1000 / view.size) * 100)}%</span>
                <IconButton size="sm" label={t("traceStudio.zoomIn")} shortcut="+" onClick={() => setView((v) => zoomView(v, 1.25))}>
                  <ZoomIn className="h-4 w-4" />
                </IconButton>
                <IconButton size="sm" label={t("traceStudio.fit")} shortcut="0" onClick={() => setView(FULL_VIEW)} disabled={view.size >= 1000}>
                  <Maximize2 className="h-4 w-4" />
                </IconButton>
                <Divider vertical />
                <IconButton size="sm" label={t("traceStudio.snap")} active={magic.snap} onClick={() => setMagic((m) => ({ ...m, snap: !m.snap }))}>
                  <Magnet className="h-4 w-4" />
                </IconButton>
                <IconButton size="sm" label={t("traceStudio.autoConnect")} active={magic.autoConnect} onClick={() => setMagic((m) => ({ ...m, autoConnect: !m.autoConnect }))}>
                  <Link2 className="h-4 w-4" />
                </IconButton>
                <IconButton size="sm" label={t("traceStudio.gridOnly")} active={magic.gridOnly} onClick={() => setMagic((m) => ({ ...m, gridOnly: !m.gridOnly }))}>
                  <Crosshair className="h-4 w-4" />
                </IconButton>
                <Divider vertical />
                <IconButton size="sm" label={t("traceStudio.showGrid")} shortcut="G" active={showGrid} onClick={() => setShowGrid((v) => !v)}>
                  <Grid3x3 className="h-4 w-4" />
                </IconButton>
                <IconButton size="sm" label={t("traceStudio.checkpoints")} active={showCps} onClick={() => setShowCps((v) => !v)}>
                  <Target className="h-4 w-4" />
                </IconButton>
              </div>
              <Divider vertical />
              <VoiceRecord
                item={item}
                onVoice={(voice, voiceText) => {
                  // Read now, not at render: an upload takes a while and the author may have edited since.
                  const { voice: _v, voiceText: _w, ...rest } = itemRef.current;
                  edit({ ...rest, ...(voice ? { voice } : {}), ...(voice && voiceText ? { voiceText } : {}) });
                }}
              />
            </div>
            <StrokeEditor
              item={item}
              selection={selection}
              selectedNode={selNode}
              mode={mode}
              magic={magic}
              showCheckpoints={showCps || mode === "pin"}
              showGrid={showGrid}
              lineArt={activity === "color"}
              view={view}
              onView={setView}
              onSelect={(s, n) => {
                setSelection(s);
                setSelNode(n ?? null);
              }}
              onBegin={begin}
              onChange={setStrokes}
              newId={() => uid("s")}
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-2 text-xs text-muted">
              <span className="font-semibold text-body">{t(`traceStudio.mode.${mode}`)}</span>
              <span className="min-w-0 flex-1">{t(`traceStudio.modeHint.${mode}`)}</span>
              {selected && (
                <span className="font-mono tabular-nums">
                  {t("traceStudio.strokeN", { n: badge(selected.order, item) })}
                  {node && ` · ${t("traceStudio.pointN", { n: (selNode ?? 0) + 1 })} · ${Math.round(node.x)}, ${Math.round(node.y)}`}
                </span>
              )}
            </div>
          </div>

          {/* Panels, in working order */}
          <div className="flex min-w-0 flex-col gap-3 lg:col-span-2 xl:col-span-1">
            <Section title={t("traceStudio.guide")} defaultOpen={item.strokes.length === 0}>
              <GuidePanel item={item} onChange={edit} />
            </Section>

            <Section title={t("traceStudio.strokes")} aside={t("traceStudio.strokeCount", { count: item.strokes.length })}>
              {item.strokes.length === 0 ? (
                <p className="text-sm text-muted">{t("traceStudio.noStrokes")}</p>
              ) : (
                <ol className="-mx-2 flex flex-col">
                  {item.strokes.map((s, i) => {
                    const Icon = ShapeIcon[s.shape === "curve" ? "curve" : s.shape];
                    return (
                      <li key={s.id} className={`group flex items-center gap-2 rounded-xl px-2 py-1 ${selection.includes(i) ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-surface-muted"}`}>
                        <button
                          onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? selectMany(selection.includes(i) ? selection.filter((x) => x !== i) : [...selection, i]) : select(i))}
                          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${selection.includes(i) ? "bg-indigo-600" : "bg-indigo-300 dark:bg-indigo-700"}`}>{badge(s.order, item)}</span>
                          <span className="text-indigo-700 dark:text-indigo-300">
                            <Icon />
                          </span>
                          <span className="truncate text-sm text-ink">{t(`traceStudio.shape.${s.shape}`)}</span>
                          {s.group && (
                            <span title={t("traceStudio.inGroup")} className="text-indigo-500">
                              <Group2 className="h-4 w-4" />
                            </span>
                          )}
                          {s.join === "continue" && (
                            <span title={t("traceStudio.carriesOn")} className="text-muted">
                              <Link2 className="h-4 w-4" />
                            </span>
                          )}
                        </button>
                        <span className={`flex gap-0.5 ${selection.includes(i) ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
                          <IconButton size="sm" label={t("traceStudio.moveUp")} shortcut="" disabled={i === 0} onClick={() => moveStroke(i, -1)}>
                            <ChevronUp className="h-4 w-4" />
                          </IconButton>
                          <IconButton size="sm" label={t("traceStudio.moveDown")} disabled={i === item.strokes.length - 1} onClick={() => moveStroke(i, 1)}>
                            <ChevronDown className="h-4 w-4" />
                          </IconButton>
                          <IconButton size="sm" tone="danger" label={t("traceStudio.delete")} onClick={() => removeStroke(i)}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Section>

            {selection.length > 1 ? (
              <Section title={t("traceStudio.selectedCount", { count: selection.length })}>
                <Group label={t("traceStudio.groupLabel")}>
                  <IconButton size="sm" label={t("traceStudio.group")} shortcut="⌘G" onClick={group}>
                    <Group2 className="h-4 w-4" />
                  </IconButton>
                  <IconButton size="sm" label={t("traceStudio.ungroup")} shortcut="⇧⌘G" disabled={!selection.some((i) => item.strokes[i]?.group)} onClick={ungroup}>
                    <Ungroup className="h-4 w-4" />
                  </IconButton>
                </Group>
                <Group label={t("traceStudio.groupTransform")}>
                  <IconButton size="sm" label={t("traceStudio.mirrorH")} onClick={() => edit({ ...item, strokes: mirrorSelection(item.strokes, selection, "horizontal") })}>
                    <FlipHorizontal2 className="h-4 w-4" />
                  </IconButton>
                  <IconButton size="sm" label={t("traceStudio.mirrorV")} onClick={() => edit({ ...item, strokes: mirrorSelection(item.strokes, selection, "vertical") })}>
                    <FlipVertical2 className="h-4 w-4" />
                  </IconButton>
                  <IconButton size="sm" label={t("traceStudio.duplicate")} shortcut="⌘D" onClick={duplicateMany}>
                    <Copy className="h-4 w-4" />
                  </IconButton>
                  <IconButton size="sm" tone="danger" label={t("traceStudio.delete")} shortcut="⌫" onClick={() => removeMany(selection)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </Group>
                <p className="text-xs text-muted">{t("traceStudio.multiHint")}</p>
              </Section>
            ) : selected && sel !== null ? (
              <Section key={selected.id} title={t("traceStudio.strokeN", { n: badge(selected.order, item) })}>
                {selected.group && (
                  <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                    <Group2 className="h-4 w-4" />
                    <span className="flex-1">{t("traceStudio.inGroup")}</span>
                    <button className="font-semibold underline-offset-2 hover:underline" onClick={() => selectMany(expandGroups(item.strokes, [sel!]))}>
                      {t("traceStudio.selectGroup")}
                    </button>
                    <button className="font-semibold underline-offset-2 hover:underline" onClick={ungroup}>
                      {t("traceStudio.ungroup")}
                    </button>
                  </div>
                )}
                {item.strokes.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted">{t("traceStudio.order")}</span>
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("traceStudio.order")}>
                      {item.strokes.map((s, j) => (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={j === sel}
                          title={j === sel ? undefined : t("traceStudio.swapWith", { n: badge(s.order, item) })}
                          onClick={() => swapStrokes(sel, j)}
                          className={`${themeSystem.button(j === sel ? "primary" : "secondary", "icon")} min-w-10 text-sm`}
                        >
                          {badge(s.order, item)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted">{t("traceStudio.orderHint")}</p>
                  </div>
                )}
                <Inspector
                  stroke={selected}
                  index={sel}
                  node={selNode}
                  item={item}
                  onEdit={editStroke}
                  onDuplicate={() => {
                    edit({ ...item, strokes: renumber([...item.strokes, { ...structuredClone(selected), id: uid("s"), join: "lift" }]) });
                    select(item.strokes.length);
                  }}
                  onDelete={() => removeStroke(sel)}
                  onSplitNode={splitHere}
                  onDeleteNode={() => {
                    if (selNode === null) return;
                    editStroke((x) => deleteNode(x, selNode));
                    setSelNode(null);
                  }}
                  onConnect={() => sel > 0 && editStroke((s) => connectToPrevious(s, item.strokes[sel - 1]))}
                  onFit={(target, how) => editStroke((s) => fitStroke(s, strokeBox(item.strokes[target]), how))}
                />
              </Section>
            ) : (
              <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">{t("traceStudio.selectHint")}</p>
            )}

            <Section title={t("traceStudio.checksTitle")} defaultOpen={false} aside={issues ? t("traceStudio.issues", { count: issues }) : t("traceStudio.ready")}>
              <ChecksList checks={checks} />
            </Section>
          </div>
        </div>
      )}

      {tab === "picture" && <PaintPicture item={item} onChange={edit} history={history} onDrawLines={() => setTab("shape")} onNext={() => setTab("steps")} />}
      {tab === "steps" && (activity === "color" ? <PaintSteps item={item} onChange={edit} history={history} /> : <StepsPanel draft={draft} onChange={setDraft} checks={checks} />)}
      {tab === "details" && <DetailsPanel item={item} onChange={edit} />}
      {tab === "publish" &&
        (tryingColor ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <UIButton size="sm" variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setTryingColor(false)}>
                {t("traceStudio.paint.backToEdit")}
              </UIButton>
              <span className="text-sm text-muted">{t("traceStudio.paint.tryNote")}</span>
            </div>
            <ColorPlayer item={item} sandbox onExit={() => setTryingColor(false)} />
          </div>
        ) : (
          <PaintPublish item={item} ready={issues === 0} checks={<ChecksList checks={checks} />} onTry={() => setTryingColor(true)} />
        ))}

      {/* Back and Next through a colouring item's steps (the Picture step has its own Next). */}
      {activity === "color" && (tab === "steps" || tab === "details" || (tab === "publish" && !tryingColor)) && (
        <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
          <UIButton variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setTab(COLOR_FLOW[COLOR_FLOW.indexOf(flowAt) - 1])}>
            {t(`traceStudio.flow.${COLOR_FLOW[COLOR_FLOW.indexOf(flowAt) - 1]}`)}
          </UIButton>
          {flowAt !== "publish" && (
            <UIButton icon={<ArrowRight className="h-4 w-4" />} onClick={() => setTab(COLOR_FLOW[COLOR_FLOW.indexOf(flowAt) + 1])}>
              {t("traceStudio.flow.next", { step: t(`traceStudio.flow.${COLOR_FLOW[COLOR_FLOW.indexOf(flowAt) + 1]}`) })}
            </UIButton>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================== pieces */

/** What the child does with this item: trace its strokes, or colour its line art. */
function ActivitySwitch({ value, onChange }: { value: Activity; onChange(a: Activity): void }) {
  const { t } = useT();
  const options: { id: Activity; icon: React.ReactNode }[] = [
    { id: "trace", icon: <PenLine className="h-4 w-4" /> },
    { id: "color", icon: <Palette className="h-4 w-4" /> },
  ];
  return (
    <div role="radiogroup" aria-label={t("traceStudio.activity.label")} className="flex items-center gap-0.5 rounded-xl bg-surface-muted p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          title={t(`traceStudio.activity.${o.id}Hint`)}
          onClick={() => onChange(o.id)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            value === o.id ? "bg-surface text-indigo-700 shadow-sm dark:text-indigo-300" : "text-muted hover:text-ink"
          }`}
        >
          {o.icon}
          {t(`traceStudio.activity.${o.id}`)}
        </button>
      ))}
    </div>
  );
}

/** One rail button that opens every ready-made shape; each is added as an ordinary, editable stroke. */
function ShapePicker({ onPick }: { onPick(p: Primitive): void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <IconButton label={t("traceStudio.shapes")} active={open} onClick={() => setOpen((o) => !o)} tip="right">
        <Shapes className="h-5 w-5" />
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-line bg-surface p-3 shadow-xl lg:left-full lg:top-0 lg:ml-2 lg:mt-0"
        >
          <p className="mb-2 text-xs text-muted">{t("traceStudio.shapesNote")}</p>
          <div className="grid grid-cols-4 gap-1">
            {PRIMITIVES.map((p) => {
              const Icon = ShapeIcon[p];
              return (
                <button
                  key={p}
                  role="menuitem"
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] text-muted hover:bg-indigo-50 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200"
                >
                  <Icon />
                  <span className="leading-tight">{t(`traceStudio.primitive.${p}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Inspector({
  stroke,
  index,
  node,
  item,
  onEdit,
  onDuplicate,
  onDelete,
  onDeleteNode,
  onSplitNode,
  onConnect,
  onFit,
}: {
  stroke: Stroke;
  index: number;
  node: number | null;
  item: TraceItem;
  onEdit(fn: (s: Stroke) => Stroke): void;
  onDuplicate(): void;
  onDelete(): void;
  onDeleteNode(): void;
  onSplitNode(): void;
  onConnect(): void;
  onFit(target: number, how: FitHow): void;
}) {
  const { t } = useT();
  const others = item.strokes.flatMap((s, i) => (i !== index && s.nodes.length > 1 && s.shape !== "dot" ? [i] : []));
  const [fitTarget, setFitTarget] = useState<number | null>(null);
  const target = fitTarget !== null && others.includes(fitTarget) ? fitTarget : (others[0] ?? null);
  const dot = stroke.shape === "dot" || stroke.nodes.length === 1;
  // Bend/straighten act on the segment that starts at the selected point (or the first).
  const seg = node !== null ? Math.min(node, Math.max(0, stroke.nodes.length - (stroke.closed ? 1 : 2))) : 0;
  const n = node !== null ? stroke.nodes[node] : undefined;
  const icon = "h-4 w-4";
  return (
    <>
      <Group label={t("traceStudio.shapeLabel")}>
        <IconSegment<StrokeShape>
          value={stroke.shape}
          onChange={(v) => onEdit((s) => ({ ...s, shape: v }))}
          options={SHAPES.map((x) => {
            const Icon = ShapeIcon[x];
            return { value: x, label: t(`traceStudio.shape.${x}`), icon: <Icon /> };
          })}
        />
      </Group>

      {!dot && (
        <Group label={t("traceStudio.groupCurve")}>
          <IconButton size="sm" label={t("traceStudio.bendUp")} onClick={() => onEdit((s) => bendSegment(s, seg, "up"))}>
            <ShapeIcon.bendUp />
          </IconButton>
          <IconButton size="sm" label={t("traceStudio.bendDown")} onClick={() => onEdit((s) => bendSegment(s, seg, "down"))}>
            <ShapeIcon.bendDown />
          </IconButton>
          <IconButton size="sm" label={node !== null ? t("traceStudio.straightenSegment") : t("traceStudio.straighten")} onClick={() => onEdit((s) => straighten(s, node !== null ? seg : undefined))}>
            <Minus className={icon} />
          </IconButton>
          <IconButton size="sm" label={t("traceStudio.blendAll")} onClick={() => onEdit(blendAll)}>
            <Spline className={icon} />
          </IconButton>
          {/* A round loop at the chosen point, or the end: the head of ង, which bending cannot make. */}
          {!stroke.closed && (
            <>
              <IconButton size="sm" label={t("traceStudio.loopLeft")} onClick={() => onEdit((s) => addLoop(s, node ?? s.nodes.length - 1, "left"))}>
                <RotateCcw className={icon} />
              </IconButton>
              <IconButton size="sm" label={t("traceStudio.loopRight")} onClick={() => onEdit((s) => addLoop(s, node ?? s.nodes.length - 1, "right"))}>
                <RotateCw className={icon} />
              </IconButton>
            </>
          )}
          <IconButton size="sm" label={t("traceStudio.simplify")} onClick={() => onEdit((s) => simplifyStroke(s, 4))}>
            <Wand2 className={icon} />
          </IconButton>
          <IconButton size="sm" label={stroke.closed ? t("traceStudio.open") : t("traceStudio.close")} active={stroke.closed} onClick={() => onEdit((s) => ({ ...s, closed: !s.closed }))}>
            <Circle className={icon} />
          </IconButton>
        </Group>
      )}

      <Group label={t("traceStudio.groupTransform")}>
        {!dot && (
          <IconButton size="sm" label={t("traceStudio.reverse")} onClick={() => onEdit(reverseStroke)}>
            <ArrowLeftRight className={icon} />
          </IconButton>
        )}
        <IconButton size="sm" label={t("traceStudio.mirrorH")} onClick={() => onEdit((s) => mirrorStroke(s, "horizontal"))}>
          <FlipHorizontal2 className={icon} />
        </IconButton>
        <IconButton size="sm" label={t("traceStudio.mirrorV")} onClick={() => onEdit((s) => mirrorStroke(s, "vertical"))}>
          <FlipVertical2 className={icon} />
        </IconButton>
        <IconButton size="sm" label={t("traceStudio.duplicate")} shortcut="⌘D" onClick={onDuplicate}>
          <Copy className={icon} />
        </IconButton>
        <IconButton size="sm" tone="danger" label={t("traceStudio.delete")} shortcut="⌫" onClick={onDelete}>
          <Trash2 className={icon} />
        </IconButton>
      </Group>

      <Group label={t("traceStudio.join")}>
        <IconSegment<Stroke["join"]>
          value={stroke.join}
          disabled={index === 0}
          onChange={(v) => onEdit((s) => ({ ...s, join: v }))}
          options={[
            { value: "lift", label: t("traceStudio.joinLift"), icon: <Unlink className={icon} /> },
            { value: "continue", label: t("traceStudio.joinContinue"), icon: <Link2 className={icon} /> },
          ]}
        />
        {index > 0 && (
          <IconButton size="sm" label={t("traceStudio.connectPrev")} onClick={onConnect}>
            <Magnet className={icon} />
          </IconButton>
        )}
      </Group>

      {!dot && target !== null && (
        <Group label={t("traceStudio.fitTo")}>
          <select aria-label={t("traceStudio.fitTo")} className={`${inputCls} w-auto min-w-28`} value={target} onChange={(e) => setFitTarget(Number(e.target.value))}>
            {others.map((i) => (
              <option key={i} value={i}>
                {t("traceStudio.strokeN", { n: badge(item.strokes[i].order, item) })}
              </option>
            ))}
          </select>
          <IconButton size="sm" label={t("traceStudio.fitInside")} onClick={() => onFit(target, "inside")}>
            <Scaling className={icon} />
          </IconButton>
          <IconButton size="sm" label={t("traceStudio.fitStretch")} onClick={() => onFit(target, "stretch")}>
            <Maximize className={icon} />
          </IconButton>
          <IconButton size="sm" label={t("traceStudio.fitWidth")} onClick={() => onFit(target, "width")}>
            <MoveHorizontal className={icon} />
          </IconButton>
          <IconButton size="sm" label={t("traceStudio.fitHeight")} onClick={() => onFit(target, "height")}>
            <MoveVertical className={icon} />
          </IconButton>
          <IconButton size="sm" label={t("traceStudio.fitCenter")} onClick={() => onFit(target, "center")}>
            <AlignCenter className={icon} />
          </IconButton>
        </Group>
      )}

      {stroke.badge && (
        <UIButton size="sm" variant="secondary" icon={<Hash className="h-4 w-4" />} onClick={() => onEdit((s) => ({ ...s, badge: undefined }))}>
          {t("traceStudio.autoBadge")}
        </UIButton>
      )}

      <Slider label={t("traceStudio.width")} value={stroke.width} min={30} max={140} onChange={(v) => onEdit((s) => ({ ...s, width: v }))} />

      {n && node !== null && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t("traceStudio.pointN", { n: node + 1 })}</span>
            <div className="flex items-center gap-0.5">
              <IconButton size="sm" label={t("traceStudio.splitHere")} shortcut="X" disabled={stroke.shape === "dot" || (!stroke.closed && (node === 0 || node === stroke.nodes.length - 1))} onClick={onSplitNode}>
                <Scissors className={icon} />
              </IconButton>
              <IconButton size="sm" tone="danger" label={t("traceStudio.deletePoint")} disabled={stroke.nodes.length <= 2} onClick={onDeleteNode}>
                <Trash2 className={icon} />
              </IconButton>
            </div>
          </div>
          <IconSegment<NodeType>
            value={n.type}
            onChange={(v) => onEdit((s) => setNodeType(s, node, v))}
            options={[
              { value: "corner", label: t("traceStudio.node.corner"), icon: <Square className={icon} /> },
              { value: "smooth", label: t("traceStudio.node.smooth"), icon: <Circle className={icon} /> },
              { value: "symmetric", label: t("traceStudio.node.symmetric"), icon: <Diamond className={icon} /> },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            {(["x", "y"] as const).map((axis) => (
              <Field key={axis} label={axis.toUpperCase()}>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  className={inputCls}
                  value={Math.round(n[axis])}
                  onChange={(e) => onEdit((s) => moveNode(s, node, { x: axis === "x" ? Number(e.target.value) : n.x, y: axis === "y" ? Number(e.target.value) : n.y }))}
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      <Field label={t("traceStudio.instruction")}>
        <input className={inputCls} value={stroke.instruction ?? ""} onChange={(e) => onEdit((s) => ({ ...s, instruction: e.target.value || undefined }))} />
      </Field>
      {!dot && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5" />
          {t("traceStudio.pinnedCount", { count: stroke.checkpoints.filter((c) => c.pinned).length })}
        </p>
      )}
    </>
  );
}

/** Downscale an uploaded picture so a draft stays small enough to keep on the device. */
function readPicture(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 900;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function GuidePanel({ item, onChange }: { item: TraceItem; onChange(i: TraceItem): void }) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const glyph = item.guide?.glyph ?? { text: "", size: 720, x: 500, y: 780 };
  const image = item.guide?.image;
  const setGlyph = (g: Partial<typeof glyph>) => onChange({ ...item, guide: { ...item.guide, glyph: { ...glyph, ...g } } });
  const setImage = (g: Partial<NonNullable<typeof image>>) => image && onChange({ ...item, guide: { ...item.guide, image: { ...image, ...g } } });
  return (
    <>
      <p className="text-xs text-muted">{t("traceStudio.guideNote")}</p>
      <Field label={t("traceStudio.glyph")}>
        <span className="flex items-center gap-1">
          <input className={`${inputCls} text-2xl`} lang="km" value={glyph.text} placeholder={t("traceStudio.glyphPlaceholder")} onChange={(e) => setGlyph({ text: e.target.value })} />
          {glyph.text && (
            <IconButton size="sm" label={glyph.hidden ? t("traceStudio.showGuide") : t("traceStudio.hideGuide")} active={!glyph.hidden} onClick={() => setGlyph({ hidden: !glyph.hidden })}>
              {glyph.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </IconButton>
          )}
        </span>
      </Field>
      {glyph.text && (
        <div className="grid grid-cols-3 gap-3">
          <Slider label={t("traceStudio.size")} value={glyph.size} min={200} max={1100} step={10} onChange={(v) => setGlyph({ size: v })} />
          <Slider label={t("traceStudio.left")} value={glyph.x} min={0} max={1000} step={5} onChange={(v) => setGlyph({ x: v })} />
          <Slider label={t("traceStudio.baseline")} value={glyph.y} min={200} max={1200} step={5} onChange={(v) => setGlyph({ y: v })} />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const src = await readPicture(f);
          onChange({ ...item, guide: { ...item.guide, image: { src, x: 0, y: 0, w: 1000, h: 1000, opacity: 0.5 } } });
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <UIButton size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
          {image ? t("traceStudio.replacePicture") : t("traceStudio.uploadPicture")}
        </UIButton>
        {image && (
          <IconButton size="sm" label={image.hidden ? t("traceStudio.showGuide") : t("traceStudio.hideGuide")} active={!image.hidden} onClick={() => setImage({ hidden: !image.hidden })}>
            {image.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </IconButton>
        )}
        {image && (
          <IconButton size="sm" tone="danger" label={t("traceStudio.removePicture")} onClick={() => onChange({ ...item, guide: { ...item.guide, image: undefined } })}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        )}
      </div>
      {image && (
        <div className="grid grid-cols-2 gap-3">
          <Slider label={t("traceStudio.opacity")} value={image.opacity} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setImage({ opacity: v })} />
          <Slider label={t("traceStudio.size")} value={image.w} min={300} max={2500} step={10} onChange={(v) => setImage({ w: v, h: v, x: image.x + (image.w - v) / 2, y: image.y + (image.h - v) / 2 })} />
          <Slider label={t("traceStudio.left")} value={image.x} min={-1500} max={1000} step={5} onChange={(v) => setImage({ x: v })} />
          <Slider label={t("traceStudio.top")} value={image.y} min={-1500} max={1000} step={5} onChange={(v) => setImage({ y: v })} />
        </div>
      )}
    </>
  );
}

function DetailsPanel({ item, onChange }: { item: TraceItem; onChange(i: TraceItem): void }) {
  const { t } = useT();
  // A colouring item has no stroke numbers or writing grid; "how strict" is how much of each step must be filled.
  const coloring = activityOf(item) === "color";
  return (
    <div className="max-w-3xl">
      <Section title={t("traceStudio.tab.details")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("traceStudio.titleLabel")}>
            <input
              className={`${inputCls} text-xl`}
              value={item.title}
              onChange={(e) => {
                const title = e.target.value;
                const glyph = item.guide?.glyph;
                // The typed guide follows the title until the admin changes it separately.
                const follow = glyph && modeOf(item.kind) === "writing" && (glyph.text === "" || glyph.text === item.title);
                onChange({ ...item, title, guide: follow ? { ...item.guide, glyph: { ...glyph!, text: title } } : item.guide });
              }}
            />
          </Field>
          <Field label={t("traceStudio.kindLabel")}>
            <select className={inputCls} value={item.kind} onChange={(e) => onChange({ ...item, kind: e.target.value as TraceKind })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`traceStudio.kind.${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("traceStudio.script")}>
            <select className={inputCls} value={item.script ?? ""} onChange={(e) => onChange({ ...item, script: (e.target.value || undefined) as TraceItem["script"] })}>
              <option value="khmer">{t("traceStudio.scriptKhmer")}</option>
              <option value="latin">{t("traceStudio.scriptLatin")}</option>
              <option value="">{t("traceStudio.scriptNone")}</option>
            </select>
          </Field>
          {!coloring && (
            <Field label={t("traceStudio.numerals")}>
              <select
                className={inputCls}
                value={item.numerals ?? (item.script === "khmer" ? "khmer" : "latin")}
                onChange={(e) => onChange({ ...item, numerals: e.target.value as TraceItem["numerals"] })}
              >
                <option value="khmer">{t("traceStudio.numeralsKhmer")}</option>
                <option value="latin">{t("traceStudio.numeralsLatin")}</option>
              </select>
            </Field>
          )}
          {!coloring && (
            <Field label={t("traceStudio.grid")}>
              <select className={inputCls} value={item.grid} onChange={(e) => onChange({ ...item, grid: e.target.value as TraceItem["grid"] })}>
                {GRIDS.map((g) => (
                  <option key={g} value={g}>
                    {t(`traceStudio.gridName.${g}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t("traceStudio.sensitivity")}>
            <select className={inputCls} value={item.sensitivity} onChange={(e) => onChange({ ...item, sensitivity: e.target.value as Sensitivity })}>
              {(["relaxed", "balanced", "strict"] as Sensitivity[]).map((s) => (
                <option key={s} value={s}>
                  {t(`traceStudio.sens.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          {item.kind === "mark" && (
            <>
              <Field label={t("traceStudio.carrier")}>
                <input
                  className={`${inputCls} text-xl`}
                  lang="km"
                  value={item.carrier?.text ?? ""}
                  onChange={(e) => onChange({ ...item, carrier: e.target.value ? { text: e.target.value, box: item.carrier?.box ?? { x: 150, y: 350, w: 450, h: 450 } } : undefined })}
                />
              </Field>
              <Field label={t("traceStudio.zone")}>
                <select className={inputCls} value={item.zone ?? "around"} onChange={(e) => onChange({ ...item, zone: e.target.value as Zone })}>
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {t(`traceStudio.zoneName.${z}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <p className="text-sm text-muted sm:col-span-2">{t(coloring ? "traceStudio.colorNote" : modeOf(item.kind) === "writing" ? "traceStudio.writingNote" : "traceStudio.drawingNote")}</p>
        </div>
      </Section>
    </div>
  );
}

function StepsPanel({ draft, onChange, checks }: { draft: TraceDraft; onChange(d: TraceDraft): void; checks: ReturnType<typeof runChecks> }) {
  const { t } = useT();
  const { plan, item } = draft;
  const [testing, setTesting] = useState<StepId | null>(null);
  const print = strokesPrint(item);
  const fallback = defaultPlan(item);

  const setPlan = (steps: StepPlan["steps"]) => onChange({ ...draft, plan: { steps, canDoAt: steps[steps.length - 1]?.id ?? "memory" } });
  const toggle = (id: StepId) => {
    const has = plan.steps.some((s) => s.id === id);
    const rule = plan.steps.find((s) => s.id === id) ?? fallback.steps.find((s) => s.id === id) ?? { id, pass: 60, times: 1 };
    setPlan(has ? plan.steps.filter((s) => s.id !== id) : [...plan.steps, rule].sort((a, b) => ALL_STEPS.indexOf(a.id) - ALL_STEPS.indexOf(b.id)));
  };
  const num = themeSystem.field("sm", "w-16 bg-surface text-sm tabular-nums");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t("traceStudio.stepsNote")}</p>
        <ol className="flex flex-col gap-2">
          {ALL_STEPS.map((id, i) => {
            const rule = plan.steps.find((s) => s.id === id);
            const test = draft.tests[id];
            const fresh = test && test.strokes === print;
            const passed = Boolean(fresh && test.accepted && rule && test.score >= rule.pass);
            return (
              <li
                key={id}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${testing === id ? "border-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-900" : rule ? "border-line" : "border-dashed border-line opacity-60"} bg-surface`}
              >
                <label className="flex min-w-36 items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={Boolean(rule)} onChange={() => toggle(id)} className="h-4 w-4 accent-indigo-600" />
                  <span className="text-muted">{i + 1}.</span>
                  {t(`trace.step.${id}`)}
                </label>
                {rule && id !== "watch" && (
                  <span className="flex items-center gap-3 text-xs text-muted">
                    <label className="flex items-center gap-1">
                      {t("traceStudio.bar")}
                      <input type="number" min={0} max={100} value={rule.pass} onChange={(e) => setPlan(plan.steps.map((s) => (s.id === id ? { ...s, pass: Number(e.target.value) } : s)))} className={num} />
                    </label>
                    <label className="flex items-center gap-1">
                      ×
                      <input type="number" min={1} max={5} value={rule.times} onChange={(e) => setPlan(plan.steps.map((s) => (s.id === id ? { ...s, times: Number(e.target.value) } : s)))} className={num} />
                    </label>
                  </span>
                )}
                {rule && (
                  <span className="ml-auto flex items-center gap-2">
                    {plan.canDoAt === id && <UIBadge variant="success">{t(modeOf(item.kind) === "writing" ? "trace.status.canWrite" : "trace.status.canDraw")}</UIBadge>}
                    <span className={`flex items-center gap-1 text-xs font-semibold ${passed ? "text-emerald-700 dark:text-emerald-300" : fresh ? "text-rose-700 dark:text-rose-300" : "text-muted"}`}>
                      {passed ? <Check className="h-4 w-4" /> : fresh ? <AlertCircle className="h-4 w-4" /> : null}
                      {passed ? test!.score : fresh ? t("traceStudio.belowBar", { score: test!.score }) : t("traceStudio.notTested")}
                    </span>
                    <IconButton size="sm" label={t("traceStudio.test")} active={testing === id} disabled={item.strokes.length === 0} onClick={() => setTesting(id)}>
                      <Play className="h-4 w-4" />
                    </IconButton>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <UIButton size="sm" variant="secondary" onClick={() => onChange({ ...draft, plan: defaultPlan(item) })}>
            {t("traceStudio.resetSteps")}
          </UIButton>
        </div>
        <Section title={t("traceStudio.checksTitle")} defaultOpen aside={allPass(checks) ? t("traceStudio.ready") : t("traceStudio.issues", { count: checks.filter((c) => !c.ok).length })}>
          <ChecksList checks={checks} />
        </Section>
      </div>
      <div className="min-w-0">
        {testing ? (
          <TracePlayer
            key={`${testing}-${print}`}
            item={item}
            plan={plan}
            forceStep={testing}
            onExit={() => setTesting(null)}
            onResult={(step, r) => {
              const prev = draft.tests[step];
              const keep = prev && prev.strokes === print && prev.accepted && prev.score >= r.score && !(!prev.accepted && r.accepted);
              if (!keep) onChange({ ...draft, tests: { ...draft.tests, [step]: { score: r.score, accepted: r.accepted, strokes: print } } });
            }}
          />
        ) : (
          <div className="flex h-full min-h-60 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line p-6 text-center text-muted">
            <Play className="h-8 w-8 text-indigo-500" />
            <p className="max-w-sm">{t("traceStudio.pickStepToTest")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChecksList({ checks }: { checks: ReturnType<typeof runChecks> }) {
  const { t } = useT();
  return (
    <>
      <ul className="flex flex-col gap-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.id} className={`flex items-start gap-2 ${c.ok ? "text-muted" : "text-rose-700 dark:text-rose-300"}`}>
            {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {t(`traceStudio.check.${c.id}`)}
              {!c.ok && c.strokes && c.strokes.length > 0 && ` (${c.strokes.join(", ")})`}
              {!c.ok && c.steps && c.steps.length > 0 && ` (${c.steps.map((s) => t(`trace.step.${s}`)).join(", ")})`}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{allPass(checks) ? t("traceStudio.allChecksPass") : t("traceStudio.publishLater")}</p>
    </>
  );
}
