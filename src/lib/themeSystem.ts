export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "ghost"
  | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "step" | "choice";

export type CardVariant = "default" | "glass" | "bordered" | "interactive";
export type BadgeVariant = "primary" | "success" | "warning" | "danger" | "info" | "neutral";
export type FlashType = "info" | "success" | "warning" | "error";
export type TypographyVariant = "h1" | "h2" | "h3" | "h4" | "body" | "body-sm" | "caption" | "subtitle";
export type StatTone = "primary" | "streak" | "success" | "danger";
export type SurfaceVariant = "default" | "glass" | "bordered" | "interactive";
export type FeatureVariant = "default" | "accent" | "subtle";
export type PathNodeState = "completed" | "current" | "available" | "locked";
export type KidMessageTone = "correct" | "tryAgain" | "hint" | "celebrate";

/**
 * Central Theme & Design System Function/Utility Engine
 * Manages standard design tokens and styles for buttons, cards, badges, 
 * flash messages, modals, dialogues, data tables, and typography across the app.
 */
export const themeSystem = {
  /* One spacing scale, 4px-based. Every surface picks its padding and every
     stack picks its gap from here, so rhythm stays consistent as pages grow.
       page 16/24 · card 16/20 · cardSm 12/16 · section 20 · grid 12 · stack 10 */
  spacing: {
    page: "p-4 lg:p-6",
    section: "space-y-5",
    grid: "gap-3",
    card: "p-4 sm:p-5",
    cardSm: "p-3 sm:p-4",
    stack: "space-y-2.5",
    row: "gap-3",
  },

  /* Light-first with `dark:` overrides. Solid variants keep the same fill in both
     themes — the surface behind them changes, so the fill does not need to. The
     focus ring's offset must track the surface, or it disappears in dark. */
  button: (variant: ButtonVariant = "primary", size: ButtonSize = "md", className: string = "") => {
    /* Depth is geometry, not blur: a 4px darker bottom edge that compresses to
       2px on press, so the control reads as physically pushed. */
    /*
     * Not monospace, and not shouting.
     *
     * The base used to force `font-mono uppercase tracking-wider` on every
     * button in the app. On an operator console that reads as deliberate; on
     * the controls a five-year-old taps — "CHECK", "SHOW ME", "LEFT HAS MORE" —
     * it is a developer's aesthetic applied to a child's product, and uppercase
     * is measurably harder to read for anyone still learning letterforms.
     *
     * The weight and the pushable geometry stay: those are what make it read as
     * a button. Only the typeface and the casing change.
     */
    const base =
      "inline-flex items-center justify-center font-black tracking-tight transition-all duration-100 rounded-2xl cursor-pointer border-2 border-b-4 active:border-b-2 active:translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:active:border-b-4 [&>svg]:shrink-0";

    const sizes = {
      sm: "px-3 py-1.5 text-xs gap-1.5 [&>svg]:w-3.5 [&>svg]:h-3.5",
      md: "px-4 py-2.5 text-sm gap-2 [&>svg]:w-4 [&>svg]:h-4",
      lg: "px-6 py-3.5 text-base gap-2.5 [&>svg]:w-5 [&>svg]:h-5",
      icon: "p-2.5 gap-0 [&>svg]:w-4 [&>svg]:h-4",
      /* A stepper's + and −, which `icon` was never the right size for: it is
         built around a 16px glyph and lands at 36px square, so on a phone two
         of them sat a thumb's width apart and neither could be hit reliably.
         48px clears the 44px target floor with the glyph scaled to match, and
         stops there — a stepper is a control beside the number it changes, not
         the thing on screen a child is meant to look at. */
      step: "w-12 h-12 sm:w-14 sm:h-14 text-2xl leading-none gap-0 p-0 [&>svg]:w-5 [&>svg]:h-5",
      /* Answer tiles a child taps: square, large type, a comfortable target. */
      choice: "w-14 h-14 sm:w-16 sm:h-16 text-xl sm:text-2xl gap-0 p-0",
    };

    const variants = {
      primary:
        "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-700 focus-visible:ring-indigo-500",
      secondary:
        "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-900 focus-visible:ring-slate-400",
      success:
        "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700 focus-visible:ring-emerald-500",
      danger:
        "bg-rose-600 hover:bg-rose-500 text-white border-rose-700 focus-visible:ring-rose-500",
      /* Brand amber is a light yellow, so it carries dark ink — white would fail contrast. */
      warning:
        "bg-amber-400 hover:bg-amber-300 text-slate-900 border-amber-600 focus-visible:ring-amber-500",
      ghost:
        "bg-transparent hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800/60 dark:text-slate-400 border-transparent focus-visible:ring-slate-400",
      outline:
        "bg-transparent hover:bg-indigo-50 text-indigo-600 border-indigo-300 dark:hover:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800 focus-visible:ring-indigo-500",
    };

    return `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  },

  card: (variant: CardVariant = "default", className: string = "") => {
    const base = "rounded-2xl transition-all duration-200";
    const variants = {
      default: "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800",
      glass: "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/80",
      bordered: "bg-transparent border-2 border-slate-300 dark:border-slate-700",
      interactive: "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/60 cursor-pointer",
    };

    return `${base} ${variants[variant]} ${className}`;
  },

  badge: (variant: BadgeVariant = "primary", className: string = "") => {
    const base = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide";
    const variants = {
      primary: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60",
      success: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60",
      warning: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60",
      danger: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60",
      info: "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60",
      neutral: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
    };

    return `${base} ${variants[variant]} ${className}`;
  },

  flash: (type: FlashType = "info", className: string = "") => {
    const base = "p-4 rounded-2xl border-2 flex items-start gap-3 transition-all";
    const types = {
      info: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60 text-sky-900 dark:text-sky-200",
      success: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200",
      warning: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200",
      error: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200",
    };
    return `${base} ${types[type]} ${className}`;
  },

  typography: (variant: TypographyVariant = "body", className: string = "") => {
    const variants = {
      h1: "text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white",
      h2: "text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white",
      h3: "text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-100",
      h4: "text-lg font-semibold text-slate-800 dark:text-slate-200",
      body: "text-base text-slate-700 dark:text-slate-300 leading-relaxed",
      "body-sm": "text-sm text-slate-600 dark:text-slate-400 leading-normal",
      caption: "text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider",
      subtitle: "text-sm font-medium text-indigo-600 dark:text-indigo-400 tracking-wide",
    };
    return `${variants[variant]} ${className}`;
  },

  table: {
    wrapper: "w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
    table: "w-full text-left border-collapse text-sm",
    header: "bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-4 py-3 uppercase tracking-wider text-xs",
    row: "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors",
    cell: "px-4 py-3 text-slate-700 dark:text-slate-300",
  },

  /*
   * Every dialog in the app, and the one decision behind all of them: below
   * `rail:` a dialog is a bottom sheet, from `rail:` up it is a centred window.
   *
   * A centred box with a tiny × in its corner is a desktop idiom. On a phone it
   * lands in the middle of the glass, out of reach of the thumb holding the
   * device, and the control that dismisses it is the smallest thing on screen.
   * The sheet is the phone's own answer: it arrives from the edge the thumb is
   * already resting on, and it is the shape every other app on the device uses
   * for exactly this. That matters most for the two dialogs a *child* meets —
   * the PIN prompt and the avatar picker — which is why this is a change to the
   * shared shell rather than to those two.
   */
  modal: {
    overlay:
      "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end justify-center rail:items-center rail:p-4 animate-fade-in",
    content:
      "bg-surface border border-line shadow-2xl shadow-slate-900/25 dark:shadow-black/60 w-full flex flex-col overflow-hidden max-h-[92dvh] rounded-t-[1.75rem] pb-[env(safe-area-inset-bottom)] animate-[koda-sheet-in_240ms_cubic-bezier(0.32,0.72,0,1)] rail:max-h-[85vh] rail:rounded-2xl rail:pb-0 rail:animate-scale-up",
    /* The grabber. It does nothing — there is no drag-to-dismiss — but it is
       the one mark that tells a thumb this panel belongs to the bottom edge. */
    grabber: "rail:hidden mx-auto mt-2.5 -mb-1 h-1 w-9 rounded-full bg-line shrink-0",
    /* `gap-3` + `min-w-0` so a long title wraps against the close button rather
       than under it, and `text-balance` so it splits into even lines instead of
       leaving one word stranded. */
    header:
      "px-5 py-3.5 rail:px-6 rail:py-4 border-b border-line flex items-center justify-between gap-3 shrink-0",
    headerTitle: "min-w-0 text-balance",
    /* A real target, not a 12px glyph: on a phone this is the way out. */
    close:
      "shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface-muted transition cursor-pointer [&>svg]:w-5 [&>svg]:h-5",
    body: "px-5 py-4 rail:p-6 overflow-y-auto overscroll-contain",
    footer:
      "px-5 py-4 rail:px-6 bg-surface-muted border-t border-line flex items-center justify-end gap-3 shrink-0",
  },


  /* KPI stat tiles. The icon carries identity; the value and label stay on ink
     tokens so the number never wears the accent hue. */
  statTile: {
    grid: "grid grid-cols-2 sm:grid-cols-4 gap-3",

    tile: (variant: SurfaceVariant = "default", className: string = "") => {
      const base = "rounded-2xl p-3 sm:p-4 flex items-center gap-3 transition";
      const variants = {
        default:
          "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 cursor-default",
        glass:
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 cursor-default",
        bordered: "bg-transparent border-2 border-slate-300 dark:border-slate-700 cursor-default",
        interactive:
          "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/60 cursor-pointer",
      };
      return `${base} ${variants[variant]} ${className}`;
    },
    well: "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6",
    value:
      "text-base sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums",
    label:
      "text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide",

    tone: (tone: StatTone = "primary") =>
      ({
        primary: "text-indigo-600 dark:text-indigo-400",
        streak: "text-amber-500 dark:text-amber-400",
        success: "text-emerald-600 dark:text-emerald-400",
        danger: "text-rose-600 dark:text-rose-400",
      })[tone],
  },

  /* Hero/feature card: an eyebrow row, a title, a highlighted note, meta chips,
     and one primary action. */
  featureCard: {
    card: (variant: FeatureVariant = "default", className: string = "") => {
      const base = "relative overflow-hidden rounded-2xl p-4 sm:p-5 border-2 transition";
      const variants = {
        default: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
        accent:
          "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60",
        subtle:
          "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80",
      };
      return `${base} ${variants[variant]} ${className}`;
    },
    body: "relative z-10 flex flex-col md:flex-row items-center justify-between gap-4",
    icon: "w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-600/20 border-2 border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 [&>svg]:w-4 [&>svg]:h-4",
    eyebrow:
      "bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 font-mono font-black text-xs px-3 py-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 uppercase tracking-wider",
    title:
      "text-2xl sm:text-3xl font-black tracking-tight leading-tight text-slate-900 dark:text-white",
    note: "flex items-start gap-2.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-xs sm:text-sm max-w-xl font-medium",
    noteStrong: "text-slate-900 dark:text-white font-mono",
    metaRow: "flex flex-wrap items-center justify-center md:justify-start gap-3 pt-0.5",
    metaLead: "text-indigo-700 dark:text-indigo-400 font-mono text-xs font-black uppercase tracking-wider",
    metaItem:
      "flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold [&>svg]:w-3.5 [&>svg]:h-3.5 [&>svg]:shrink-0",
    metaDot: "text-slate-500 dark:text-slate-400",
    action:
      "w-full md:w-auto shrink-0 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm font-mono uppercase tracking-wider border-2 border-b-4 border-indigo-700 active:border-b-2 active:translate-y-0.5 transition-all duration-100 flex items-center justify-center gap-2 cursor-pointer group",
  },

  /* Stepping-stone node on the learning path. Laid out on a grid rather than a
     winding column — the offsets left most of the card empty and the alignment
     read as accidental. */
  pathNode: {
    /* `pt-16` is the start bubble's clearance — it floats above its node, so
       the grid has to reserve the room or the first row clips it. */
    grid: "grid grid-cols-2 sm:grid-cols-4 gap-4 pt-16",
    /* `min-w-0` so a long lesson title wraps inside its column instead of
       pushing the grid wide — the path sits in a half-width card on Home. */
    item: "flex min-w-0 flex-col items-center gap-2 text-center",

    circle: (state: PathNodeState = "available") => {
      /* Same pressable geometry as the buttons: a 4px darker underside that
         compresses on tap. Locked nodes are flat grey and do not move. */
      const base =
        "relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-100 border-2 border-b-4";
      const press = "active:border-b-2 active:translate-y-0.5 cursor-pointer";
      const states = {
        completed: `bg-indigo-400 dark:bg-indigo-600 hover:bg-indigo-300 dark:hover:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-900 ${press}`,
        current: `bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-500 dark:hover:bg-indigo-400 text-white border-indigo-800 dark:border-indigo-800 ${press}`,
        available: `bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-300 border-slate-300 dark:border-slate-900 ${press}`,
        locked:
          "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-700 cursor-not-allowed",
      };
      return `${base} ${states[state]}`;
    },

    starBadge:
      "absolute -top-1 -right-1 bg-amber-400 text-slate-900 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-amber-600",
    /* Duolingo floats the call-to-action above the node as a speech bubble.
       Sized as a real button rather than a chip: it is the one thing on the
       path a child is meant to hit, so it gets a full tap target. Any change
       to its height has to move `-top-14` and the containers' `pt-16` with it
       — `UISkillPath` and `pathNode.grid` both reserve that room. */
    startBadge:
      "absolute -top-14 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 font-black text-xs px-4 py-2 rounded-xl uppercase tracking-wider font-mono border-2 border-b-4 border-slate-200 dark:border-slate-600 whitespace-nowrap koda-bob",
    /* The bubble's tail: a square rotated 45deg with only its two outward
       edges bordered, so it inherits the bubble's outline and fill instead of
       needing a second stacked triangle. */
    startTail:
      "absolute left-1/2 -bottom-[7px] -translate-x-1/2 rotate-45 w-3 h-3 rounded-br-[3px] bg-white dark:bg-slate-800 border-r-2 border-b-2 border-slate-200 dark:border-slate-600",

    title: (state: PathNodeState = "available") => {
      const base = "text-xs font-black font-mono block leading-tight";
      const states = {
        completed: "text-slate-700 dark:text-slate-200",
        current: "text-indigo-700 dark:text-indigo-300",
        available: "text-slate-700 dark:text-slate-300",
        locked: "text-slate-500 dark:text-slate-400",
      };
      return `${base} ${states[state]}`;
    },

    subtitle: "text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block truncate",
  },

  sectionHeader: {
    wrap: "flex items-center justify-between gap-4",
    title:
      "text-lg sm:text-xl font-black font-mono text-slate-900 dark:text-white flex items-center gap-2",
    eyebrowIcon:
      "text-indigo-500 dark:text-indigo-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6",
    subtitle: "text-xs sm:text-sm text-slate-600 dark:text-indigo-200/70 font-medium",
  },

  /* Unit grouping on the learning path. The original used one-off hex purples;
     these map onto the brand indigo scale so both themes resolve. */
  unitBanner: {
    card: "bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border-2 border-slate-200 dark:border-slate-800 relative overflow-hidden",
    banner:
      "rounded-2xl bg-indigo-600 dark:bg-indigo-900 p-3 sm:p-4 flex items-center justify-between gap-3 mb-4 border-2 border-b-4 border-indigo-700 dark:border-indigo-950",
    icon: "text-2xl sm:text-3xl shrink-0",
    title: "text-sm sm:text-base font-black uppercase tracking-wide text-white dark:text-indigo-50",
    description: "text-xs sm:text-[13px] text-indigo-100 dark:text-indigo-200/90 font-bold",
    badge:
      "bg-indigo-500 dark:bg-indigo-800 text-white border-2 border-b-4 border-indigo-700 dark:border-indigo-950 px-3 py-1.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider whitespace-nowrap",
  },

  /* Feedback shown to a learner. Large type and a big single action, because
     the reader is five. Tone carries an icon as well as a colour. */
  kidMessage: {
    wrap: (tone: KidMessageTone = "correct") => {
      const base =
        "flex items-start gap-3 p-4 sm:p-5 rounded-2xl border-2 w-full max-w-3xl mx-auto";
      return `${base} ${{
        correct: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800",
        celebrate: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800",
        tryAgain: "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800",
        hint: "bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700",
      }[tone]}`;
    },

    icon: (tone: KidMessageTone = "correct") => {
      const base =
        "shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6";
      return `${base} ${{
        correct: "bg-emerald-600 text-white",
        celebrate: "bg-indigo-600 text-white",
        tryAgain: "bg-amber-400 text-slate-900",
        hint: "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200",
      }[tone]}`;
    },

    title: "text-lg sm:text-xl font-black text-slate-900 dark:text-white",
    message: "text-sm sm:text-base font-bold text-slate-700 dark:text-slate-200 mt-0.5",
    xp: "text-xs font-black font-mono px-2 py-1 rounded-lg bg-amber-400 text-slate-900",

    action: (tone: KidMessageTone = "correct") => {
      const base =
        "shrink-0 self-center px-5 py-3 min-h-[48px] rounded-2xl font-black font-mono uppercase tracking-wider text-sm text-white border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all duration-100 cursor-pointer";
      return `${base} ${{
        correct: "bg-emerald-600 hover:bg-emerald-500 border-emerald-800",
        celebrate: "bg-indigo-600 hover:bg-indigo-500 border-indigo-800",
        tryAgain: "bg-amber-500 hover:bg-amber-400 border-amber-700 !text-slate-900",
        hint: "bg-slate-600 hover:bg-slate-500 border-slate-800",
      }[tone]}`;
    },
  },

  menu: {
    panel:
      "min-w-[13rem] rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-900/5 dark:shadow-black/40 p-1.5 z-50",
    label:
      "px-2.5 pt-2 pb-1 text-[11px] font-black font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400",
    separator: "my-1.5 h-px bg-slate-200 dark:bg-slate-700/80",

    item: (isActive: boolean = false, tone: "default" | "danger" = "default") => {
      const base =
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-bold font-mono transition cursor-pointer text-left [&>svg]:w-4 [&>svg]:h-4 [&>svg]:shrink-0";
      if (tone === "danger") {
        return `${base} text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40`;
      }
      return isActive
        ? `${base} bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300`
        : `${base} text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`;
    },
  },

  /* A confirmation. Same sheet-on-a-phone rule as `modal`, and its buttons go
     full width down there — a pair of small buttons huddled bottom-right is a
     mouse's layout. */
  dialog: {
    overlay:
      "fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end justify-center rail:items-center rail:p-4 animate-fade-in",
    content:
      "bg-surface border border-line shadow-2xl shadow-slate-900/25 dark:shadow-black/60 w-full rail:max-w-md p-5 rail:p-6 space-y-4 rounded-t-[1.75rem] pb-[calc(1.25rem+env(safe-area-inset-bottom))] rail:rounded-2xl rail:pb-6 animate-[koda-sheet-in_240ms_cubic-bezier(0.32,0.72,0,1)] rail:animate-scale-up",
    actions:
      "flex flex-col-reverse gap-2 pt-2 rail:flex-row rail:items-center rail:justify-end rail:gap-3 [&>button]:w-full rail:[&>button]:w-auto",
  },


  /*
   * The account sheet, and the settings list.
   *
   * Both are lists of rows a finger picks from, so they share a shape: a
   * grouped card with hairline dividers rather than a stack of separate
   * bordered boxes. Nested cards were what made Settings look busy on a phone —
   * two borders and two backgrounds around every switch, before the switch.
   */
  list: {
    /* The heading above a group, outside the card. Small, quiet, and the same
       mark the rail uses for a section, so the app has one way of saying
       "these belong together". */
    groupLabel:
      "text-[11px] font-black uppercase tracking-wider text-muted font-mono px-1 mb-2",
    group:
      "bg-surface border border-line rounded-2xl overflow-hidden divide-y divide-line",
    /* One row. Generous vertical padding: this is a list a child scrolls with a
       thumb, and 44px is the floor, not the target. */
    row: "w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left",
    rowTap:
      "w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer transition hover:bg-surface-muted active:bg-surface-muted",
    rowIcon:
      "w-9 h-9 rounded-xl bg-surface-muted border border-line flex items-center justify-center shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px] text-muted",
    rowTitle: "text-sm font-bold text-ink truncate",
    rowNote: "text-xs text-muted mt-0.5",
    rowDanger: "text-sm font-bold text-rose-600 dark:text-rose-400",

    /* An account to switch to. Deliberately the biggest target in the app: a
       six-year-old picking their own face off a list is the one flow here that
       is *only* ever done by a child, and a 14px menu row is a grown-up's
       control. The face does the identifying; the name confirms it. */
    account: (isActive: boolean = false) =>
      `w-full flex items-center gap-3.5 px-4 py-3 text-left cursor-pointer transition ${
        isActive
          ? "bg-indigo-50 dark:bg-indigo-500/15"
          : "hover:bg-surface-muted active:bg-surface-muted"
      }`,
    accountAvatar: "h-12 w-12 rounded-2xl overflow-hidden shrink-0 border border-line",
    accountName: "text-[15px] font-extrabold text-ink truncate leading-tight",
    accountMeta: "text-xs font-bold text-muted truncate mt-0.5",
    accountActive:
      "shrink-0 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300",

    /* Light / dark as two halves of one control, not two menu lines: the
       choice is between them, and a segmented pair says so. */
    segmentRow: "flex gap-2 p-3",
    segment: (isActive: boolean = false) =>
      `flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold cursor-pointer transition [&>svg]:w-4 [&>svg]:h-4 ${
        isActive
          ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300"
          : "bg-surface border-line text-body hover:bg-surface-muted"
      }`,
  },

  /*
   * The sidebar rail — the navigation from `rail:` (720px) up.
   *
   * A rail only. It has no drawer and no hamburger, because below `rail:` it is
   * not hidden, it is *absent*: the phone gets the tab bar instead, and the two
   * never share a screen. That is what this block lost when the drawer went —
   * roughly a third of it was the off-canvas machinery for a width that now has
   * a better answer.
   *
   * Light-first with `dark:` overrides, matching the rest of this file. The
   * `dark` variant is driven by the `.dark` class ThemeContext puts on <html>
   * (see the @custom-variant in index.css), not by the OS setting.
   */
  sidebar: {
    aside:
      "hidden rail:flex sticky top-0 z-30 h-screen shrink-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/90 text-slate-900 dark:text-slate-100 transition-[width] duration-300 flex-col justify-between p-3.5 sm:p-4",
    widthExpanded: "w-64",
    widthCollapsed: "w-20",
    brandBar:
      "flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/90",
    brandIcon:
      "w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0",
    brandTitle:
      "font-mono font-black text-lg text-slate-900 dark:text-white tracking-tight leading-tight",
    brandSubtitle:
      "text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono",
    iconButton:
      "p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition border-2 border-slate-200 dark:border-slate-700",
    sectionLabel:
      "text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono px-3 mb-2",
    footer: "pt-3 border-t border-slate-200 dark:border-slate-800/90 space-y-3",

    navItem: (isActive: boolean = false, isCollapsed: boolean = false, className: string = "") => {
      const base =
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer group";
      const collapsed = isCollapsed ? "justify-center px-2" : "";
      /* Selection reads as a soft wash of the brand hue rather than a solid
         fill, so the rail stays quiet and the label keeps its contrast. */
      const state = isActive
        ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold border-2 border-indigo-200 dark:border-indigo-500/40"
        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70";
      return `${base} ${collapsed} ${state} ${className}`;
    },

    /* Sizes whatever icon element the caller passes, so Lucide's 24px default
       does not leak through the wrapper. */
    navIcon: (isActive: boolean = false) =>
      `inline-flex shrink-0 [&>svg]:w-5 [&>svg]:h-5 ${
        isActive
          ? "text-indigo-600 dark:text-indigo-400"
          : "text-slate-400 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
      }`,

    navLabel: (isActive: boolean = false) =>
      `text-sm font-mono tracking-tight ${
        isActive
          ? "font-extrabold text-indigo-700 dark:text-indigo-300"
          : "font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white"
      }`,

    navBadge:
      "text-[11px] font-mono px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-2 border-slate-200 dark:border-slate-700 font-black uppercase",

    /* Quick tools sitting above the account row. They are actions, not
       destinations, so they are deliberately not `navItem` — the rail's
       selected-page styling would claim a page that was never opened. */
    toolRow: (isCollapsed: boolean = false) =>
      `flex gap-2 ${isCollapsed ? "flex-col" : ""}`,
    toolSecondary: (isCollapsed: boolean = false) =>
      `flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl bg-white dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
        isCollapsed ? "px-2" : ""
      }`,
    toolIcon: "shrink-0 [&>svg]:w-4 [&>svg]:h-4",
    toolLabel: "text-xs font-mono font-black tracking-tight",

    profileRow:
      "w-full flex items-center gap-2.5 p-2 rounded-2xl bg-white dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer text-left",
    profileChevron: "ml-auto shrink-0 text-slate-400 dark:text-slate-500 transition",
    profileAvatar:
      "w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 font-mono font-black text-sm overflow-hidden",
    profileName:
      "text-sm font-extrabold font-mono text-slate-900 dark:text-white leading-tight truncate",
    profileRole:
      "text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate",
  },

  /*
   * The app shell: one toolbar at the top, one tab bar at the bottom, and the
   * sheet the overflow tab opens.
   *
   * Light-first with `dark:` overrides, matching the rest of this file. The
   * `dark` variant is driven by the `.dark` class ThemeContext puts on <html>
   * (see the @custom-variant in index.css), not by the OS setting.
   *
   * This replaced a sidebar. Worth saying why, because the sidebar was the
   * cheaper thing to keep: Koda is played by a five-year-old holding a phone,
   * and a rail that is a drawer under `lg` means every destination on that
   * phone costs a tap on a hamburger before it costs a tap on the thing they
   * wanted. A tab bar is the same destinations, permanently visible, inside
   * the thumb's reach. The desktop follows the phone rather than the other way
   * round so that a child moving between the family tablet and the family
   * laptop is not learning the app twice.
   */
  appShell: {
    /* The whole shell is a column: toolbar, page, tab bar. The page is what
       scrolls, so the two bars never move. */
    root: "min-h-[100dvh] flex flex-col rail:flex-row bg-canvas text-body font-sans transition-colors duration-200 selection:bg-indigo-600 selection:text-white",
    /* The page column beside the rail. `min-w-0` so a wide table inside a page
       scrolls itself instead of pushing the rail off the screen. */
    column: "flex-1 min-w-0 flex flex-col bg-surface",

    /* --- Toolbar ------------------------------------------------------- */

    /* Sticky rather than fixed: it participates in the column, so nothing has
       to be padded to clear it. Translucent, because a page scrolling under
       frosted glass is what tells a thumb the page moved. */
    bar: "rail:hidden sticky top-0 z-40 shrink-0 bg-surface/85 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/70 pt-[env(safe-area-inset-top)]",
    /* The hairline only exists once there is something above it to separate.
       At rest the toolbar and the page read as one surface. */
    barEdge: (isScrolled: boolean = false) =>
      `h-14 px-4 flex items-center gap-2 border-b transition-colors duration-200 ${
        isScrolled ? "border-line" : "border-transparent"
      }`,
    /* No max-width: the toolbar only exists below `rail:`, where the page is
       narrower than any cap it could carry. It centred against `max-w-5xl`
       while the bar was still drawn on a desktop. */
    barInner: "w-full flex items-center gap-2",
    brandMark: "w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30",
    /* The destination, not the product name — a toolbar that says "KODA" on
       every screen has spent its most legible line saying nothing. */
    barTitle: "font-black text-[17px] tracking-tight text-ink truncate leading-none",
    barSubtitle: "text-[11px] font-bold text-muted truncate leading-none mt-1",

    /* A live figure — streak, XP. Deliberately not `badge()`: these are read at
       a glance from across a room, so the number carries the weight and the
       tabular numerals stop it jittering as it counts up. */
    chip: (tone: "streak" | "xp" = "xp") =>
      `inline-flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-full text-[13px] font-black tabular-nums border ${
        tone === "streak"
          ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-500/25"
          : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/25"
      }`,
    chipIcon: "shrink-0 [&>svg]:w-4 [&>svg]:h-4",

    /* Round, so it reads as a portrait rather than a button with a face in it. */
    avatarButton:
      "shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 border-line hover:border-indigo-400 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",

    iconButton:
      "shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface-muted transition cursor-pointer [&>svg]:w-5 [&>svg]:h-5",

    /* --- Tab bar ------------------------------------------------------- */

    /* Fixed, so it survives a page that scrolls its own inner region, and
       `z-40` so it sits under every dialog. Edge to edge on a phone — that is
       where the thumb expects the OS to hand the bar over — and a floating
       dock from `sm` up, because a 1440px-wide strip of five icons is not a
       navigation bar, it is a horizon. Same tabs, same order, same code. */
    tabBarWrap: "rail:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none",
    /* The home indicator's inset is padding *inside* the bar, not a gap under
       it. On the wrapper it was an unpainted strip the page scrolled through,
       so a phone with gesture navigation showed a finger-thick band of moving
       content below the tabs — the bar looked like it was floating over a hole.
       Opaque, too: `bg-surface/75` under a blur let whatever card happened to be
       passing tint the tabs, and a navigation bar that changes colour as you
       scroll reads as a rendering fault rather than as depth. `bg-surface` is
       the colour `column` paints the page, so the bar is the page's own ground
       rather than a second surface laid on top of it.

       All four insets are paid here for the same reason: `fixed` positions
       against the viewport, so the body's side padding never reached this bar
       either. It only shows on a phone narrow enough to keep the tabs in
       landscape, but that is exactly where the notch is on the side. */
    tabBar:
      "pointer-events-auto flex items-stretch gap-1 bg-surface border-t border-line pl-[calc(0.375rem+env(safe-area-inset-left))] pr-[calc(0.375rem+env(safe-area-inset-right))] pt-1.5 pb-[calc(0.25rem+env(safe-area-inset-bottom))]",

    /* Each tab owns an equal share of the bar so the targets stay predictable
       under a thumb that is not looking. */
    tabItem:
      "group flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-2xl py-1 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
    /* Selection is colour alone — no pill behind the icon. The label's weight
       carries it for anyone the colour does not reach: `font-black` against
       `font-bold` is a difference you can see in a sunlit window. */
    tabIcon: (isActive: boolean = false) =>
      `relative flex items-center justify-center h-8 transition-colors duration-200 [&>svg]:w-[22px] [&>svg]:h-[22px] group-active:scale-90 ${
        isActive
          ? "text-indigo-600 dark:text-indigo-300"
          : "text-muted group-hover:text-ink"
      }`,
    tabLabel: (isActive: boolean = false) =>
      `text-[10.5px] leading-none tracking-tight truncate max-w-full transition-colors ${
        isActive ? "font-black text-indigo-600 dark:text-indigo-300" : "font-bold text-muted"
      }`,
    /* A count that has to be seen without being read. */
    tabDot:
      "absolute top-0.5 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-surface",

    /* --- Destination tile ---------------------------------------------- */

    /* A big square target, because this is where a hand that missed the tab
       bar comes looking. */
    navTile: (isActive: boolean = false) =>
      `flex flex-col items-center justify-center gap-2 rounded-2xl p-3 min-h-[5.25rem] border-2 transition cursor-pointer text-center ${
        isActive
          ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/40"
          : "bg-surface border-line hover:border-indigo-300 hover:bg-surface-muted"
      }`,
    navTileIcon: (isActive: boolean = false) =>
      `[&>svg]:w-6 [&>svg]:h-6 ${
        isActive ? "text-indigo-600 dark:text-indigo-300" : "text-muted"
      }`,
    navTileLabel: (isActive: boolean = false) =>
      `text-[11.5px] font-extrabold leading-tight ${
        isActive ? "text-indigo-700 dark:text-indigo-300" : "text-ink"
      }`,

    /* --- Page ---------------------------------------------------------- */

    /*
     * One column, centred, and the only place a page's gutter is decided.
     *
     * Eleven pages used to add `spacing.page` of their own on top of this, so a
     * 390px phone spent 64px of its width on gutters and the distance from the
     * toolbar to the content differed by page. They stopped; this stayed.
     *
     * `max-w-6xl` rather than `5xl` so it never silently narrows a page that
     * asked for its own wider measure — Roles wants `6xl` for its table. A page
     * may still choose something *narrower*, and most do.
     */
    page: (hasTabBar: boolean = true) =>
      `flex-1 w-full max-w-6xl mx-auto p-4 rail:p-6 ${
        /* Clearance for the tab bar *and* for Ask Koda floating above it, so
           the last row of a page is never parked under a button that cannot be
           moved. Only owed on a phone; the rail has neither. */
        hasTabBar ? "pb-[calc(9.5rem+env(safe-area-inset-bottom))] rail:pb-6" : "pb-6"
      }`,
    pageBleed: "flex-1 w-full",

    /* Floating things — Ask Koda — clear the dock rather than landing on it. */
    aboveTabBar: "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] rail:bottom-6",
  },
};
