/**
 * Surfaces that float over an activity: the success card, the saving curtain,
 * the placement finish screen.
 *
 * These three used to be written out by hand, and each had drifted into its own
 * palette — a full-bleed emerald gradient on one, a violet-tinted white on
 * another, an amber tile on a third. Side by side at the end of one lesson they
 * did not read as the same product.
 *
 * Two rules hold them together:
 *
 *  1. **A floating card is a neutral surface.** Its fill and hairline never
 *     carry meaning. Success, warning and brand live in the accent tile, the
 *     border tint and the primary button — small, saturated, and surrounded by
 *     quiet. A card that is *entirely* the accent colour outweighs the activity
 *     it congratulates and leaves the primary button nowhere to stand out.
 *  2. **Colour comes from `isDark`, never Tailwind's `dark:` variant.**
 *     `index.css` scopes that variant to an explicit `.dark` ancestor, which
 *     none of these screens mount, so `dark:` classes on them silently do
 *     nothing. Same rule the canvases follow.
 *
 * `scale` is the grade-band ramp, not a screen-size one. Koda runs from grade 1
 * to 12, and a six-year-old and an eighteen-year-old want different type sizes
 * and tap targets on the very same screen. Responsive steps (`sm:`) stack on top
 * of whichever scale is chosen.
 */

/**
 * Which accent the card's trim carries. Never the fill — only the trim.
 *
 * `primary` is the brand violet — `#7C3AED`, the same hex the shared `Button`'s
 * default variant paints itself with, and exactly Tailwind's `violet-600`. It is
 * the default here so an overlay card and the primary button inside it agree;
 * a card trimmed in some other hue turns its own call to action into a clash.
 */
export type SurfaceAccent = "primary" | "emerald" | "neutral";

/** Grade-band ramp: `kid` is bigger and rounder all the way down. */
export type SurfaceScale = "kid" | "standard";

/**
 * The one dark card fill. It sits *lighter* than the `#0B0F1A` stage rather than
 * darker: a dialog reads as raised because it is nearer the light, and a card
 * darker than its own backdrop looks like a hole punched in the page.
 */
const DARK_FILL = "bg-[#171D30]/95";
const LIGHT_FILL = "bg-white/[0.97]";

/**
 * 2px, so the trim is a deliberate edge rather than a hairline that disappears
 * on a high-DPI tablet. Alpha rather than a lighter tint keeps it the *same*
 * colour as the button it sits with — it reads as one family at any weight.
 */
const ACCENT_BORDER: Record<SurfaceAccent, { light: string; dark: string }> = {
  primary: { light: "border-[#7C3AED]/40", dark: "border-[#7C3AED]/55" },
  emerald: { light: "border-emerald-500/35", dark: "border-emerald-400/40" },
  neutral: { light: "border-slate-200", dark: "border-white/10" }
};

/** Both themes need a real lift; on near-black only black reads. */
const ACCENT_SHADOW: Record<SurfaceAccent, string> = {
  primary: "shadow-[0_20px_50px_-24px_rgba(124,58,237,0.45)]",
  emerald: "shadow-[0_20px_50px_-24px_rgba(16,185,129,0.45)]",
  neutral: "shadow-[0_20px_50px_-24px_rgba(30,41,59,0.35)]"
};

const DARK_SHADOW = "shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]";

/**
 * Fill and lift, without the trim.
 *
 * Split out for the answer panel, whose border carries validation state — idle,
 * wrong, right — and so cannot take a fixed accent. It still has to be the same
 * card as the ones below it, and this is what guarantees that.
 */
export const overlayCardBaseClass = (isDark: boolean, accent: SurfaceAccent = "primary") =>
  [
    "backdrop-blur-xl transition-colors duration-300",
    isDark ? DARK_FILL : LIGHT_FILL,
    isDark ? DARK_SHADOW : ACCENT_SHADOW[accent]
  ].join(" ");

/** The trim on its own, for surfaces composing their own border rules. */
export const overlayCardBorderClass = (isDark: boolean, accent: SurfaceAccent = "primary") =>
  isDark ? ACCENT_BORDER[accent].dark : ACCENT_BORDER[accent].light;

/** Fill, trim and lift for a card floating over the activity. */
export const overlayCardClass = (isDark: boolean, accent: SurfaceAccent = "primary") =>
  [
    "rounded-3xl border-2",
    overlayCardBaseClass(isDark, accent),
    overlayCardBorderClass(isDark, accent)
  ].join(" ");

/**
 * Padding and gap for that card, by band.
 *
 * The `sm:` step is the responsive one; the band picks which ramp it steps
 * along. Kid cards are roomier at every width, because the buttons inside them
 * have to be hit by a six-year-old on a tablet in a classroom.
 */
export const overlayCardPadding = (scale: SurfaceScale = "standard") =>
  scale === "kid" ? "p-5 sm:p-7 gap-4 sm:gap-5" : "p-4 sm:p-5 gap-3 sm:gap-4";

/** The scrim behind a blocking card. Dark in both themes — it is an absence. */
export const overlayScrimClass = "bg-slate-950/40 backdrop-blur-[3px]";

/** Headline. */
export const titleTextClass = (isDark: boolean, scale: SurfaceScale = "standard") =>
  `${isDark ? "text-white" : "text-slate-900"} font-extrabold leading-tight ${
    scale === "kid" ? "text-lg sm:text-2xl" : "text-sm sm:text-base"
  }`;

/** Supporting line under a headline. Never the accent colour — it is not news. */
export const bodyTextClass = (isDark: boolean, scale: SurfaceScale = "standard") =>
  `${isDark ? "text-slate-400" : "text-slate-500"} font-semibold leading-snug ${
    scale === "kid" ? "text-sm sm:text-base" : "text-[11px] sm:text-xs"
  }`;

/**
 * The brand primary, for the few controls that need it raw — a focus ring, a
 * toggle's pressed state. `#7C3AED` is what the shared `Button`'s default
 * variant paints itself with, and is exactly Tailwind's `violet-600`.
 */
export const PRIMARY_HEX = "#7C3AED";

/** Focus treatment on an input inside one of these cards. */
export const primaryFocusClass = "focus-visible:border-[#7C3AED] focus-visible:ring-[#7C3AED]/20";

/** A toggle that is currently on — soft primary, not the solid button fill. */
export const primaryToggleOnClass = (isDark: boolean) =>
  isDark
    ? "bg-[#7C3AED]/25 border-[#7C3AED]/50 text-violet-200"
    : "bg-violet-50 border-[#7C3AED]/35 text-[#7C3AED]";

/** Small uppercase label above a headline — the one place the accent is text. */
export const eyebrowTextClass = (isDark: boolean) =>
  `text-[10px] font-bold uppercase tracking-[0.18em] ${
    isDark ? "text-violet-300" : "text-[#7C3AED]"
  }`;

/**
 * A quieter panel *inside* a card — an explanation, a stat tile.
 *
 * Separated from the card by elevation rather than by a coloured border, the
 * same way canvas zones are. Dark runs higher than light because a few percent
 * of white is invisible on near-black while a few percent of black reads
 * clearly on white.
 */
export const insetPanelClass = (isDark: boolean) =>
  isDark
    ? "rounded-2xl bg-white/[0.06] text-slate-300"
    : "rounded-2xl bg-slate-50 text-slate-600";

/**
 * Secondary button inside a card.
 *
 * Secondary by *weight*, not by washing out: the shared `outline` variant's
 * `#9CA3AF` label all but vanished once these cards became light surfaces.
 * Pair with `variant="ghost"` so there is no base styling to fight.
 */
export const secondaryButtonClass = (isDark: boolean) =>
  isDark
    ? "bg-white/[0.08] border-2 border-white/10 text-slate-200 hover:bg-white/[0.16] hover:text-white"
    : "bg-slate-100 border-2 border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900";
