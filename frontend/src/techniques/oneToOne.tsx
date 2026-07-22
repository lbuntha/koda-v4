/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 1. One-to-One — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Fingerprint } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { oneToOneSchema } from "../components/studio/ai-generator/schemas/oneToOne.schema";

export const oneToOne = defineTechnique({
  technique: CountingTechnique.ONE_TO_ONE,
  label: "1. One-to-One",
  icon: <Fingerprint size={14} className="text-indigo-500" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/OneToOneCanvas").then((m) => ({ default: m.OneToOneCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/OneToOnePanel").then((m) => ({ default: m.OneToOnePanel })),
  ),
  schema: oneToOneSchema,
});
