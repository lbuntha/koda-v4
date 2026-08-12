# Canvas layout pattern — "the Move & Count design"

**The reference implementation is `frontend/src/components/canvases/CountCanvas.tsx`.**
When the ask is *"make canvas X look/behave like Move & Count"*, this file is the spec.
Read it, then read the reference canvas, then port.

> **Move & Count is no longer a component.** It is a *staging* of `CountCanvas` — see §10.
> `MoveAndCountCanvas`, `OneToOneCanvas`, `LineUpCanvas`, `MagnetsCanvas`, `GroupTensCanvas`,
> `CountOnCanvas`, `CountBackCanvas` and `ArrangementsCanvas` were eight copies of one activity
> and were merged; their technique ids still resolve, so released content is untouched. Do not
> re-create them.

Already on the pattern: `CountCanvas`, `SubitizeCanvas`, `AdditionCanvas`,
`SubtractionCanvas`, `FlexibleCanvas`, `StoryProblemMatCanvas`, `PlaceValueLabCanvas`,
`DataChartCanvas`, `MeasureLengthCanvas`.

---

## 1. What the pattern is

A drag-and-drop canvas is three things, and each one has exactly one shared implementation:

| Concern | Owner | Never do instead |
|---|---|---|
| Frame, header, hint line, footer, grid, rulers | `SharedCanvasLayout` | hand-rolled headers, a local grid `<svg>` |
| Bins: label, tally, active state, empty state | `CanvasBin` | a `div` with `surfaceClass` + a mono caption |
| Object size, bin content zones, slot maths | `objectLayout.ts` | hardcoded `52 on mobile / 64 otherwise` |
| How an object is positioned and how it settles | `objectMotion.ts` | per-canvas `left`/`top` + its own easing |

Objects are **absolutely positioned in the stage**, above the bins, in stage pixels.
Bins are **laid out by flexbox** and then **measured**. Objects never live inside a bin's
DOM — they must be draggable *between* bins.

---

## 2. The stage

```tsx
<div
  ref={stageRef}
  onPointerMove={…} onPointerUp={…} onPointerCancel={…}
  className="relative flex-1 w-full flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4
             min-h-[260px] sm:min-h-[300px] md:min-h-[340px]
             touch-none select-none overscroll-none"
>
```

- `flex-1` is what makes the canvas fill a launcher. Keep the `min-h-*` floors modest —
  a floor taller than the window overflows the layout's `min-h-0` parent and pushes the
  bins over the hint line.
- `touch-none select-none overscroll-none` — without these a drag scrolls the page on a tablet.
- Wide stages put bins side by side, narrow stages stack them. That flip is a real layout
  change (see §5).

**No absolutely-positioned, teacher-draggable containers.** A bin that a teacher can drag
and resize (the old `shelfLayout` / `containerPositions` / `shelfDimensions` machinery) is
what produced overlapping boxes and objects spilling off the stage. Bins flow; only objects
are positioned.

---

## 3. Bins

```tsx
<CanvasBin
  ref={sourceRef}
  label={question.config.sourceBinLabel || (learnerMode ? "Move these" : "Uncounted")}
  tally={isPlayMode ? remaining : undefined}
  accent={accent}
  isDark={isDark}
  active={activeDropZone === "source"}     // a drag is over me
  complete={isPlayMode && remaining === 0} // I have everything I was waiting for
  isEmpty={isPlayMode && remaining === 0}
  emptyIcon={<PartyPopper size={22} />}
  emptyHint={isPlayMode && !answerPanelOpen ? "All moved!" : undefined}
/>
```

Rules:

- **Labels are the instruction.** `learnerMode` (from `useCanvasAudience()`) gets a child's
  phrasing at reading size; a teacher authoring the slide gets the quiet mono caption.
  Teacher overrides come from `config.sourceBinLabel` / `config.destinationBinLabel`.
- **Tally in play mode only.** Design mode shows no counts.
- **Never transform a bin.** Drop maths measures these boxes; a hover `scale` silently moves
  the target. `active` is a ring + brighter fill, and that is deliberate.
- **`children` is for overlays only** — `GhostGuideOverlay`, a cell grid, a celebration.
  Not objects.
- Suppress `emptyHint` when the answer panel docks over that bin, or the two stack up.
- If a bin's own content already says "put one here" (a ten-frame's dashed cells, Line Up's
  numbered slots), skip `emptyHint` — two invitations in one box is one too many.

Bins that must be positioned by measurement (Line Up's bands, a fixed-height shelf) pass
`style` inline — `flex: "0 0 120px"`, `position: "absolute"` — because `CanvasBin`'s own
`flex-1 basis-0 relative` classes would otherwise win.

**A decorative container is not a drop target.** Magnets draws a jar/basket/box; the *bin* is
what a drop is tested against, and the drawing sits centred inside it, sized from it. Objects
that land in it are slotted into an interior rect expressed as fractions of the drawing's box
(`CONTAINER_INTERIOR`) so every shape and every stage size holds its objects in the right place
— not by a hardcoded pixel inset and a magic `hypot(...) < 110` radius.

**Teacher-authored coordinates are the one exception to flowed bins.** Flexible lets a teacher
place items and bins anywhere on a fixed 480 × 320 design grid, which is then scaled to fill the
stage — so its bins cannot flow. They still *are* `CanvasBin`s: the wrapper carries the authored
position and the bin fills it, so a basket reads the same there as everywhere else. What is
forbidden is a canvas inventing its own bin chrome, not a canvas positioning one.

**A canvas with no second bin still gets one.** Count Back has nothing to drag between bins, so
it is one bin for the set plus a short band for the countdown readout — same chrome, same
`complete` state. The rule is not "two bins"; it is "every region a child looks at is a
`CanvasBin`". That band is a `readout` zone (§10): it takes a `flex` slice rather than half the
stage, draws its own content, and is never a drop target.

---

## 4. Sizing and slots — `objectLayout.ts`

Never hardcode an object size. The rule is: **an object's size comes from the room its bin
actually has.**

```ts
const bin = binSizeForStage(stageWidth, stageHeight, { stacked: isMobile });
const itemSize = fitObjectSize({ width: bin.width, height: bin.height, count });
const assetSize = Math.round(itemSize * (hasFrame ? 0.7 : 0.92));
```

- `fitObjectSize` grids the objects, takes ~82% of a cell, clamps to `OBJECT_SIZE` (36–136).
- An object with a second master (a ten-frame cell *and* a shelf) takes the **min** of both fits.

**Start from `countingObjectSize(...)`.** It is literally what Move & Count computes — split the
stage in two, fit `count` objects into one half — and it is the size a child should see for the
same apple in every counting activity. Go smaller only when a real slot geometry forces it: a
ten-frame is five cells across, and that is not negotiable. A *decorative* container is not such
a force — see the pile rule below.

**A container makes objects smaller as they go in, not before.** Magnets sized every object to
fit a grid inside the jar's mouth, so the apples waiting on the shelf were half the size of the
same apple in Move & Count. Loose objects take the shared size; `pilePosition` packs collected
ones from the floor of the container upward at whatever size the interior can actually hold, and
the shrink animates on the drop, where a child reads it as "it went in".

**Never copy artwork into item state.** Store position and progress; read `assetType`, the
emoji and the asset reference from `question.config` at render. Subtraction kept a copy of
`assetType` on every item, rebuilt only when a key made of the question id, the count and the
plate size changed — so swapping the picture in the studio did nothing. Adding `assetType` to
that key would not have been enough either: switching between two custom SVGs leaves
`assetType` as `custom_svg` and only moves `customSvgAssetId`. Reading at render is the only
version that is always right.

**Size the object first, then the band that holds it.** Giving a tray or shelf a flat share of
the stage ("30% of the height") and asking `fitObjectSize` what fits is backwards, and it fails
the same way every time: on a short stage the band's own chrome — caption plus padding, ~68px —
eats the whole content area, so every object comes back at the `OBJECT_SIZE.min` floor while the
band above sits half empty. Instead, in one `useMemo`:

1. `chrome = captionH + pad * 2` — what a band spends before anything fits (~50 compact, ~68 not).
2. Cap the unit by each master: width per object across the row, and
   `(stageHeight - gap - chrome * bands) / rowsNeeded` for the height. Clamp to `OBJECT_SIZE`.
3. Derive the band height *from* the unit: `unit + (rows - 1) * unit * 1.28 + chrome`, capped at
   ~42% of the stage. The other band takes the rest.

With three bins sharing one stage (Addition: two addend groups over a basket) solve it directly
instead — walk `candidate` down from `OBJECT_SIZE.max` and take the first size whose rows in
*every* bin still fit the stage height. Band heights fall out of the answer.

**Floor a fit, never round it.** `Math.round` on a computed size rounds *up* half the time, which
overflows the box the size was measured into by a pixel or two — and stacking that per object
across a column is visible. This has bitten three canvases now.

A narrow stage should let a tray run to two rows (`count / 2` in the width cap) rather than
shrinking every object to fit one — `slotPosition` wraps them anyway.

Two shared numbers this rests on, both matching `CanvasBin`'s real chrome — keep them honest:
`BIN_PADDING` (16, its `p-3 sm:p-4 md:p-5`) and the content area's `min-h-[44px]` floor. A larger
floor makes a short fixed-height band silently grow past the box the canvas measured it as.
- Placement: measure the bin, then slot into it.

```ts
const stageRect = stageRef.current.getBoundingClientRect();
const zone = contentZone(relativeRect(binRef.current, stageRect), itemSize);
const { x, y } = slotPosition(order, count, zone, itemSize);
```

- `order` is **progress, not index**: the n-th object *in that bin*. Slotting by array index
  leaves a hole where a moved object used to be, which a child reads as "one is missing".
- **Re-flow *every* bin on release, never just the object that was let go.** Placing the
  released object alone — at `others still loose + 1`, the end of the queue — drops it on
  top of whichever sibling already sits there. Where the activity is ordinal (Count On: only
  the front object may move) it also leaves a *locked* object at the head of the queue, and a
  child reads that as the object refusing to be dragged. Map over the bin and re-rank:

  ```ts
  let rank = 0;
  return settled.map(d => (d.placed ? d : { ...d, ...trayPos(++rank) }));
  ```

  **This applies to the destination bin too, and that is the half everyone forgets.** Numbering
  an arrival `counted.length + 1` assumes the orders already in the bin are contiguous. Pull the
  2nd of three back out and the next drop computes 3 — landing exactly on the object already
  badged 3, with the tally reading 3 while the child can see two. Sort the bin by its existing
  order (the arrival carries `null`, which sorts last), renumber 1..n, and re-slot. Badges are a
  count: they must always read 1..n, with no gaps and no repeats.
- Fallback zone when a ref has not measured yet — never lay out against a guessed stage.
  `dimensions` starts `null` and nothing is placed until a real `ResizeObserver` measurement
  lands (seeded in `useLayoutEffect`, before paint).

**Base-ten blocks size themselves too.** `Base10Blocks` owns the rule — one unit is the module,
a rod is ten of them — and ships `useFittedUnitSize` / `RodFit` / `fitRodGrid` so a block fits the
box it is in. Never pass `Base10Scale` a hardcoded size: Place Value Lab had six different ones,
and the bank's rod at unit 18 is ~220px wide in a card that was not, so it hung out over both
edges. Note the floor: a rod is read as a length, so fitting beats `UNIT_MIN` — clamping a rod
*up* to the readable-unit floor is what makes nine of them overflow their zone. `fitRodGrid`
also picks the rod's **orientation**: a rod is a 12:1.4 sliver, so the answer flips with the
shape of the box. Wide desktop zone → lying down, reading left to right. A phone's ~110px place
column → standing up, which fits at more than twice the unit size. Never hardcode `orientation`.

**Objects arranged in a shape** — a line, a ring, a wave, a dice face, a deliberate scatter —
do not hand-roll the formula. `oneToOneLayout.ts` places a pattern's *centres* first and lets
the tightest gap between any two of them decide the object size, so no pattern can ever overlap
itself. Add a pattern there, not in a canvas: a per-canvas copy is how Arrangements ended up
with a table of ten scatter coordinates that a slide asking for twelve wrapped straight back
round, stacking objects 11 and 12 on top of 1 and 2.

A canvas that only *shows* objects still uses these rules — Subitize flashes them, and its dice
faces were a table of pixel offsets tuned against one 440 × 220 box.

**Measured or derived.** Two legitimate ways to get a bin's box, and one wrong one:

- *Measured* (Move & Count, Group Tens) — `relativeRect(binRef, stageRect)`. Use it when the
  bin's size depends on content or on a breakpoint the component cannot cheaply predict.
- *Derived* (Count On, Count Back, Line Up) — when the bins fill the stage edge to edge and
  their heights are computed anyway, build the `Rect`s arithmetically in a `useMemo` alongside
  the sizes. No DOM round trip before the first object lands, and overlays drawn in stage
  coordinates (a counting path, a number line) sit on exactly the numbers the slots used.
- *Wrong*: reading `getBoundingClientRect()` during render.

---

## 5. Re-layout on resize

Track what the current coordinates were laid out against:

```ts
const laidOutAt = useRef<{ width: number; height: number; stacked: boolean } | null>(null);
```

Three cases, in order:

1. **Placed objects** (counted / snapped) — re-measure their target and re-centre on it.
2. **Flipped** (`stacked` changed) — bins moved somewhere a proportional nudge cannot follow,
   so re-slot loose objects into their bin.
3. **Resized** — scale `x`/`y` by the stage ratio and clamp.

A question change (`question.id`, `objectId`, `targetCount`) rebuilds from scratch.

---

## 6. Drag

- One pointer capture on the **stage**, not on the object — `setPointerCapture` in
  `handlePointerDown`, released in up *and* cancel.
- `handlePointerMove`: clamp to the stage, snap to `GRID_STEP` in design mode with `showGrid`,
  set `activeDropZone` by testing the **object's centre** against each measured bin rect.
- `handlePointerUp`, play mode: dropped in a bin → slot it, `sounds.playTick(order)`;
  dropped nowhere → return it to its own place in the source bin and re-flow that bin (§4).
- **A tap is not a drag.** Record the press origin and only treat the gesture as a drag once
  the pointer has travelled >4px; a press that goes nowhere must leave the board untouched and
  make no slide sound. Children tap objects constantly — to hear them, to point at them.
  Gate three things on it, not one: the object must not move until the threshold is crossed,
  the pick-up sound belongs at the crossing rather than at `pointerdown`, and `pointerup`
  below the threshold must return without touching item state at all. Addition and Magnets
  only ever gated the sound, so a tap there still nudges the board.
- `handlePointerUp`, design mode: snap to grid and persist via `onUpdateQuestionConfig`:

```ts
onUpdateQuestionConfig({
  customPositions: updated.map(i => ({ id: i.id, x: i.x, y: i.y })),
  layoutReference: { width: stage.clientWidth, height: stage.clientHeight }
});
```

`layoutReference` is what makes saved positions survive a different screen — they are scaled
by `stage / reference` on load. Custom positions are ignored on a narrow stage in play mode.

---

## 6b. Motion — `objectMotion.ts`

`objectStyle({ x, y, size, dragging, z })` is the inline style every draggable object uses.

- **Position with the `translate` property, never `left`/`top`.** `left`/`top` can only be
  satisfied by running layout again — every pointer move, for every object on the stage — which
  is what made dragging feel heavy. `translate` stays on the compositor. It is deliberately not
  `transform`: the objects also carry Tailwind `scale-*` and the `dropPop` keyframes, which own
  `transform`, and the two compose only on separate properties.
- **Take the stage box once per drag** (`stageBox` ref, set in `pointerdown`). Calling
  `getBoundingClientRect()` inside `pointermove` forces a synchronous reflow every frame.
- One settle duration and easing for everything (`OBJECT_SETTLE`); a dragged object gets
  `transition: none` and `willChange: translate`.

Tests that assert object positions must read `style.translate`, not `style.left`.

---

## 7. Header, footer, feedback

```tsx
<SharedCanvasLayout
  isPlayMode isDark showGrid gridSize={GRID_STEP}
  showRulers={question.config.showLayoutRulers ?? true}
  accent={accent}                        // FRAME_ACCENTS[config.frameColor] — indigo default
  headerIcon={…} headerTitle="Move & Count"
  headerSubtitle={/* live progress, or "…enter the total answer below" */}
  readAloudText={…}
  designerHint="Drag objects freely. Grid snapping is applied when you release."
  headerActions={isPlayMode
    ? <CanvasChip accent={solved ? "emerald" : accent}>{solved ? "All counted" : `${remaining} to move`}</CanvasChip>
    : <Button variant="outline" size="xs" onClick={reset}><RotateCcw size={12} />Reset</Button>}
  footerStatus={solved ? "All 12 moved and counted!" : isPlayMode ? undefined : "Design Mode · …"}
  footerSolved={solved}
/>
```

- `SharedCanvasLayout` draws the grid and rulers. Delete any local grid `<svg>`.
- Design mode gets exactly one action: **Reset**. Not "Auto Layout" plus "Reset" — with
  flowed bins they are the same button.
- Idle help is `GhostGuideOverlay` + `useGhostGuide({ isPlayMode, isSolved, idleThresholdMs: 10000 })`,
  placed inside the destination bin.
- Colours: accents from `canvasTheme` only (`accentChipClass`, `accentTextClass`, `surfaceClass`,
  `emptySlotClass`, `captionClass`). **No amber or yellow** anywhere in canvas UI.

---

## 8. The answer panel

**One implementation: `CanvasAnswerPanel.tsx`.** Never hand-roll this again — it was copied
into ten canvases and drifted in all of them.

```tsx
const answer = useCanvasAnswer({
  expected: count,
  resetKey: `${question.id}:${count}`,     // a new question clears a stale "correct"
  wrongMessage: `Not quite! You moved ${count} ${obj.label}s. Enter ${count}!`,
  onSuccess,
  open: answerPanelOpen                    // isPlayMode && requireAnswerInput && isComplete
});

<CanvasAnswerPanel
  answer={answer} open={answerPanelOpen} isDark={isDark}
  dock="left"
  prompt={`How many ${obj.label}s did you move in total?`}
/>
```

The split is deliberate: `useCanvasAnswer` is the state machine (typing, checking, the
success hand-off, reset), `CanvasAnswerPanel` is the chrome. A canvas supplies only what is
genuinely its own — the expected number, the wording, where it docks.

- It takes **plain props, not `question.config`**. Where the settings come from — a teacher's
  panel today, a prebuilt template later — is the host's business.
- `dock` is `"bottom"` (most), `"top"` (Addition), or `"left"` — over the bin the objects just
  left, never over the objects being counted. The question is "how many in total", so the
  evidence has to stay visible. Positioning lives on the panel's own wrapper `div`; the panel
  animates with a spring transform and a centring `mx-auto` on the same element fights it.
  Multiplication, One-to-One and Line Up each got this wrong before the extraction.
- `onHeightChange` reports the measured height, for canvases that shrink their play area to
  make room (One-to-One, Line Up). It grows by about half again when the pad opens.
- `solvedForGuide` reads `answer.solved`, and the canvas's own success effect handles only
  the `!requireAnswerInput` case — the panel owns the hand-off when an answer is required.
- The pad here is the 5-column counting one (digits 1–9, 0, then Backspace / Clear), and it
  is **open by default**. On a tablet it is the way in, not an accessory: a child who has to
  find the calculator button first is a child typing on the OS keyboard over the activity.
  While it is up the input asks for `inputMode="none"`, so the OS keyboard stays out of the
  way of the keys it duplicates. A canvas with no room passes `numberPadDefault: false` to the
  hook; the toggle still brings the pad back, and a new question restores the default.
  `NumberPad.tsx` is a different pad for a different job: digits into a column-arithmetic grid.
- **The panel has no accent prop.** It wears the brand primary — trim, focus ring, pad toggle
  and Check button — the same as every other card that floats over an activity. It briefly
  took the canvas's own accent, which meant the Check button changed colour between two slides
  of one lesson and competed with the primary button waiting underneath it. Colour that varies
  here means *state*: rose for wrong, emerald for right, and nothing else.
- `placeholder` defaults to `"Total…"`; override it where the activity asks for something
  else ("Sum…", "Product…", "Remaining…").
- The input and every button come from the shared kit (`components/ui`'s `Input` and
  `Button`), so the panel inherits the app's control sizing, focus rings and disabled states
  rather than restating them. An idle Check is just `<Button>` with no colour override at
  all — the default variant already *is* the primary.
- The card surface comes from `theme/surfaces.ts`, shared with the lesson success card, the
  saving curtain and the placement finish screen. Borders on all of them are 2px: a hairline
  disappears on a high-DPI tablet.
- **Colour comes from the `isDark` prop, never from Tailwind's `dark:` variant.** `index.css`
  scopes that variant to an explicit `.dark` ancestor and `GameLauncher` never mounts one, so
  `dark:` classes inside a canvas silently do nothing — which is how this panel used to render
  light-on-light in dark mode. Same rule for any new canvas chrome.
- Behaviour is locked by `CanvasAnswerPanel.test.tsx`. Extend those, not a per-canvas copy.

Every canvas that asks for a typed answer is on it — Count, Addition, Arrangements, CountBack,
CountOn, GroupTens and Multiplication. Nothing hand-rolls this any more; keep it that way.

---

## 10. The Count engine and its stagings

Nine components taught *count these objects* and differed in one thing: what counting
physically is. They are now **one engine plus a staging per way of counting**.

- `CountCanvas.tsx` — the engine. Stage measurement, item state, ranking, drag, tap, keyboard,
  badges, sounds, CPA, ghost guide, answer panel, resize.
- `countStaging/` — one file per staging: `move`, `tap`, `lineup`, `container`, `tens`,
  `counton`, `countback`, `arrangements`. Each owns `zones`, `layout`, `resolve`, `isComplete`,
  and nothing else.

**The rule that keeps it honest: if a change needs `if (staging.id === …)` in the engine, it
belongs in the staging.** Capabilities are declared, not sniffed — `movesOnCount`,
`ordersByPlacement`, `orientation`, `objectCount()`, `seedCounted()`, optional `slots()` and
`Decoration`.

Two of those exist only because Count On does not start at one:

- `objectCount(config, targetCount)` — the board is `baseCount + extraCount`, and these slides
  carry no `targetCount` at all, so the engine cannot derive it from the question.
- `seedCounted(config, count)` — the first *n* objects begin counted and ranked. They are the
  group the child counts *on* from, so the engine seeds them, `reset` returns to them rather
  than to an empty board, and a new question rebuilds them.

Both default to the plain behaviour, so the other four stagings never mention them.

Two invariants the engine owns for every staging, because both were bugs before:

- **Re-ranking is the engine's.** A staging never assigns a count order. Numbering an arrival
  `counted.length + 1` assumes contiguity; pull the 2nd of three out and the next drop collides
  with the object already badged 3. The exception is declared, not improvised: `ordersByPlacement`
  says the staging owns the ordinal (Line Up, where the slot *is* the number).
- **A tap is not a drag.** Threshold, sound and state change are all gated in one place.

**Teacher-authored positions are the engine's, not a staging's.** Design mode writes
`config.customPositions` + `layoutReference` on every drag, and the engine replays them over
whatever the staging arranged, rescaled from the stage they were authored on. A stacked stage in
play mode ignores them: a layout composed across a wide board does not fold onto a phone. Between
the nine-into-one merge and the Arrangements merge nothing read them back, so authored layouts
were saved and silently discarded — locked now by tests in `CountCanvas.test.tsx`.

Adding a staging is a file plus a ladder row in `countLevels.ts`, plus one line in
`ABSORBED_TECHNIQUES` if it is replacing a published technique. Never an engine edit — the two
capabilities above are the only ones added since the first four, and both are declared with
defaults rather than branched on.

`tens` did **not** need the "ten ones become one ten" model this section used to say it was
waiting for. A ten-frame cell already *is* a numbered place, so grouping is `ordersByPlacement`
— the same decision Line Up makes — and the tens are expressed by where the cells sit.

`arrangements` needed **no contract change at all** — the first merge where that was true of a
non-trivial staging. It is `tap`'s act and `tap`'s `oneToOneLayout` placement, plus an arena
`home` zone named for the arrangement and a number-track `readout`. It stayed a separate staging
rather than a setting on `tap` because giving `tap` an arena would change how published
`ONE_TO_ONE` questions look; same act, different lesson — One to One teaches "one number per
object", Arrangements teaches "moving them does not change how many".

### Motion

One rule: **movement means something, and the same movement always means the same thing.**

- **Settle is a real spring**, not an ease that resembles one. `objectMotion.ts` samples a
  damped harmonic oscillator (unit mass, stiffness 380, damping 26 → ζ ≈ 0.67) into a CSS
  `linear()` easing: 6% overshoot, ~308ms. An object a child let go of has been *put down*, and
  what reads as putting something down is mass. It stays a CSS transition on `translate` so a
  board of twenty objects costs one compositor pass, not twenty JS springs.
- **A refusal is not a no-op.** `resolve` returns an object, `"refused"`, or `null`. `null` is
  "nothing happened" — tapping an already-counted object, which is a child checking their own
  work, and shaking at them for it would be telling them off. `"refused"` is a rule being
  broken — a taken slot, a place out of turn, the wrong object — and the engine shakes it and
  plays the failure sound. Both used to be `null`, so "no" and "nothing" looked identical.
- **An accepted count lands** (`animate-drop-pop`), so the eye is drawn to what changed.
- **Readouts fade and pop, they do not spring.** A number appearing is information, not an
  object with mass; bouncing Count Back's countdown would fight the thing being read.
- **`prefers-reduced-motion` keeps the travel and drops the overshoot.** An object that
  teleports between two places is *harder* to follow, which is the opposite of what the setting
  is for — so the settle becomes a short ease and the shake becomes a hold.

Regenerate the spring from the constants in `objectMotion.ts` rather than hand-tuning the
`linear()` stops; the physical parameters are the source, the samples are the output.

### Count Back, and the three numbers it separated

Count Back was held out at first, on the grounds that every staging counts *toward* `count` and
the engine leaned on that in six places. Folding it in meant admitting that "how many objects",
"how many acts finish it" and "what the answer is" were three different numbers the engine had
been treating as one — true of Count Back obviously, and quietly true of Count On already.

So the engine now names all three, and each defaults to the old behaviour:

| | means | default |
|---|---|---|
| `count` | objects on the board | `targetCount`, or `objectCount()` |
| `goal` | acts that finish it | `count` |
| `expected` | what the answer panel checks | `count` |

For Count Back those are 8, 3 and 5. For every other staging they are the same number, which is
why none of them mention `goal` or `expectedAnswer`.

Three smaller capabilities came with it, all defaulted, none branched on:

- `copy` — what a staging calls what the child is doing. The engine said "counted" in five
  places; that is right for six stagings and wrong for the one that crosses out. Spread over
  `COUNTING_COPY`, so a staging overrides only the lines that would otherwise lie about it.
- `countedAppearance: "struck"` — a crossed-out object is struck through and dimmed, and wears
  no number, because it is not the seventh of anything.
- `emphasise()` — names the object to act on next. Counting back is a sequence: the last one
  goes first. A board that accepts any tap teaches the opposite of the skill, and one that
  silently refuses the wrong tap teaches nothing, so the engine rings the one that is next.

And one new zone role: **`readout`**. A band that reports the activity back and never holds an
object — Count Back's countdown, "8 → 7 → 6", the numbers being said out loud. It wears the same
`CanvasBin` chrome as every other zone, draws its own `Content`, and is excluded from the drop
test entirely, so a release over it is a release over nothing.

---

## 9. Porting checklist

- [ ] `SharedCanvasLayout` with header chip / Reset, footer status, `showGrid` + rulers delegated
- [ ] Local grid `<svg>`, hand-rolled bin chrome, and hardcoded object sizes deleted
- [ ] Bins are `CanvasBin`, flowed by flexbox, with `active` / `complete` / `isEmpty` wired
- [ ] Teacher-draggable containers removed (`containerPositions`, `*Dimensions`, move/resize handles)
- [ ] Sizes from `binSizeForStage` + `fitObjectSize`; placement from `contentZone` + `slotPosition`
- [ ] `dimensions` starts `null`; `useLayoutEffect` seed + `ResizeObserver`
- [ ] `laidOutAt` handles placed / flipped / resized
- [ ] Pointer capture on the stage; released in up **and** cancel
- [ ] Design mode persists `customPositions` + `layoutReference`
- [ ] Answer panel docked over the emptied bin, number pad included
- [ ] `GhostGuideOverlay` after 10s idle
- [ ] `npx tsc --noEmit` clean, `npx vitest run` clean
