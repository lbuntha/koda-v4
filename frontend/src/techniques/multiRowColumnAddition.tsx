import React from "react";
import { Rows3 } from "lucide-react";
import { CountingTechnique } from "../types";
import { multiRowColumnAdditionSchema } from "../components/studio/ai-generator/schemas/multiRowColumnAddition.schema";
import { defineTechnique } from "./manifest";

export const multiRowColumnAddition = defineTechnique({
  technique: CountingTechnique.ADDITION_COLUMN_MULTI,
  defaultThumbnailUrl: "/assets/components/addition-column-multi.svg",
  label: "Multi-Row Column Addition",
  icon: <Rows3 size={14} className="text-indigo-600" />,
  defaultTargetCount: 792,
  component: React.lazy(() =>
    import("../components/canvases/ColumnAdditionCanvas").then(module => ({ default: module.ColumnAdditionCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/MultiRowColumnAdditionPanel").then(module => ({ default: module.MultiRowColumnAdditionPanel })),
  ),
  schema: multiRowColumnAdditionSchema,
});
