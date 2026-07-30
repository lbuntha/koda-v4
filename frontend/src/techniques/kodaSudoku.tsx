/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 13. Mini Sudoku — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Hash } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { kodaSudokuSchema } from "../components/studio/ai-generator/schemas/kodaSudoku.schema";

export const kodaSudoku = defineTechnique({
  technique: CountingTechnique.KODA_SUDOKU,
  defaultThumbnailUrl: "/assets/components/koda-sudoku.svg",
  label: "13. Mini Sudoku",
  icon: <Hash size={14} className="text-purple-600" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/KodaSudokuCanvas").then((m) => ({ default: m.KodaSudokuCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/KodaSudokuPanel").then((m) => ({ default: m.KodaSudokuPanel })),
  ),
  schema: kodaSudokuSchema,
});
