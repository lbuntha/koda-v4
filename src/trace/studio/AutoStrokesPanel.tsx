/**
 * Starter strokes in the Studio: for the item being edited, and for every
 * empty item of a collection at once.
 */

import { useEffect, useRef, useState } from "react";
import { Lock, Sparkles, Wand2 } from "lucide-react";
import { useT } from "../../lib/i18n";
import { UIButton } from "../../components/ui";
import type { Stroke, TraceItem } from "../geometry/types";
import type { Source } from "./autoStrokes";
import { autoStrokes, canUseAi } from "./autoStrokes";
import { TraceDrafts } from "./drafts";
import { IconButton, panelCls } from "./ui";

const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function useAiAllowed(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    void canUseAi().then(setAllowed);
  }, []);
  return allowed;
}

function AiSwitch({ allowed, on, onChange }: { allowed: boolean | null; on: boolean; onChange(v: boolean): void }) {
  const { t } = useT();
  return (
    <label className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${allowed ? "border-indigo-200 dark:border-indigo-900" : "border-line opacity-80"}`}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={Boolean(allowed) && on} disabled={!allowed} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          {allowed ? <Sparkles className="h-4 w-4 text-indigo-600" /> : <Lock className="h-4 w-4 text-muted" />}
          {t("traceStudio.auto.useAi")}
        </span>
        <span className="text-xs text-muted">{allowed === false ? t("traceStudio.auto.aiPaid") : t("traceStudio.auto.aiNote")}</span>
      </span>
    </label>
  );
}

/** One item: a rail button that opens the panel. */
export function AutoStrokesButton({ item, onStrokes }: { item: TraceItem; onStrokes(strokes: Stroke[]): void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const allowed = useAiAllowed();
  const hasGlyph = Boolean(item.guide?.glyph?.text);
  const hasImage = Boolean(item.guide?.image?.src);
  const [source, setSource] = useState<Source>(hasGlyph ? "glyph" : "image");
  const [ai, setAi] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

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

  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await autoStrokes(item, { source, useAi: ai && Boolean(allowed), newId: uid });
      if (!r || r.strokes.length === 0) {
        setNote({ tone: "bad", text: t("traceStudio.auto.nothing") });
        return;
      }
      onStrokes(r.strokes);
      setNote({
        tone: r.aiError ? "bad" : "good",
        text: r.aiError
          ? t("traceStudio.auto.aiFellBack", { count: r.strokes.length, reason: t(`traceStudio.auto.reason.${r.aiError in REASONS ? r.aiError : "failed"}`) })
          : t(r.usedAi ? "traceStudio.auto.madeAi" : "traceStudio.auto.made", { count: r.strokes.length }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <IconButton label={t("traceStudio.auto.button")} active={open} onClick={() => setOpen((o) => !o)} tip="right">
        <Wand2 className="h-5 w-5" />
      </IconButton>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 flex w-80 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xl lg:left-full lg:top-0 lg:ml-2 lg:mt-0">
          <p className="text-sm font-semibold text-ink">{t("traceStudio.auto.title")}</p>
          <p className="text-xs text-muted">{t("traceStudio.auto.intro")}</p>
          {!hasGlyph && !hasImage ? (
            <p className="text-sm text-rose-700 dark:text-rose-300">{t("traceStudio.auto.noGuide")}</p>
          ) : (
            <>
              <div role="radiogroup" className="flex gap-2">
                {(["glyph", "image"] as Source[]).map((s) => (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={source === s}
                    disabled={s === "glyph" ? !hasGlyph : !hasImage}
                    onClick={() => setSource(s)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-40 ${source === s ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100" : "border-line text-body"}`}
                  >
                    {t(`traceStudio.auto.from.${s}`)}
                  </button>
                ))}
              </div>
              <AiSwitch allowed={allowed} on={ai} onChange={setAi} />
              {item.strokes.length > 0 && <p className="text-xs text-rose-700 dark:text-rose-300">{t("traceStudio.auto.replaces", { count: item.strokes.length })}</p>}
              <UIButton icon={<Wand2 className="h-4 w-4" />} isLoading={busy} onClick={run}>
                {t("traceStudio.auto.make")}
              </UIButton>
            </>
          )}
          {note && <p className={`text-sm ${note.tone === "good" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{note.text}</p>}
        </div>
      )}
    </div>
  );
}

const REASONS: Record<string, true> = { plan_required: true, no_ai_key: true, offline: true, ai_failed: true, failed: true, not_a_trace_creator: true };

/** A collection: draft strokes for every item that has none yet, from its typed letter. */
export function AutoStrokesForSet({ itemIds, onDone }: { itemIds: string[]; onDone(): void }) {
  const { t } = useT();
  const allowed = useAiAllowed();
  const [ai, setAi] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number; ai: number } | null>(null);
  const empty = itemIds.map((id) => TraceDrafts.get(id)).filter((d) => d && d.item.strokes.length === 0 && (d.item.guide?.glyph?.text || d.item.guide?.image?.src));

  const run = async () => {
    const total = empty.length;
    let ai_ = 0;
    setProgress({ done: 0, total, ai: 0 });
    for (let i = 0; i < total; i++) {
      const d = TraceDrafts.get(empty[i]!.item.id);
      if (!d) continue;
      const source: Source = d.item.guide?.glyph?.text ? "glyph" : "image";
      const r = await autoStrokes(d.item, { source, useAi: ai && Boolean(allowed), newId: uid });
      if (r && r.strokes.length) {
        TraceDrafts.save({ ...d, item: { ...d.item, strokes: r.strokes } });
        if (r.usedAi) ai_++;
      }
      setProgress({ done: i + 1, total, ai: ai_ });
    }
    onDone();
  };

  return (
    <div className={panelCls}>
      <p className="text-sm text-body">{t("traceStudio.auto.setIntro", { count: empty.length })}</p>
      <AiSwitch allowed={allowed} on={ai} onChange={setAi} />
      {progress ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} />
          </div>
          <p className="text-sm text-body">
            {progress.done < progress.total ? t("traceStudio.auto.working", { done: progress.done, total: progress.total }) : t("traceStudio.auto.setDone", { count: progress.total, ai: progress.ai })}
          </p>
        </div>
      ) : (
        <div>
          <UIButton icon={<Wand2 className="h-4 w-4" />} disabled={empty.length === 0} onClick={run}>
            {t("traceStudio.auto.makeN", { count: empty.length })}
          </UIButton>
        </div>
      )}
    </div>
  );
}
