/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 11. Koda Subtraction — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { MinusSquare } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { subtractionSchema } from "../components/studio/ai-generator/schemas/subtraction.schema";

export const subtraction = defineTechnique({
  technique: CountingTechnique.SUBTRACTION_SANDBOX,
  label: "11. Koda Subtraction",
  icon: <MinusSquare size={14} className="text-pink-600" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/SubtractionCanvas").then((m) => ({ default: m.SubtractionCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/SubtractionSandboxPanel").then((m) => ({ default: m.SubtractionSandboxPanel })),
  ),
  schema: subtractionSchema,
});
