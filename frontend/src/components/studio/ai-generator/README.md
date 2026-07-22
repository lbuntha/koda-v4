# AI Activity Generator

Teacher types a natural-language prompt → the generator produces ready-to-play
slide configs, either via OpenAI or a rule-based offline fallback.

## Status: all 15 components covered

Every `CountingTechnique` has a schema in `schemas/`. Adding a 16th canvas
someday follows the same recipe below — nothing else in this module changes.

## Architecture

```
AiGeneratorPanel  ── technique-agnostic UI (never edit per component)
openaiService     ── API call, key/model storage, JSON handling
config            ── endpoint, model, storage keys (single source of truth)
schemas/
  types.ts        ── ComponentSchema contract
  assets.ts        ── shared asset catalogue + helpers (resolveAssetType, clampInt, resolveFrameColor, ...)
  registry.ts      ── SCHEMA_REGISTRY + prompt detection + prompt builder
  *.schema.ts      ── ONE file per canvas: everything the AI knows about it
presets.ts        ── Move & Count preset chips, referenced by its schema (not by UI)
promptParser.ts   ── Move & Count offline fallback, wired via its schema
```

The schema is the single source of truth per component. The panel, service and
prompt builder never contain component-specific code. Preset chips shown in
the UI are pulled from `schema.presets`, biased toward whichever component
the teacher currently has open (see `AiGeneratorPanel`'s `contextPresets`).

## Adding a new component (the replication recipe)

1. Copy the closest existing schema (`moveAndCount.schema.ts` for a
   drag-and-drop canvas, `kodaSudoku.schema.ts` if your canvas has structured
   layout/grid content) → `schemas/yourCanvas.schema.ts`.
2. Fill in:
   - `promptSummary` — 1–2 lines, written for the model
   - `configFields` — mark derivable/teacher-only fields `exposeToAI: false`
     (validate() must fill everything the AI omits); give exposed fields a
     short `promptHint`. For the two fields nearly every schema needs, use
     the shared builders instead of hand-writing the block:
     ```ts
     import { assetTypeField, frameColorField, hiddenToggleField } from "./assets";
     configFields: [
       assetTypeField("apple"),        // hidden — validate() derives it from objectId
       frameColorField("indigo"),      // AI-exposed with the standard theme hint
       hiddenToggleField("showItemFrame", "Show Item Frame", true, "Teacher-facing display toggle."),
       // ...component-specific fields
     ]
     ```
     Also import `ALL_ASSETS`, `resolveAssetType`, `resolveFrameColor`,
     `clampInt` from `./assets` for use inside `validate()` — don't
     re-derive the asset list per schema.
   - `triggerKeywords` — how a teacher's prompt selects this component. Avoid
     single common words ("more", "put", "and") — they win on tie-break
     length against nothing and steal routing from other schemas. See the
     Count On vs. Addition incident below. **Run `auditRegistry()`** (see
     below) after adding keywords — it flags both this failure mode and
     exact duplicates against other schemas automatically.
   - `presets` — 3–4 chips for the UI
   - `validate()` — clamp numbers, whitelist enums, default every field.
     **Must survive `{config: {}}` and outright garbage** — `auditRegistry()`
     checks the empty case on every load in dev; test garbage manually once.
   - `offlineFallback` — optional; omit if there is no rule-based parser
     (most schemas have none; that's fine, they require an API key)
3. Register it in `schemas/registry.ts` → `SCHEMA_REGISTRY`.

That's all — the panel, prompts, and validation pick it up automatically.

## Registry self-check (`auditRegistry()`)

Runs automatically in dev — open the browser console after `npm run dev` and
look for a collapsed `[ai-generator] registry audit` group (only appears if
there's something to report). It checks, across the whole registry:

- duplicate `technique` registration
- a schema with zero presets
- `validate({config: {}})` throwing or returning an incomplete slide
- a trigger keyword reused verbatim across two schemas, or one that's short
  and generic enough to likely win routing ties it shouldn't

Call `auditRegistry()` directly (from `schemas/index.ts`) if you want the
`RegistryIssue[]` list outside the console, e.g. in a CI check.

This is the permanent form of the manual verification every schema here was
tested with before shipping — see "Testing a schema before shipping it" below
for what it doesn't catch (routing *coverage*, structural invariants like a
valid sudoku grid) and still needs a one-off script for.

## Design rule: never ask the model to solve a layout/constraint problem

Two schemas need actual *structure*, not just labels — Sudoku (a valid 4×4
Latin square respecting 2×2 boxes) and Flexible Canvas dragmatch (item/bin
pixel positions). Asking the LLM to produce that structure directly is where
these features would silently break: an unsolvable sudoku, or bins that
overlap or sit off-canvas, are exactly the kind of mistake a model makes
under token pressure and doesn't self-correct.

The fix in both schemas: the AI supplies only **content** (theme emoji,
difficulty, item/bin labels); `validate()` builds the actual structure
deterministically —

- `kodaSudoku.schema.ts` ships one hardcoded, verified-valid 4×4 solution
  as symbol *indices*; relabeling indices→emoji for any 4 distinct symbols
  preserves validity for free, and a fixed clue-removal mask per difficulty
  guarantees every generated puzzle is solvable.
- `flexibleCanvas.schema.ts` lays out items in a grid and bins evenly along
  the bottom of the fixed `STAGE_W × STAGE_H` design grid; the AI's free-text
  bin name is matched to a real bin case-insensitively, falling back to a
  bin that actually exists rather than a dangling id.

If your new component has similar structural content (a maze, a number
line with fixed positions, anything with an "only some arrangements are
valid" property), follow this pattern rather than asking the model for pixels
or exact structure.

If a field needs to carry a small array/object instead of a primitive, use
`type: "json"` with a `jsonShape` example string (see `flexibleCanvas.schema.ts`'s
`items`/`bins` fields) — added specifically to support this.

## Token discipline (please keep it this way)

- Fields appear ONCE in the prompt (values + hint inline), never re-described.
- Anything `validate()` can derive or default is `exposeToAI: false`.
- No JSON examples in prompts — `response_format: json_object` guarantees shape.
- `max_tokens` scales with slide count (`openaiService`).
- Prompts are deterministic per schema, so provider-side caching applies.
- Never put layout/coordinates in the prompt — see the design rule above.

All 15 schemas currently sit between ~190 and ~335 tokens. Treat >350 as a
review flag (only Flexible Canvas is close, because it supports 4 modes).

## Testing a schema before shipping it

`auditRegistry()` (above) runs on every dev load and catches structural
registry mistakes automatically. It does NOT catch prompt-routing coverage or
component-specific invariants, so run a throwaway script for those when you
add or touch a schema — every schema currently in the registry was verified
this way:

1. **Prompt routing coverage** — one clear prompt per schema, confirmed each
   lands on its *intended* schema. `auditRegistry()` only flags keyword
   collisions it can see statically; it can't simulate a real prompt.
2. **`validate(garbage)`** — wrong types, out-of-range numbers, unknown enum
   values, fake asset ids. `auditRegistry()` only tests `{config: {}}`.
3. For structural schemas (Sudoku, Flexible dragmatch): validate the actual
   invariant (every row/col/box has 4 distinct symbols; every `targetBin`
   references a bin that exists; every bin sits inside the stage bounds).

(No permanent test file yet — ask if you want this wired into `npm test`.)

## Security note

`DIRECT_MODE: true` sends the teacher's API key from the browser. Before any
multi-user deployment, stand up a backend proxy and set `DIRECT_MODE: false`
(the request shape is documented in `openaiService.ts`).
