/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TechniqueManifest — the single source of truth for one counting game.
 *
 * Each game (technique) is described in ONE file under src/techniques/. The
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

export interface TechniqueManifest {
  /** Enum value that identifies this game everywhere. */
  technique: CountingTechnique;

  /** Studio picker label, e.g. "9. Subitize Flash". */
  label: string;

  /** lucide icon element shown next to the label in the picker. */
  icon: React.ReactElement<{ className?: string }>;

  /** Target count a teacher gets when first selecting this game. */
  defaultTargetCount: number;

  /**
   * Static learner-facing fallback used when a curriculum skill has no
   * authored thumbnail. Keeping it in the technique manifest makes the
   * component the owner of its default presentation.
   */
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

/** Identity helper — its only job is to type-check the manifest shape. */
export function defineTechnique(m: TechniqueManifest): TechniqueManifest {
  return m;
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
 * The safety net that replaces TypeScript's exhaustive-Record check. Every
 * CountingTechnique must have exactly one manifest. A missing one throws at
 * app-load in dev (loud, like the old compile error) and logs in prod (so a
 * single mis-registered game can't blank the whole app for a student).
 */
export function assertComplete(list: TechniqueManifest[]): void {
  const seen = new Map<CountingTechnique, number>();
  for (const m of list) seen.set(m.technique, (seen.get(m.technique) ?? 0) + 1);

  const missing = Object.values(CountingTechnique).filter((t) => !seen.has(t));
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
