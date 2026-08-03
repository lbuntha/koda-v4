import React from "react";
import { Columns3 } from "lucide-react";
import { CountingTechnique } from "../types";
import { columnMultiplicationSchema } from "../components/studio/ai-generator/schemas/columnMultiplication.schema";
import { defineTechnique } from "./manifest";

export const columnMultiplication = defineTechnique({
  technique: CountingTechnique.MULTIPLICATION_COLUMN,
  defaultThumbnailUrl: "/assets/components/multiplication-column.svg",
  label: "Column Multiplication",
  icon: <Columns3 size={14} className="text-blue-600" />,
  defaultTargetCount: 13_104,
  component: React.lazy(() =>
    import("../components/canvases/ColumnMultiplicationCanvas").then(module => ({ default: module.ColumnMultiplicationCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/ColumnMultiplicationPanel").then(module => ({ default: module.ColumnMultiplicationPanel })),
  ),
  schema: columnMultiplicationSchema,
});
