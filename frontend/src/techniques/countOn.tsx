/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 5. Count On — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { PlusCircle } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { countOnSchema } from "../components/studio/ai-generator/schemas/countOn.schema";

export const countOn = defineTechnique({
  technique: CountingTechnique.COUNT_ON,
  defaultThumbnailUrl: "/assets/components/count-on.svg",
  label: "5. Count On",
  icon: <PlusCircle size={14} className="text-purple-500" />,
  defaultTargetCount: 8,
  component: React.lazy(() =>
    import("../components/canvases/CountOnCanvas").then((m) => ({ default: m.CountOnCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/CountOnPanel").then((m) => ({ default: m.CountOnPanel })),
  ),
  schema: countOnSchema,
});
