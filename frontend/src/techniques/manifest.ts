/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TechniqueManifest — the single source of truth for one counting game.
 *
 * Each game (technique) is described in ONE file under src/techniques/. Shared
 * learner-thumbnail defaults live in `shared/technique-thumbnails.json` so release
 * publishing and the frontend cannot drift. The
 * four registries the app used to hand-maintain separately are now DERIVED
 * from these manifests, so adding a game means adding one file, never editing
 * a shared list:
 *   - canvasRegistry.ts      (CANVAS_BY_TECHNIQUE)  -> m.component
 *   - panels/index.ts        (TECHNIQUE_PANELS)     -> m.panel
 *   - schemas/registry.ts    (SCHEMA_REGISTRY)      -> m.schema
 *   - techniqueOptions.tsx   (TECHNIQUE_OPTIONS)    -> m.label / m.icon
 *   - GameLauncher.tsx        (its render switch)    -> m.component
 */

import React from "react";
import { CountingTechnique } from "../types";
import { CanvasProps } from "../components/canvases/types";
import { PanelProps } from "../components/studio/panelKit";
import { ComponentSchema } from "../components/studio/ai-generator/schemas/types";
import techniqueThumbnails from "../../../shared/technique-thumbnails.json";

/**
 * Shared learner artwork, keyed by technique. Exported because a technique can outlive its
 * manifest — a retired or absorbed id still has released questions whose cards need a picture,
 * and those look artwork up here rather than through `ALL_TECHNIQUES`.
 */
export const DEFAULT_THUMBNAILS = techniqueThumbnails as Partial<Record<CountingTechnique, string>>;

export interface TechniqueManifest {
  /** Enum value that identifies this game everywhere. */
  technique: CountingTechnique;

  /** Studio picker label, e.g. "9. Subitize Flash". */
  label: string;

  /** lucide icon element shown next to the label in the picker. */
  icon: React.ReactElement<{ className?: string }>;

  /** Target count a teacher gets when first selecting this game. */
  defaultTargetCount: number;

  /** Static learner-facing fallback supplied by the shared presentation catalog. */
  defaultThumbnailUrl?: string;

  /**
   * The interactive canvas. Typed as ComponentType (not FC) so a future
   * switch to React.lazy(...) for per-game code-splitting is a drop-in change
   * here — no consumer edits — once Suspense boundaries are added.
   */
  component: React.ComponentType<CanvasProps>;

  /** The studio settings panel for this game. */
  panel: React.ComponentType<PanelProps>;

  /** The AI-generation rules/schema for this game. */
  schema: ComponentSchema;
}

/** Type-check the manifest and attach its shared learner-presentation default. */
export function defineTechnique(m: TechniqueManifest): TechniqueManifest {
  return { ...m, defaultThumbnailUrl: DEFAULT_THUMBNAILS[m.technique] };
}

/**
 * Builds a { [technique]: value } lookup from the manifest list. Replaces the
 * hand-written Record<CountingTechnique, T> maps the app used to maintain.
 */
export function byTechnique<T>(
  list: TechniqueManifest[],
  pick: (m: TechniqueManifest) => T,
): Record<CountingTechnique, T> {
  const out = {} as Record<CountingTechnique, T>;
  for (const m of list) out[m.technique] = pick(m);
  return out;
}

/**
 * Techniques that keep their identity but no longer ship a game.
 *
 * A retired technique is deliberately absent from `ALL_TECHNIQUES`: its manifest is not
 * imported, so its canvas, panel and schema are never bundled — which is the whole point,
 * since every chunk is precached by the service worker whether or not a child opens it.
 *
 * The enum entry stays. Published releases are immutable and some still contain questions
 * authored on these, and `getTaxonomy` still has to answer for events already logged. Dropping
 * the enum would turn old, valid data into a lookup miss.
 *
 * Retiring is not deleting: to bring one back, re-add its line to `ALL_TECHNIQUES` and remove
 * it here. To delete one properly, remove the enum entry and every reference too — only safe
 * when no release and no logged event mentions it.
 */
export const RETIRED_TECHNIQUES: ReadonlySet<CountingTechnique> = new Set([
  CountingTechnique.KODA_SUDOKU,
  CountingTechnique.KODA_PATTERN,
  CountingTechnique.MULTIPLICATION_ARRAY,
  CountingTechnique.MULTIPLICATION_COLUMN,
]);

/**
 * Techniques merged into another game rather than parked.
 *
 * Retiring and absorbing look identical from the picker — one fewer entry — and are
 * opposites underneath. A retired technique no longer ships a game at all. An absorbed one
 * still ships the game it always did; it just reaches it through the technique that now owns
 * it, because what separated them turned out to be a setting rather than a component.
 *
 * So an absorbed id keeps a Property Studio panel — an author can still open and edit a
 * question published on it — where a retired id keeps nothing. Neither needs a canvas entry:
 * a `CANVAS_BY_TECHNIQUE` miss falls back to `CountCanvas`, which asks `countStaging`'s
 * `STAGING_BY_TECHNIQUE` what the old id always meant.
 *
 * Maps absorbed id → the technique that now owns it.
 */
export const ABSORBED_TECHNIQUES: ReadonlyMap<CountingTechnique, CountingTechnique> = new Map([
  [CountingTechnique.ONE_TO_ONE, CountingTechnique.MOVE_AND_COUNT],
  [CountingTechnique.LINE_UP_AND_COUNT, CountingTechnique.MOVE_AND_COUNT],
  [CountingTechnique.COUNT_MAGNETS, CountingTechnique.MOVE_AND_COUNT],
  [CountingTechnique.GROUP_IN_TENS, CountingTechnique.MOVE_AND_COUNT],
  [CountingTechnique.COUNT_ON, CountingTechnique.MOVE_AND_COUNT],
  [CountingTechnique.COUNT_BACK, CountingTechnique.MOVE_AND_COUNT],
  [CountingTechnique.DIFFERENT_ARRANGEMENTS, CountingTechnique.MOVE_AND_COUNT],
  /*
    Koda Subtraction, absorbed into Koda Add & Subtract. It was a second picker
    entry for the same activity with the operation reversed — see `SumCanvas`.
    Absorbed rather than retired, because every subtraction slide already
    written still opens: the id routes here and `operationFor` reads it back as
    the mechanic the slide was authored for, with nothing to migrate.
  */
  [CountingTechnique.SUBTRACTION_SANDBOX, CountingTechnique.ADDITION_SANDBOX],
]);

/**
 * The safety net that replaces TypeScript's exhaustive-Record check. Every
 * CountingTechnique must have exactly one manifest, unless it is retired or absorbed above.
 * A missing one throws at app-load in dev (loud, like the old compile error) and logs in prod
 * (so a single mis-registered game can't blank the whole app for a student).
 */
export function assertComplete(list: TechniqueManifest[]): void {
  const seen = new Map<CountingTechnique, number>();
  for (const m of list) seen.set(m.technique, (seen.get(m.technique) ?? 0) + 1);

  const missing = Object.values(CountingTechnique)
    .filter((t) => !seen.has(t) && !RETIRED_TECHNIQUES.has(t) && !ABSORBED_TECHNIQUES.has(t));
  const duplicated = [...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t);

  const problems: string[] = [];
  if (missing.length) problems.push(`no manifest for: ${missing.join(", ")}`);
  if (duplicated.length) problems.push(`duplicate manifest for: ${duplicated.join(", ")}`);
  if (problems.length === 0) return;

  const msg = `[techniques] manifest registry incomplete — ${problems.join("; ")}`;
  if ((import.meta as any).env?.DEV) throw new Error(msg);
  // eslint-disable-next-line no-console
  console.error(msg);
}
