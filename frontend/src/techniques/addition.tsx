/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 10. Koda Addition — single-file registration for this game.
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
  defaultThumbnailUrl: "/assets/components/addition-sandbox.svg",
  label: "10. Koda Addition",
  icon: <PlusSquare size={14} className="text-indigo-600" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/AdditionCanvas").then((m) => ({ default: m.AdditionCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/AdditionSandboxPanel").then((m) => ({ default: m.AdditionSandboxPanel })),
  ),
  schema: additionSchema,
});
