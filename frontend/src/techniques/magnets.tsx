/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 8. Magnet Jar — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Magnet } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { magnetsSchema } from "../components/studio/ai-generator/schemas/magnets.schema";

export const magnets = defineTechnique({
  technique: CountingTechnique.COUNT_MAGNETS,
  defaultThumbnailUrl: "/assets/components/count-magnets.svg",
  label: "Magnet Jar",
  icon: <Magnet size={14} className="text-red-500" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/MagnetsCanvas").then((m) => ({ default: m.MagnetsCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/CountMagnetsPanel").then((m) => ({ default: m.CountMagnetsPanel })),
  ),
  schema: magnetsSchema,
});
