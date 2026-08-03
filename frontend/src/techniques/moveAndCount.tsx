/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 2. Move & Count — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { ArrowRightLeft } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { moveAndCountSchema } from "../components/studio/ai-generator/schemas/moveAndCount.schema";

export const moveAndCount = defineTechnique({
  technique: CountingTechnique.MOVE_AND_COUNT,
  label: "Move & Count",
  icon: <ArrowRightLeft size={14} className="text-emerald-500" />,
  defaultTargetCount: 5,
  defaultThumbnailUrl: "/assets/components/move-and-count.svg",
  component: React.lazy(() =>
    import("../components/canvases/MoveAndCountCanvas").then((m) => ({ default: m.MoveAndCountCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/MoveAndCountPanel").then((m) => ({ default: m.MoveAndCountPanel })),
  ),
  schema: moveAndCountSchema,
});
