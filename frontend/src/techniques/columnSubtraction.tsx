import React from "react";
import { Columns3 } from "lucide-react";
import { CountingTechnique } from "../types";
import { columnSubtractionSchema } from "../components/studio/ai-generator/schemas/columnSubtraction.schema";
import { defineTechnique } from "./manifest";

export const columnSubtraction = defineTechnique({
  technique: CountingTechnique.SUBTRACTION_COLUMN,
  label: "18. Column Subtraction",
  icon: <Columns3 size={14} className="text-rose-600" />,
  defaultTargetCount: 254,
  component: React.lazy(() =>
    import("../components/canvases/ColumnSubtractionCanvas").then(module => ({ default: module.ColumnSubtractionCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/ColumnSubtractionPanel").then(module => ({ default: module.ColumnSubtractionPanel })),
  ),
  schema: columnSubtractionSchema,
});
