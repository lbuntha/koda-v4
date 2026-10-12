/**
 * Small building blocks for Trace Studio: icon buttons with a tooltip that
 * names the tool and its shortcut, collapsible panel sections, fields, and
 * the little drawings used as icons for stroke shapes.
 */

import { useState, type ReactNode } from "react";
import { ChevronDown, Redo2, Undo2 } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";

/** The app's own field, at the studio's compact height. */
export const inputCls = themeSystem.field("lg", "min-h-9 !py-1.5 bg-surface");

/** A tinted panel for an inline task (add items, apply to all, auto strokes). */
export const panelCls = "flex flex-col gap-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30";

interface IconButtonProps {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick(): void;
  children: ReactNode;
  /**
   * Where the tooltip appears; "none" while the button's own popover is open.
   * "bottom-end" lines it up with the button's right edge, for a button at the
   * right end of a panel that clips what spills out.
   */
  tip?: "right" | "bottom" | "bottom-end" | "top" | "none";
  size?: "sm" | "md";
  tone?: "default" | "danger";
}

export function IconButton({ label, shortcut, active, disabled, onClick, children, tip = "bottom", size = "md", tone = "default" }: IconButtonProps) {
  // A notch smaller on a phone, so the tool rail stays one row on a 360px screen.
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10";
  const place =
    tip === "right" ? "left-full top-1/2 ml-2 -translate-y-1/2" : tip === "bottom-end" ? "top-full right-0 mt-2" : tip === "top" ? "bottom-full left-1/2 mb-2 -translate-x-1/2" : "top-full left-1/2 mt-2 -translate-x-1/2";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex ${box} shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : tone === "danger"
            ? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/50"
            : "text-muted hover:bg-surface-muted hover:text-ink"
      }`}
    >
      {children}
      {tip !== "none" && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-surface opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 ${place}`}
        >
          {label}
          {shortcut && <kbd className="ml-2 rounded bg-surface/15 px-1.5 py-0.5 font-mono text-[11px]">{shortcut}</kbd>}
        </span>
      )}
    </button>
  );
}

export function Divider({ vertical = false }: { vertical?: boolean }) {
  return <span aria-hidden="true" className={vertical ? "mx-1 h-6 w-px bg-line" : "my-1 h-px w-6 bg-line"} />;
}

/** `action` sits in the header beside the chevron, outside the toggle (a button cannot hold a button). */
export function Section({ title, aside, action, defaultOpen = true, children }: { title: string; aside?: ReactNode; action?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={themeSystem.card("default")}>
      <div className="flex items-center">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`flex min-w-0 flex-1 items-center gap-2 py-3 text-left ${action ? "pl-4 pr-2" : "px-4"}`}>
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span className="ml-auto flex items-center gap-2 text-xs text-muted">{aside}</span>
          <ChevronDown className={`h-4 w-4 text-muted transition ${open ? "rotate-180" : ""}`} />
        </button>
        {action && <span className="pr-3">{action}</span>}
      </div>
      {open && <div className="flex flex-col gap-3 border-t border-line px-4 py-3">{children}</div>}
    </section>
  );
}

/**
 * A titled group inside a panel (Shape, Size & fit, In the picture…). Lighter
 * than a Section; folds away, and stays folded or open as the author left it.
 */
export function SubSection({ id, title, aside, defaultOpen = true, children }: { id: string; title: string; aside?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const key = `koda_trace_studio_open_${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? defaultOpen : v === "1";
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? "0" : "1");
      } catch {
        /* remembered for this visit only */
      }
      return !o;
    });
  return (
    <div className="-mx-1 flex flex-col border-t border-line pt-1 first:border-t-0">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink">{title}</span>
        {aside && <span className="ml-auto truncate text-xs text-muted">{aside}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${aside ? "" : "ml-auto"} ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="flex flex-col gap-3 px-1 pb-2 pt-1">{children}</div>}
    </div>
  );
}

/** A choice with its words showing (not only an icon): "As the item · On · Off", "Corner · Smooth · Even". Wraps on a phone. */
export function TextSegment<T extends string>({ value, options, onChange, disabled, label }: { value: T | null; options: { value: T; label: string; icon?: ReactNode }[]; onChange(v: T): void; disabled?: boolean; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-surface-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`flex min-h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 ${
            value === o.value ? "bg-surface text-indigo-700 shadow-sm dark:text-indigo-300" : "text-muted hover:text-ink"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A small button with an icon and its words, for actions that an icon alone does not explain. */
export function LabelButton({ icon, label, onClick, disabled, title, tone = "default" }: { icon: ReactNode; label: string; onClick(): void; disabled?: boolean; title?: string; tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-left text-xs font-semibold transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-indigo-950/40 ${
        tone === "danger" ? "text-rose-700 dark:text-rose-300" : "text-ink"
      }`}
    >
      <span className={`shrink-0 ${tone === "danger" ? "" : "text-indigo-600 dark:text-indigo-300"}`}>{icon}</span>
      <span className="min-w-0">{label}</span>
    </button>
  );
}

export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange(v: number): void; format?(v: number): string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span>{label}</span>
        <span className="font-mono normal-case tabular-nums">{format ? format(value) : Math.round(value * 100) / 100}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-indigo-600" />
    </label>
  );
}

/** A segmented control whose options are icons with tooltips. */
export function IconSegment<T extends string>({ value, options, onChange, disabled }: { value: T; options: { value: T; label: string; icon: ReactNode }[]; onChange(v: T): void; disabled?: boolean }) {
  return (
    <div className="flex gap-0.5 rounded-xl bg-surface-muted p-0.5">
      {options.map((o) => (
        <IconButton key={o.value} label={o.label} size="sm" active={value === o.value} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.icon}
        </IconButton>
      ))}
    </div>
  );
}

/* ------------------------------------------------ shape icons (24×24) */

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const ShapeIcon = {
  line: () => (
    <Svg>
      <path d="M12 4v16" />
    </Svg>
  ),
  arc: () => (
    <Svg>
      <path d="M4 17C6 7 18 7 20 17" />
    </Svg>
  ),
  curve: () => (
    <Svg>
      <path d="M4 17C6 7 18 7 20 17" />
    </Svg>
  ),
  hook: () => (
    <Svg>
      <path d="M9 3v11c0 4 3 6 6 5s3-3 2-4" />
    </Svg>
  ),
  loop: () => (
    <Svg>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5l2-2M12 5l2 2" />
    </Svg>
  ),
  dot: () => (
    <Svg>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </Svg>
  ),
  zigzag: () => (
    <Svg>
      <path d="M3 16l4.5-8 4.5 8 4.5-8 4.5 8" />
    </Svg>
  ),
  wave: () => (
    <Svg>
      <path d="M3 12c2.5-5 5.5-5 7.5 0s5 5 7.5 0 2.5-2 3-2" />
    </Svg>
  ),
  free: () => (
    <Svg>
      <path d="M4 18c3-9 5 2 8-5s5-3 8-8" />
    </Svg>
  ),
  rectangle: () => (
    <Svg>
      <rect x="3" y="6" width="18" height="12" rx="1" />
    </Svg>
  ),
  rounded: () => (
    <Svg>
      <rect x="3" y="7" width="18" height="10" rx="4" />
    </Svg>
  ),
  square: () => (
    <Svg>
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </Svg>
  ),
  triangle: () => (
    <Svg>
      <path d="M12 4 21 19H3Z" />
    </Svg>
  ),
  circle: () => (
    <Svg>
      <circle cx="12" cy="12" r="8" />
    </Svg>
  ),
  polygon: () => (
    <Svg>
      <path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9Z" />
    </Svg>
  ),
  bendUp: () => (
    <Svg>
      <path d="M4 18C7 6 17 6 20 18" />
      <path d="M12 3v4M10 5l2-2 2 2" />
    </Svg>
  ),
  bendDown: () => (
    <Svg>
      <path d="M4 6c3 12 13 12 16 0" />
      <path d="M12 21v-4M10 19l2 2 2-2" />
    </Svg>
  ),
};

/** The editor's undo history, handed to a panel that edits the item. */
export interface History {
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

/** Undo and redo, for a panel's toolbar: the same history (and ⌘Z / ⇧⌘Z) as the stroke tools. */
export function UndoRedo({ history, undoLabel, redoLabel }: { history: History; undoLabel: string; redoLabel: string }) {
  return (
    <>
      <IconButton size="sm" label={undoLabel} shortcut="⌘Z" onClick={history.undo} disabled={!history.canUndo}>
        <Undo2 className="h-4 w-4" />
      </IconButton>
      <IconButton size="sm" label={redoLabel} shortcut="⇧⌘Z" onClick={history.redo} disabled={!history.canRedo}>
        <Redo2 className="h-4 w-4" />
      </IconButton>
    </>
  );
}
