import React from "react";
import { ArrowLeft } from "lucide-react";

export interface UIUnitHeaderProps {
  /** The small line above the title — a section, a category, a lesson count. */
  eyebrow: React.ReactNode;
  title: string;
  /** Solid background utility, e.g. `"bg-violet-600"`. */
  color?: string;
  /** Trailing button. Needs `actionLabel` and `onAction` together to render. */
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  /** Adds a back arrow ahead of the eyebrow. */
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}

/* Units are told apart by colour as well as by number, so a long scroll of
   them stays readable. Decorative only — every bar names its unit in words.
   Every entry clears 5:1 against white: the theme's amber and lime are
   saturated yellows that carry white text at about 1.4:1, so they are not
   here, and a new fill belongs in this list only after it is measured. */
const UNIT_COLORS = [
  "bg-violet-600",
  "bg-emerald-700",
  "bg-sky-700",
  "bg-rose-700",
  "bg-orange-700",
  "bg-fuchsia-700",
];

/** The fill for unit `n` (1-based). Cycles, so any course length keeps going. */
export const unitColor = (unitNumber: number): string =>
  UNIT_COLORS[(Math.max(1, unitNumber) - 1) % UNIT_COLORS.length];

/**
 * The bar that names what a learner is inside of, and gives them the one way
 * out of it — the header above a learning path.
 *
 * Flat fill, two lines, one button. A gradient, a thumbnail and a description
 * line all belong to a *card* that is selling the skill; this sits above a path
 * the learner has already chosen, so everything that is not the name of the
 * thing or a way to leave it is noise. Colour is decoration only — the category
 * is always in the eyebrow in words.
 */
export const UIUnitHeader: React.FC<UIUnitHeaderProps> = ({
  eyebrow,
  title,
  color = "bg-slate-600",
  actionLabel,
  actionIcon,
  onAction,
  onBack,
  backLabel = "Back",
  className = "",
}) => (
  <header
    className={`flex items-center gap-3 sm:gap-4 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-white ${color} ${className}`}
  >
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-white/85">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="-ml-1 shrink-0 rounded-lg p-0.5 transition hover:bg-white/15 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <span className="truncate">{eyebrow}</span>
      </div>

      {/* `text-white` explicitly: the base stylesheet colours every h1–h6 with
          `--koda-ink`, and a direct rule beats the colour inherited from the
          bar — without this the title renders near-black on the fill. */}
      <h2 className="mt-1 sm:mt-1.5 text-lg sm:text-2xl font-black leading-tight text-white text-balance">
        {title}
      </h2>
    </div>

    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        aria-label={actionLabel}
        /* The darker edge is the fill's own shadow rather than a grey border,
           so one component works on every category colour. */
        className="shrink-0 inline-flex items-center gap-2 rounded-xl border-2 border-b-4 border-black/15 bg-white/10 p-2.5 sm:px-4 sm:py-2.5 font-mono text-xs font-black uppercase tracking-wider transition hover:bg-white/20 active:border-b-2 active:translate-y-0.5 cursor-pointer [&>svg]:w-4 [&>svg]:h-4"
      >
        {actionIcon}
        <span className="hidden sm:inline">{actionLabel}</span>
      </button>
    )}
  </header>
);
