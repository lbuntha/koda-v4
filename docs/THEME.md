# Koda theme contract

What a screen is allowed to be made of. Read it before writing a skill's UI: a
component that picks its own colours is theme-correct in exactly one theme, and
the one it is wrong in is whichever you were not looking at.

Everything here is defined in two files — `src/index.css` for the tokens and
`src/lib/themeSystem.ts` for the shapes built from them. Where this page and
those files disagree, they win.

## Product identity

- Product name: **Learn with Koda**. Koda is the character; a skill is not one.
- Audience: children learning independently, mostly on touch devices, ages 5
  through the teens — so a screen must not read as babyish at the top of that
  range or as a form at the bottom.
- Shape language: round controls, `rounded-2xl` / `rounded-3xl` cards, icon wells.
- Motion: brief and purposeful. The vocabulary is `kit/motion.ts` — `SPRING`,
  `stagger`, `idleFloat`, `useMotionOK`. Do not hand-tune a spring, and always
  respect `prefers-reduced-motion`.

## Semantic tokens

One definition per theme, swapped by the `.dark` class that `ThemeContext` sets
on `<html>`. A component that uses these is theme-correct without asking which
theme it is in.

| Utility | Token | Use |
|---|---|---|
| `bg-canvas` | `--koda-canvas` | the page behind everything |
| `bg-surface` | `--koda-surface` | cards, bars, menus |
| `bg-surface-muted` | `--koda-surface-muted` | wells, tracks, quiet fills |
| `text-ink` | `--koda-ink` | headings and anything that must be read |
| `text-body` | `--koda-body` | explanations |
| `text-muted` | `--koda-muted` | metadata, eyebrows, captions |
| `border-line` | `--koda-line` | card and control edges |
| `bg-play-sky`, `bg-play-ground` | `--koda-play-*` | the ground an activity plays on — sky above, meadow below |

**Never a raw slate shade in feature code.** `bg-slate-100` is a second
definition of the surface, and it is wrong in one theme. The play tokens exist
for the same reason: every activity that draws a play area is the same place,
and re-tinting the product is one edit rather than a search.

The brand also overrides Tailwind's own scales in `@theme`, so `bg-indigo-600`
is Koda's indigo (`#6B46C1`) and `bg-rose-600` is Koda's rose. Use those for
accents; use the semantic tokens for surfaces.

### Colour that means something

| Role | Colour |
|---|---|
| Primary action, selected navigation, current step | indigo / violet |
| XP | indigo | 
| Streak | orange |
| Completed, correct | emerald |
| Wrong, destructive, leaving | rose |
| Practice | violet, on the path and in the round |

**No amber and no yellow, anywhere.** It fails against this app's light surface
— the lesson-card chip measured 168,143,0 on 255,249,196, a yellow on a yellow.
The amber scale still exists in `index.css` for older code; new code does not
reach for it. And **never encode state in colour alone**: a colour is how a
state looks, never how it is known.

## Typography

**Plus Jakarta Sans** for everything a child reads; **JetBrains Mono** is
reserved for technical values — ids, versions, counts, log rows. Both load as
variable fonts, so any weight the UI asks for exists.

Feature code inherits the global font and reaches for `themeSystem.typography()`
(`h1`–`h4`, `body`, `body-sm`, `caption`, `subtitle`) rather than restating
sizes. The `koda-admin-*` classes are the operator surface's own scale and are
not for learner screens.

## Shared primitives

Import from `src/components/ui`, and style through `themeSystem`:

```tsx
import { UIButton, UIBadge, UICard } from "../../components/ui";
import { themeSystem } from "../../lib/themeSystem";

<div className={themeSystem.card("interactive", themeSystem.spacing.card)}>
  <h3 className="text-base font-black text-ink">Number Bonds</h3>
  <p className="mt-1 text-xs text-muted">Two parts, one whole.</p>
  <UIButton variant="primary" size="sm">Play</UIButton>
</div>
```

| Reach for | Instead of |
|---|---|
| `themeSystem.button(variant, size)` or `UIButton` | a hand-written class string |
| `themeSystem.card(variant)` or `UICard` | `bg-white rounded-2xl border …` |
| `themeSystem.field(size)` | styling an `<input>` yourself |
| `UIBadge`, `UIStatTile`, `UIDataTable`, `UIModal`, `UISkillThumbnail` | a second version of any of them |
| `themeSystem.spacing.card` / `.section` / `.stack` | picking a padding per component |

`themeSystem` also owns the composite surfaces — `statTile`, `featureCard`,
`pathNode`, `sectionHeader`, `unitBanner`, `kidMessage`, `menu`, `dialog`,
`list`, `sidebar`, `appShell`. If you are about to write one of those, it
already exists.

Touch targets: **44px on a touch device**, which the button scale already
enforces with a `pointer-coarse:min-h-11` floor — so use the scale rather than a
bespoke height. It keys off the input device, not the viewport: a tablet is a
wide screen with fat fingers, and a breakpoint would have left it at 34px.

## Two widths, one product

Koda has one breakpoint that changes shape: `rail:` (720px), declared in
`src/index.css`. It is not Tailwind's `md` because 768px runs through the middle
of the devices this has to get right — an iPad mini is 744px in portrait.

Below `rail:` the app is a phone: a toolbar, a bottom tab bar of four
destinations, and dialogs that arrive as bottom sheets. From `rail:` up it is
the sidebar rail, the page beside it, and dialogs as centred windows. Both nav
shells are always mounted and each hides itself at the width that is not its
own, so the choice is CSS, never a measurement.

Feature code should not re-decide this. `UIModal` and `UIDialog` already switch
shape, `themeSystem.list` is the grouped-row style both Settings and the account
sheet use, and `MainLayout` owns the gutter. A component reaching for its own
`rail:` rule is usually a sign the shared piece is missing.

Two rules that follow, and both were learned by breaking them:

- **A page never sets its own page padding.** `MainLayout` pads and centres; a
  page that adds `spacing.page` again spends 64px of a 390px screen on gutters
  and lands its content at a different distance from the toolbar than its
  neighbours do. Pages still choose their own `max-w-*`.
- **Hiding with a class is not the same as not rendering.** `space-y-*` spaces a
  child it cannot see, so anything that removes itself at one width inside a
  stack must return `null` — that is what `useIsCompact()` in
  `lib/useBreakpoint.ts` is for. Use a `rail:` class when the difference is only
  how a thing looks, and the hook when it must not be in the tree at all.

A third that applies to any list of cards: **one first thing.** Three identical
cards stacked in one column is three identical primary buttons, so nothing reads
as "start here" — the Today band leads with one full card and collapses the rest
to rows below 640px. `UILessonCard`'s `compact` variant is the worked example.

## Learner UI rules

1. One clear action per card. "Play", "Continue", "Carry on", "Try again".
2. Short copy that says what happens next, never what the code does.
3. Friendly art or an honest empty state; never a broken image placeholder.
4. `p-4 sm:p-6` and `gap-3`–`gap-6`; one column on a phone.
5. No admin tables or dense controls on a learner screen — those belong to the
   operator surface, which has its own type scale for exactly this reason.
6. Check every screen in **light and dark**, and at **360px wide**. Both, every
   time: half of what this page exists to prevent is invisible in one of them.

## Where a skill fits

A skill draws only what the child touches. The bar, the step header, the
feedback strip and the finish screen belong to `kit/` (`SkillRound`), and a
skill that rebuilds one of them has stopped being part of the same product —
that is not a style preference, it is the reason the kit exists. See
`docs/SKILL_DEVELOPMENT.md` §4 for the house rules that apply inside the part
you do draw.
