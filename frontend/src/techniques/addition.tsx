/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 10. Koda Add & Subtract — single-file registration for this game.
 *
 * One entry for both operations. "Koda Subtraction" was a second game in the
 * picker that differed from this one in its mechanic and in nothing else, so it
 * is absorbed here the way the four counting games were absorbed into Move &
 * Count: the operation is a setting, not a game. See `SumCanvas`.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { PlusSquare } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { additionSchema } from "../components/studio/ai-generator/schemas/addition.schema";

export const addition = defineTechnique({
  technique: CountingTechnique.ADDITION_SANDBOX,
  label: "Koda Add & Subtract",
  icon: <PlusSquare size={14} className="text-indigo-600" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/SumCanvas").then((m) => ({ default: m.SumCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/SumPanel").then((m) => ({ default: m.SumPanel })),
  ),
  schema: additionSchema,
});
