import React from "react";
import { Rows3 } from "lucide-react";
import { CountingTechnique } from "../types";
import { multiRowColumnSubtractionSchema } from "../components/studio/ai-generator/schemas/multiRowColumnSubtraction.schema";
import { defineTechnique } from "./manifest";

export const multiRowColumnSubtraction = defineTechnique({
  technique: CountingTechnique.SUBTRACTION_COLUMN_MULTI,
  defaultThumbnailUrl: "/assets/components/subtraction-column-multi.svg",
  label: "Multi-Row Column Subtraction",
  icon: <Rows3 size={14} className="text-rose-600" />,
  defaultTargetCount: 198,
  component: React.lazy(() =>
    import("../components/canvases/ColumnSubtractionCanvas").then(module => ({ default: module.ColumnSubtractionCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/MultiRowColumnSubtractionPanel").then(module => ({ default: module.MultiRowColumnSubtractionPanel })),
  ),
  schema: multiRowColumnSubtractionSchema,
});
