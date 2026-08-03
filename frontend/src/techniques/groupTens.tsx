/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 4. Group Tens — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Boxes } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { groupTensSchema } from "../components/studio/ai-generator/schemas/groupTens.schema";

export const groupTens = defineTechnique({
  technique: CountingTechnique.GROUP_IN_TENS,
  defaultThumbnailUrl: "/assets/components/group-in-tens.svg",
  label: "Group Tens",
  icon: <Boxes size={14} className="text-amber-500" />,
  defaultTargetCount: 14,
  component: React.lazy(() =>
    import("../components/canvases/GroupTensCanvas").then((m) => ({ default: m.GroupTensCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/GroupInTensPanel").then((m) => ({ default: m.GroupInTensPanel })),
  ),
  schema: groupTensSchema,
});
