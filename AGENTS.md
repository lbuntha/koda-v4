# Agent Instructions & Project Architecture

Welcome to the **Counting Skills Studio** codebase. This guide details the project structure, design guidelines, and patterns to follow when adding new features, modifying UI, or creating new interactive counting templates.

---

## 📂 Project Structure

Here is the directory structure and the responsibility of each layer:

```text
/
├── metadata.json           # Application name, description, and frame capabilities
├── package.json            # Script targets, vite config, and core dependencies
├── src/
│   ├── main.tsx            # React application mounting point
│   ├── index.css           # Tailwind CSS imports & global CSS variables/themes
│   ├── App.tsx             # Primary layout, sidebars, active slide selection, and layout router
│   ├── types.ts            # Global math question, slide item, and app state definitions
│   ├── templates.ts        # Built-in math slide templates (e.g., Subitizing, Grouping Tens)
│   ├── sound.ts            # Synthesizer audio engine (Sine wave oscillators, ticks, pop noises)
│   ├── lib/
│   │   └── utils.ts        # Dynamic class name merger (cn helper)
│   ├── techniques/         # ONE manifest file per game (single source of truth).
│   │                       #   index.ts -> ALL_TECHNIQUES; the canvas/panel/schema/picker
│   │                       #   registries + GameLauncher are all derived from these.
│   └── components/
│       ├── LazyBoundary.tsx      # <Suspense> wrapper for lazily-loaded canvases & panels
│       ├── HowToAddGameModal.tsx # In-app "How to add a new game" guide (sidebar button)
│       ├── ui/             # Reusable Atomic UI Component Kit
│       │   ├── Button.tsx
│       │   ├── Card.tsx
│       │   ├── Input.tsx
│       │   ├── Label.tsx
│       │   ├── Textarea.tsx
│       │   ├── Select.tsx
│       │   ├── Tabs.tsx
│       │   ├── Badge.tsx
│       │   ├── Dialog.tsx
│       │   └── index.ts      # Barrel exports for clean visual studio styling
│       └── canvases/       # Individual interactive early math counting technique implementations
│           ├── types.ts           # Inter-canvas type specifications & item coordinates
│           ├── OneToOneCanvas.tsx # Touch / Click object-by-object counting
│           ├── SubitizeCanvas.tsx # Visual grouping / instant perception counting
│           ├── LineUpCanvas.tsx   # Ordering and arranging scattered items in standard lines
│           ├── ArrangementsCanvas.tsx # Layout grids, arrays, circles, and 10-frames
│           ├── MoveAndCountCanvas.tsx # Drag from Source container to Target container
│           ├── MagnetsCanvas.tsx  # Interactive magnet board snaps & counts
│           ├── GroupTensCanvas.tsx # Aggregating 10 individual items into 1 consolidated Ten-stick
│           ├── CountOnCanvas.tsx  # Counting forwards starting from a non-zero given number
│           └── CountBackCanvas.tsx # Counting backwards item-by-item down to zero
```

---

## 🎨 Shared UI Library

All studio panels, controls, property sheets, and layouts **MUST** consume the atomic styling kits in `/src/components/ui/`. **Do NOT** write raw unstyled divs or custom border styling unless inside the interactive sandbox canvas itself.

### UI Library Manifest:
*   **`<Button>`**: Supported variants: `"default"`, `"secondary"`, `"outline"`, `"ghost"`, `"destructive"`, `"link"`.
*   **`<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>`, `<CardFooter>`**: Base container blocks with high visual polish, subtle drop-shadows, and elegant borders.
*   **`<Input>`**: Full-width stylish input fields for single lines.
*   **`<Label>`**: Monospace, high-contrast, uppercase tiny tags for form fields.
*   **`<Textarea>`**: Multiline input fields for instruction overrides.
*   **`<Select>`**: Consistent drop-down inputs with standard arrow overrides.
*   **`<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>`**: Component state toggles, perfect for Property Studio views.
*   **`<Badge>`**: Tech-forward labels using standard variants (`default`, `secondary`, `success`, `warning`, `destructive`, `outline`).
*   **`<Dialog>`**: Accessible overlay modal popups for student gameplay success states.

### 🧪 Import Pattern
```tsx
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Input,
  Label,
  Select,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "./components/ui";
```

---

## 🧮 Interactive Counting Canvases

Counting exercises are represented by individual React canvas components inside `/src/components/canvases/`. 

### State Management & Props Flow
Every counting canvas expects the same standardized interface:
```tsx
export interface CanvasProps {
  question: MathQuestion;      // Active slide model parameters (target count, instruction, technique)
  isPlayMode: boolean;        // True: Interactive student mode; False: Preview/Designer mode
  onAnswerStateChange: (isCorrect: boolean) => void; // Dispatches up to parent if answer conditions are met
}
```

### Adding a New Counting Technique (Game)

Every game is registered in **one manifest file** under `/src/techniques/`. The canvas
map (`CANVAS_BY_TECHNIQUE`), panel map (`TECHNIQUE_PANELS`), AI schema list
(`SCHEMA_REGISTRY`), picker options (`TECHNIQUE_OPTIONS`), and the gameplay launcher
(`GameLauncher`) are all **derived** from these manifests — so you never edit `App.tsx`
or any registry. This same guide is available in-app via the **"How to Add a Game"** button
in the Instructor sidebar (`src/components/HowToAddGameModal.tsx`).

1.  **Build the three parts** (the real work):
    *   `/src/components/canvases/MyGameCanvas.tsx` — implements `CanvasProps`. Wire standard
        sound triggers from `/src/sound.ts` (`sounds.playTick()`, `sounds.playSuccess()`, …).
    *   `/src/components/studio/panels/MyGamePanel.tsx` — implements `PanelProps`.
    *   `/src/components/studio/ai-generator/schemas/myGame.schema.ts`.
2.  **Name it:** add one value to the `CountingTechnique` enum in `/src/types.ts`.
3.  **Write one manifest** — copy `/src/techniques/subitize.tsx` to
    `/src/techniques/myGame.tsx` and fill it in. Canvas and panel are `React.lazy(...)` so each
    game ships as its own bundle chunk (loaded only when opened):
    ```tsx
    export const myGame = defineTechnique({
      technique: CountingTechnique.MY_GAME,
      label: "17. My Game",
      icon: <Star size={14} className="text-amber-500" />,
      defaultTargetCount: 5,
      component: React.lazy(() =>
        import("../components/canvases/MyGameCanvas").then((m) => ({ default: m.MyGameCanvas }))),
      panel: React.lazy(() =>
        import("../components/studio/panels/MyGamePanel").then((m) => ({ default: m.MyGamePanel }))),
      schema: myGameSchema,
    });
    ```
4.  **Register it — one line:** import it in `/src/techniques/index.ts` and add it to the
    `ALL_TECHNIQUES` array in picker order. This is the only shared line you touch; two
    developers can add games in parallel without merge conflicts.
5.  **Verify:** `npx tsc --noEmit && npm run build`. `assertComplete()` throws at app-load in
    dev if a technique has no manifest, so a half-wired game can't slip through.

> Lazy canvases/panels render inside `<LazyBoundary>` (`src/components/LazyBoundary.tsx`) at
> every render site. If you add a brand-new place that renders a canvas or panel from the
> registries, wrap it in `<LazyBoundary>` too.

---

## 🔊 Sound System (`/src/sound.ts`)

The app includes a fully offline, high-fidelity synthesizer engine that generates rich early-childhood feedback sound effects using standard Web Audio API oscillators and gain envelopes.

Available Methods:
*   `sounds.playPop()`: High-frequency playful selection click.
*   `sounds.playTick()`: Medium frequency chime for item count increments.
*   `sounds.playTock()`: Low frequency chime for item count decrements.
*   `sounds.playWin()`: Ascending arpeggio sequence indicating total completion success.
*   `sounds.playFail()`: Descending double tone signaling incorrect submissions.
*   `sounds.playLevelUp()`: Multi-tone celebration chord when student clears worksheets.
*   `sounds.toggleMute()`: Thread-safe volume inhibitor.

---

## 🛡️ Mandatory Developer Rules

1.  **Strict Semantic Integrity**: Keep visual and editorial components human-centered. Avoid placing pseudo-technical diagnostic data, simulated container port names, logging tickers, or network indicators in outer margins.
2.  **No Direct CSS Styles**: Styling **MUST** be applied strictly via Tailwind CSS classes, backed by standard utility rules.
3.  **Use Atomic UI Elements**: Never duplicate button styling or container structures manually. Leverage the existing `/src/components/ui/` library components directly.
4.  **No Infinite Hooks**: Never introduce raw objects, functions, or arrays into dependency arrays in `useEffect` or `useMemo` hooks without stabilization. Use primitives, or stabilize with `useCallback`/`useMemo` wrapper routines.
5.  **Compile & Lint Verification**: Always execute `npm run lint` or `tsc --noEmit` locally, or request the applet build tool compilation before finishing turn work. Ensure 100% type safety.

---

## 🚀 Copy-Paste Blueprint for Adding & Scaling Counting Canvases

Use the following highly structured prompt template when asking an AI assistant (or subagent) to build, scale, or refactor a visual early math canvas.

### 📋 Prompt Template
Copy the text block below, replace the bracketed placeholders (like `[TECHNIQUE_NAME]`), and send it directly to the AI to grow a feature cleanly:

```text
Please build and integrate a new visual early math counting canvas named "[TECHNIQUE_NAME]Canvas" into Koda v4. You MUST follow the Move & Count Dual-Stage Container Standard, CPA (Concrete-Pictorial-Abstract) pedagogical framework, and Clean UI rules:

1. DUAL-STAGE ARCHITECTURAL SHELL (Clean UI, No Complexity):
   - Every canvas MUST use the standard 3-Section Vertical Flex Shell:
     * Outer Wrapper: `relative w-full h-full min-h-[320px] bg-transparent border-0 rounded-3xl p-3 flex flex-col justify-between overflow-hidden touch-none select-none gap-2 font-sans transition-colors duration-300`
     * Section 1 (Top Formula & Title Banner): `w-full flex justify-between items-center border-2 px-4 py-3 rounded-[1.8rem] shadow-sm z-10 mt-1 gap-2 flex-shrink-0 transition-colors duration-300 backdrop-blur-sm ${isDark ? "bg-slate-900/70 border-emerald-500/40 text-emerald-200" : "bg-white/85 border-emerald-300/80 text-emerald-950"}` with a `Sparkles` pill badge, abstract formula (`rows × cols = target` or `3 + 2 = 5`), and status pill badge.
     * Section 2 (Center Stage Arena Box): `flex-1 w-full rounded-[2.4rem] border-2 md:border-4 shadow-lg flex flex-col items-center justify-center gap-4 my-1 p-4 z-0 transition-all duration-300 backdrop-blur-sm relative overflow-hidden ${isDark ? "bg-slate-900/60 border-emerald-500/40 shadow-black/40" : "bg-emerald-50/70 border-emerald-300/80 shadow-md"}` where visual playground assets, trays, ten-frames, or grids live.
     * Section 3 (Helper Footer Text): `w-full text-center py-2 px-4 rounded-2xl border text-xs font-bold font-mono tracking-tight z-10 mb-1 mt-auto transition-colors duration-300 ${isDark ? "bg-slate-800/80 border-slate-700 text-slate-400" : "bg-white/80 border-slate-200/80 text-slate-600"}` showing real-time feedback (`Spot on! ...` when solved or instructions during play).

2. CPA (CONCRETE-PICTORIAL-ABSTRACT) & DARK MODE (`isDark`) RULES:
   - Always destructure `isDark = false` from props (`CanvasProps`). Use rich slate dark colors (`bg-slate-900/70 text-slate-100 border-indigo-500/40`) vs light pastel mode (`bg-white/85 text-slate-800 border-indigo-300/80`).
   - Concrete: Touchable/draggable physical emojis (`CountingAsset`) with hover scaling (`hover:scale-105`) and active grab shadows (`active:cursor-grabbing scale-125 z-50`).
   - Pictorial: Structured containers (trays, baskets, grid arrays, jars) with dashed drop-zone outlines (`border-dashed border-2`).
   - Abstract: Clear monospace formulas in the Top Banner (`font-mono font-black text-base`) and floating ordinal number tags (`1, 2, 3...`) right over concrete items when counted or snapped (`item.snappedSlotIndex + 1`).

3. INTERACTIVE POINTER MECHANICS & STRICT MODES:
   - Attach `onPointerMove`, `onPointerUp`, and `onPointerCancel` on the outer wrapper `<div>`.
   - Use container `setPointerCapture(e.pointerId)` on drag start and `releasePointerCapture(e.pointerId)` on release/cancel.
   - Play Mode (`isPlayMode = true`): Evaluate game snapping/counting, trigger `sounds.playPop()` on pickup, `sounds.playTick(order)` on placement/step, `sounds.playSlide()` on removal, and `sounds.playSuccess()` + `onSuccess()` when solved.
   - Design Mode (`isPlayMode = false`): Show floating `Design Mode + Reset Layout` pill banner, enable free positioning anywhere (`customPositions`), show grid overlay if `showGrid = true`, and persist layout changes via `onUpdateQuestionConfig({ customPositions: [...] })`.

4. INTEGRATION & REGISTRATION:
   - Register in `src/types.ts` (`CountingTechnique` enum), `src/components/Canvases.tsx`, and `src/App.tsx`.
   - Verify zero TypeScript or build errors (`npx tsc --noEmit && npm run build`).
```
