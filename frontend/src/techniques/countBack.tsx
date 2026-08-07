/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 6. Count Back — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { MinusCircle } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { countBackSchema } from "../components/studio/ai-generator/schemas/countBack.schema";

export const countBack = defineTechnique({
  technique: CountingTechnique.COUNT_BACK,
  label: "Count Back",
  icon: <MinusCircle size={14} className="text-rose-500" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/CountBackCanvas").then((m) => ({ default: m.CountBackCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/CountBackPanel").then((m) => ({ default: m.CountBackPanel })),
  ),
  schema: countBackSchema,
});
