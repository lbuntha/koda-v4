/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 1. Count — single-file registration for the whole counting family.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 *
 * This one entry replaces four picker entries — One-to-One, Move & Count, Line
 * Up and Magnet Jar — which were the same activity with a different physical
 * act. The act is now the `staging` setting inside the game, so an author picks
 * "Count" once and then chooses how the child counts.
 *
 * The other three technique ids are retired, not deleted (see
 * `manifest.ts` → `RETIRED_TECHNIQUES`): questions already published on them
 * keep rendering, because `CANVAS_BY_TECHNIQUE` misses fall back to
 * `CountCanvas` and `STAGING_BY_TECHNIQUE` still maps the old id to the staging
 * it always meant.
 */

import React from "react";
import { Hand } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { countSchema } from "../components/studio/ai-generator/schemas/count.schema";

export const count = defineTechnique({
  technique: CountingTechnique.MOVE_AND_COUNT,
  label: "Count",
  icon: <Hand size={14} className="text-indigo-500" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/CountCanvas").then((m) => ({ default: m.CountCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/CountPanel").then((m) => ({ default: m.CountPanel })),
  ),
  schema: countSchema,
});
