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
  MoveVertical,
  MoveHorizontal,
  Maximize,
  AlignCenter,
  ArrowLeft,
  ArrowLeftRight,
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
  ListOrdered,
  Magnet,
  MapPin,
  Maximize2,
  Minus,
  MousePointer2,
  Pencil,
  PenLine,
  Play,
  Plus,
  Redo2,
  Search,
  Settings2,
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
} from "lucide-react";
import { useT } from "../../lib/i18n";
import { UIButton } from "../../components/ui";
import { GOLDEN_ITEMS } from "../fixtures/items";
import type { FitHow } from "../geometry/edit";
import {
  bendSegment,
  blendAll,
  connectToPrevious,
  fitStroke,
  strokeBox,
  transformStroke,
  deleteNode,
  mirrorStroke,
  moveNode,
  reverseStroke,
  setNodeType,
  simplifyStroke,
  straighten,
} from "../geometry/edit";
import type { NodeType, Sensitivity, StepId, Stroke, StrokeShape, TraceItem, TraceKind, Zone } from "../geometry/types";
import { modeOf } from "../geometry/types";
import type { StepPlan } from "../progress/ladder";
import { defaultPlan } from "../progress/ladder";
import { TracePlayer } from "../player/TracePlayer";
import { badge } from "../player/render";
import { allPass, runChecks } from "./checks";
import { StrokeClipboard, pasteStrokes } from "./clipboard";
import { CollectionBoard, CollectionsList } from "./Collections";
import { expandGroups, groupStrokes, mirrorSelection, remapGroups, ungroupStrokes } from "./groups";
import type { TraceDraft } from "./drafts";
import { TraceDrafts, newDraft, strokesPrint } from "./drafts";
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
  { mode: "hand", key: "H", icon: <Hand className="h-5 w-5" /> },
];

const renumber = (strokes: Stroke[]) => strokes.map((s, i) => ({ ...s, order: i + 1, join: i === 0 ? ("lift" as const) : s.join }));

function blankItem(): TraceItem {
  return {
    id: uid("t-"),
    rev: 1,
    title: "",
    kind: "letter",
    script: "khmer",
    grid: "4x3-moeys",
    strokes: [],
    sensitivity: "balanced",
    guide: { glyph: { text: "", size: 720, x: 500, y: 780 } },
  };
}

/* ================================================================= list */

export function TraceStudio() {
  const { t } = useT();
  useSyncExternalStore(TraceDrafts.subscribe, TraceDrafts.version);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"collections" | "items">("collections");
  const [openCollection, setOpenCollection] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<TraceKind | "">("");
  const [status, setStatus] = useState<"" | "ready" | "issues">("");
  useEffect(() => {
    void TraceDrafts.pull();
  }, []);

  if (openId) return <DraftEditor key={openId} id={openId} onClose={() => setOpenId(null)} />;
  const sync = TraceDrafts.syncState();

  const allDrafts = TraceDrafts.list();
  const drafts = allDrafts.filter((d) => {
    if (q && !d.item.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (kind && d.item.kind !== kind) return false;
    if (status) {
      const ok = runChecks(d).every((c) => c.ok);
      if ((status === "ready") !== ok) return false;
    }
    return true;
  });
  const create = (item: TraceItem) => {
    TraceDrafts.save(newDraft(item));
    setOpenId(item.id);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t("traceStudio.title")}</h1>
          <p className="text-base text-slate-600 dark:text-slate-300">{t("traceStudio.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t("traceStudio.fromExample")}
            value=""
            onChange={(e) => {
              const src = GOLDEN_ITEMS.find((i) => i.id === e.target.value);
              if (src) create({ ...structuredClone(src), id: uid("t-"), guide: src.guide ?? (modeOf(src.kind) === "writing" ? { glyph: { text: src.title, size: 720, x: 500, y: 780 } } : {}) });
            }}
            className={`${inputCls} w-auto`}
          >
            <option value="">{t("traceStudio.fromExample")}</option>
            {GOLDEN_ITEMS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title} · {t(`traceStudio.kind.${i.kind}`)}
              </option>
            ))}
          </select>
          <UIButton icon={<Plus className="h-4 w-4" />} onClick={() => create(blankItem())}>
            {t("traceStudio.newItem")}
          </UIButton>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {(["collections", "items"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => {
                setView(v);
                setOpenCollection(null);
              }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${view === v ? "bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}
            >
              {t(`traceStudio.view.${v}`)}
            </button>
          ))}
        </div>
        <span className={`ml-auto inline-flex items-center gap-1 text-xs ${sync === "offline" ? "text-rose-700 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`}>
          {sync === "offline" ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {t(`traceStudio.sync.${sync}`)}
        </span>
      </div>

      {view === "collections" ? (
        openCollection ? (
          <CollectionBoard id={openCollection} onBack={() => setOpenCollection(null)} onOpenItem={setOpenId} />
        ) : (
          <CollectionsList onOpen={setOpenCollection} onOpenItem={setOpenId} />
        )
      ) : (
        <>
      {allDrafts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input className={`${inputCls} pl-8`} lang="km" placeholder={t("traceStudio.search")} aria-label={t("traceStudio.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select aria-label={t("traceStudio.filterKind")} className={`${inputCls} w-auto`} value={kind} onChange={(e) => setKind(e.target.value as TraceKind | "")}>
            <option value="">{t("traceStudio.allKinds")}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`traceStudio.kind.${k}`)}
              </option>
            ))}
          </select>
          <select aria-label={t("traceStudio.filterStatus")} className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as "" | "ready" | "issues")}>
            <option value="">{t("traceStudio.allStatus")}</option>
            <option value="ready">{t("traceStudio.statusReady")}</option>
            <option value="issues">{t("traceStudio.statusIssues")}</option>
          </select>
        </div>
      )}
      {allDrafts.length > 0 && drafts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300">{t("traceStudio.noMatch")}</p>
      ) : drafts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
          <PenLine className="h-10 w-10 text-violet-500" />
          <p className="max-w-md text-slate-600 dark:text-slate-300">{t("traceStudio.empty")}</p>
          <UIButton icon={<Plus className="h-4 w-4" />} onClick={() => create(blankItem())}>
            {t("traceStudio.newItem")}
          </UIButton>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {drafts.map((d) => {
            const issues = runChecks(d).filter((c) => !c.ok).length;
            return (
              <li key={d.item.id} className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white transition hover:border-violet-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                <button onClick={() => setOpenId(d.item.id)} className="flex flex-col items-center gap-2 px-4 pb-4 pt-6 text-center">
                  <span className="flex h-20 items-center text-6xl font-bold leading-none text-slate-900 dark:text-white" lang={d.item.script === "khmer" ? "km" : undefined}>
                    {d.item.title || "·"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t(`traceStudio.kind.${d.item.kind}`)} · {t("traceStudio.strokeCount", { count: d.item.strokes.length })}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${issues ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                    {issues ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {issues ? t("traceStudio.issues", { count: issues }) : t("traceStudio.ready")}
                  </span>
                </button>
                <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton size="sm" label={t("traceStudio.duplicate")} onClick={() => TraceDrafts.save({ ...structuredClone(d), item: { ...structuredClone(d.item), id: uid("t-") }, tests: {} })}>
                    <Copy className="h-4 w-4" />
                  </IconButton>
                  <IconButton size="sm" tone="danger" label={t("traceStudio.delete")} onClick={() => TraceDrafts.remove(d.item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
        </>
      )}
    </div>
  );
}

/* =============================================================== editor */

type Tab = "shape" | "steps" | "details";

function DraftEditor({ id, onClose }: { id: string; onClose(): void }) {
  const { t } = useT();
  const [draft, setDraft] = useState<TraceDraft>(() => TraceDrafts.get(id) ?? newDraft(blankItem()));
  const [past, setPast] = useState<TraceItem[]>([]);
  const [future, setFuture] = useState<TraceItem[]>([]);
  const [tab, setTab] = useState<Tab>("shape");
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
  const select = (s: number | null, n: number | null = null) => {
    setSelection(s === null ? [] : [s]);
    setSelNode(n);
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
  const moveStroke = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= item.strokes.length) return;
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
    if (tab !== "shape") return;
    const el = e.target as HTMLElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
    const key = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === "z") {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
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

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-10">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <IconButton label={t("traceStudio.allItems")} onClick={onClose} tip="right">
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-bold leading-tight text-slate-900 dark:text-white" lang={item.script === "khmer" ? "km" : undefined}>
            {item.title || t("traceStudio.untitled")}
          </h1>
          <span className={`flex items-center gap-1 text-xs ${saveFailed ? "text-rose-700 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`}>
            {saveFailed ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {t(`traceStudio.kind.${item.kind}`)} · {saveFailed ? t("traceStudio.saveFailed") : t("traceStudio.saved")}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
            {(
              [
                ["shape", <PenLine key="s" className="h-4 w-4" />],
                ["steps", <ListOrdered key="t" className="h-4 w-4" />],
                ["details", <Settings2 key="d" className="h-4 w-4" />],
              ] as [Tab, React.ReactNode][]
            ).map(([x, icon]) => (
              <button
                key={x}
                role="tab"
                aria-selected={tab === x}
                onClick={() => setTab(x)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === x ? "bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}
              >
                {icon}
                {t(`traceStudio.tab.${x}`)}
              </button>
            ))}
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${issues ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
            {issues ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {issues ? t("traceStudio.issues", { count: issues }) : t("traceStudio.ready")}
          </span>
        </div>
      </div>

      {tab === "shape" && (
        <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_360px]">
          {/* Tool rail */}
          <nav aria-label={t("traceStudio.tools")} className="flex flex-row flex-wrap items-center gap-1 self-start rounded-2xl border border-slate-200 bg-white p-1.5 lg:sticky lg:top-4 lg:flex-col dark:border-slate-700 dark:bg-slate-900">
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
          </nav>

          {/* Canvas */}
          <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2 py-1.5 dark:border-slate-800">
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
              <span className="w-12 text-center font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">{Math.round((1000 / view.size) * 100)}%</span>
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
            <StrokeEditor
              item={item}
              selection={selection}
              selectedNode={selNode}
              mode={mode}
              magic={magic}
              showCheckpoints={showCps || mode === "pin"}
              showGrid={showGrid}
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{t(`traceStudio.mode.${mode}`)}</span>
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
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("traceStudio.noStrokes")}</p>
              ) : (
                <ol className="-mx-2 flex flex-col">
                  {item.strokes.map((s, i) => {
                    const Icon = ShapeIcon[s.shape === "curve" ? "curve" : s.shape];
                    return (
                      <li key={s.id} className={`group flex items-center gap-2 rounded-xl px-2 py-1 ${selection.includes(i) ? "bg-violet-50 dark:bg-violet-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}>
                        <button
                          onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? selectMany(selection.includes(i) ? selection.filter((x) => x !== i) : [...selection, i]) : select(i))}
                          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${selection.includes(i) ? "bg-violet-600" : "bg-violet-300 dark:bg-violet-700"}`}>{badge(s.order, item)}</span>
                          <span className="text-violet-700 dark:text-violet-300">
                            <Icon />
                          </span>
                          <span className="truncate text-sm text-slate-800 dark:text-slate-100">{t(`traceStudio.shape.${s.shape}`)}</span>
                          {s.group && (
                            <span title={t("traceStudio.inGroup")} className="text-violet-500">
                              <Group2 className="h-4 w-4" />
                            </span>
                          )}
                          {s.join === "continue" && (
                            <span title={t("traceStudio.carriesOn")} className="text-slate-400">
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
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("traceStudio.multiHint")}</p>
              </Section>
            ) : selected && sel !== null ? (
              <Section key={selected.id} title={t("traceStudio.strokeN", { n: badge(selected.order, item) })}>
                {selected.group && (
                  <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
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
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{t("traceStudio.selectHint")}</p>
            )}

            <Section title={t("traceStudio.checksTitle")} defaultOpen={false} aside={issues ? t("traceStudio.issues", { count: issues }) : t("traceStudio.ready")}>
              <ChecksList checks={checks} />
            </Section>
          </div>
        </div>
      )}

      {tab === "steps" && <StepsPanel draft={draft} onChange={setDraft} checks={checks} />}
      {tab === "details" && <DetailsPanel item={item} onChange={edit} />}
    </div>
  );
}

/* ============================================================== pieces */

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
          className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl lg:left-full lg:top-0 lg:ml-2 lg:mt-0 dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{t("traceStudio.shapesNote")}</p>
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
                  className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] text-slate-600 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-300 dark:hover:bg-violet-950/50 dark:hover:text-violet-200"
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
        <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("traceStudio.pointN", { n: node + 1 })}</span>
            <IconButton size="sm" tone="danger" label={t("traceStudio.deletePoint")} disabled={stroke.nodes.length <= 2} onClick={onDeleteNode}>
              <Trash2 className={icon} />
            </IconButton>
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
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
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
      <p className="text-xs text-slate-500 dark:text-slate-400">{t("traceStudio.guideNote")}</p>
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
          <Field label={t("traceStudio.grid")}>
            <select className={inputCls} value={item.grid} onChange={(e) => onChange({ ...item, grid: e.target.value as TraceItem["grid"] })}>
              {GRIDS.map((g) => (
                <option key={g} value={g}>
                  {t(`traceStudio.gridName.${g}`)}
                </option>
              ))}
            </select>
          </Field>
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
          <p className="text-sm text-slate-500 dark:text-slate-400 sm:col-span-2">{t(modeOf(item.kind) === "writing" ? "traceStudio.writingNote" : "traceStudio.drawingNote")}</p>
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
  const num = "w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("traceStudio.stepsNote")}</p>
        <ol className="flex flex-col gap-2">
          {ALL_STEPS.map((id, i) => {
            const rule = plan.steps.find((s) => s.id === id);
            const test = draft.tests[id];
            const fresh = test && test.strokes === print;
            const passed = Boolean(fresh && test.accepted && rule && test.score >= rule.pass);
            return (
              <li
                key={id}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${testing === id ? "border-violet-400 ring-2 ring-violet-200 dark:ring-violet-900" : rule ? "border-slate-200 dark:border-slate-700" : "border-dashed border-slate-200 opacity-60 dark:border-slate-700"} bg-white dark:bg-slate-900`}
              >
                <label className="flex min-w-36 items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <input type="checkbox" checked={Boolean(rule)} onChange={() => toggle(id)} className="h-4 w-4 accent-violet-600" />
                  <span className="text-slate-400">{i + 1}.</span>
                  {t(`trace.step.${id}`)}
                </label>
                {rule && id !== "watch" && (
                  <span className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
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
                    {plan.canDoAt === id && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">{t(modeOf(item.kind) === "writing" ? "trace.status.canWrite" : "trace.status.canDraw")}</span>}
                    <span className={`flex items-center gap-1 text-xs font-semibold ${passed ? "text-emerald-700 dark:text-emerald-300" : fresh ? "text-rose-700 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`}>
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
          <div className="flex h-full min-h-60 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <Play className="h-8 w-8 text-violet-500" />
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
          <li key={c.id} className={`flex items-start gap-2 ${c.ok ? "text-slate-600 dark:text-slate-300" : "text-rose-700 dark:text-rose-300"}`}>
            {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {t(`traceStudio.check.${c.id}`)}
              {!c.ok && c.strokes && c.strokes.length > 0 && ` (${c.strokes.join(", ")})`}
              {!c.ok && c.steps && c.steps.length > 0 && ` (${c.steps.map((s) => t(`trace.step.${s}`)).join(", ")})`}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500 dark:text-slate-400">{allPass(checks) ? t("traceStudio.allChecksPass") : t("traceStudio.publishLater")}</p>
    </>
  );
}
