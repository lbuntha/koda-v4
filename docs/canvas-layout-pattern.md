# Canvas layout pattern — "the Move & Count design"

**The reference implementation is `frontend/src/components/canvases/MoveAndCountCanvas.tsx`.**
When the ask is *"make canvas X look/behave like Move & Count"*, this file is the spec.
Read it, then read the reference canvas, then port.

Already on the pattern: `MoveAndCountCanvas`, `LineUpCanvas`, `GroupTensCanvas`, `CountOnCanvas`,
`CountBackCanvas`, `ArrangementsCanvas`, `MagnetsCanvas`, `SubitizeCanvas`, `AdditionCanvas`,
`SubtractionCanvas`, `FlexibleCanvas`.

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

**A canvas with no second bin still gets one.** Count Back has nothing to drag between bins,
so it is one bin for the set plus a short band for the countdown readout — same chrome, same
tally, same `complete` state. The rule is not "two bins"; it is "every region a child looks at
is a `CanvasBin`".

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
- **Re-flow the whole source bin on release, never just the object that was let go.** Placing
  the released object alone — at `others still loose + 1`, the end of the queue — drops it on
  top of whichever sibling already sits there. Where the activity is ordinal (Count On: only
  the front object may move) it also leaves a *locked* object at the head of the queue, and a
  child reads that as the object refusing to be dragged. Map over the bin and re-rank:

  ```ts
  let rank = 0;
  return settled.map(d => (d.placed ? d : { ...d, ...trayPos(++rank) }));
  ```
- Fallback zone when a ref has not measured yet — never lay out against a guessed stage.
  `dimensions` starts `null` and nothing is placed until a real `ResizeObserver` measurement
  lands (seeded in `useLayoutEffect`, before paint).

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

When `config.requireAnswerInput` (default true) and the activity is complete:

- Dock it **over the bin the objects just left** — never over the objects being counted.
  The question is "how many in total", so the evidence has to stay visible.
- Positioning lives on a wrapper `div`; the panel itself animates with transforms, which
  would fight a centring transform.
- `pointer-events-none` on the wrapper, `pointer-events-auto` on the panel.
- Contents, in order: 🎉 + question, input + **Check** + calculator toggle, error banner,
  collapsible 5-column number pad (digits 1–9, 0, then Backspace / Clear).
- Border colour carries the state: red `#ef4444` error, emerald `#10b981` correct, else the
  neutral slate hairline. Correct → `sounds.playSuccess()` then `onSuccess()` after 500ms.
- Autofocus the input ~350ms after completion.

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
